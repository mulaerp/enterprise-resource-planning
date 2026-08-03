import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test.describe('Audit logs and admin CSV import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should record CREATE/UPDATE audit entries for a product and support filtering by entity type', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const sku = `AUD-${timestamp}`;
    const originalName = `Audit Product ${timestamp}`;
    const updatedName = `Audit Product Updated ${timestamp}`;

    // Create a product via the UI
    await page.goto('/products/new');
    await page.getByLabel(/sku/i).fill(sku);
    await page.getByLabel(/^name/i).fill(originalName);
    await page.getByLabel(/description/i).fill('Audit trail test product');
    await page.getByLabel(/unit price/i).fill('49.99');
    await page.getByLabel(/cost price/i).fill('20.00');
    await page.getByLabel(/stock quantity/i).fill('25');
    await page.getByLabel(/reorder level/i).fill('5');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });

    // Edit it
    await page.goto('/products');
    await page.getByPlaceholder(/search by name or sku/i).fill(sku);
    await page.waitForTimeout(600); // debounced search
    const productRow = page.locator('table tbody tr', { hasText: sku });
    await expect(productRow).toBeVisible({ timeout: 10000 });
    await productRow.getByRole('button', { name: /edit/i }).click();
    await expect(page).toHaveURL(/\/products\/.+\/edit/);

    await page.getByLabel(/^name/i).fill(updatedName);
    await page.getByRole('button', { name: /save|update/i }).click();
    // .first() because updatedName itself contains "Updated" (e.g. "Audit Product Updated
    // <timestamp>"), which - once the list re-renders with the saved name - also matches this
    // regex via the product's own table cell, in addition to the "Product updated successfully"
    // toast.
    await expect(page.getByText(/success|updated/i).first()).toBeVisible({ timeout: 10000 });

    // The audit trail should show a fresh CREATE and UPDATE row for a Product, attributed to the
    // admin user. Filter by entity type FIRST rather than trusting the unfiltered page-1/size-20
    // view: this app writes an audit row for every entity mutation, so on a busy database (or a
    // parallel test run) hundreds of unrelated rows can land between this product's writes and
    // the page load, pushing ours off the first page entirely.
    await page.goto('/settings/audit-logs');
    await expect(page.getByRole('heading', { name: /audit logs/i })).toBeVisible();
    await page.getByLabel(/entity type/i).selectOption('Product');
    // Filter by username too: since V38, a trade-in creates/updates products as the CASHIER, so
    // filtering on entity type alone leaves the newest Product rows attributed to someone else and
    // the admin-attribution assertions below fail on a busy database.
    await page.getByLabel(/username/i).fill('admin@mulaerp.com');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    const productTd = (action: string) =>
      page
        .locator('table tbody tr')
        .filter({ has: page.locator('td', { hasText: /^Product$/ }) })
        .filter({ has: page.locator('td', { hasText: new RegExp(`^${action}$`) }) })
        .first();

    const createRow = productTd('CREATE');
    const updateRow = productTd('UPDATE');
    await expect(createRow).toBeVisible({ timeout: 10000 });
    await expect(updateRow).toBeVisible({ timeout: 10000 });
    await expect(createRow.getByText(/admin/i)).toBeVisible();
    await expect(updateRow.getByText(/admin/i)).toBeVisible();

    // Filtering by entity type should scope the table to just that type.
    await page.getByLabel(/entity type/i).selectOption('Product');
    // Filter by username too: since V38, a trade-in creates/updates products as the CASHIER, so
    // filtering on entity type alone leaves the newest Product rows attributed to someone else and
    // the admin-attribution assertions below fail on a busy database.
    await page.getByLabel(/username/i).fill('admin@mulaerp.com');
    await page.getByRole('button', { name: /apply filters/i }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    const visibleRows = page.locator('table tbody tr');
    const rowCount = await visibleRows.count();
    for (let i = 0; i < rowCount; i++) {
      await expect(visibleRows.nth(i)).toContainText('Product');
    }
  });

  test('should import a 2-row product CSV and show the new products in the list', async ({ page }) => {
    const timestamp = Date.now();
    const nameOne = `Imported Product One ${timestamp}`;
    const nameTwo = `Imported Product Two ${timestamp}`;
    const csv = Buffer.from(
      [
        'sku,name,category,costPrice,unitPrice,stockQuantity',
        `IMP-${timestamp}-1,${nameOne},Imported Test Category,10.00,25.00,15`,
        `IMP-${timestamp}-2,${nameTwo},Imported Test Category,12.00,30.00,20`,
      ].join('\n'),
      'utf-8'
    );

    await page.goto('/products');
    await page.getByTestId('import-products-csv-button').click();
    await page.getByTestId('import-products-csv-file-input').setInputFiles({
      name: 'products.csv',
      mimeType: 'text/csv',
      buffer: csv,
    });
    await page.getByTestId('import-products-csv-submit').click();

    // "Imported 2" appears twice: the persistent summary line ("Imported 2, skipped
    // 0, ...") and the transient success toast ("Imported 2 product(s)") - .first()
    // just confirms one of them is showing.
    await expect(page.getByText(/imported 2/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /^close$/i }).click();

    await page.getByPlaceholder(/search by name or sku/i).fill(`IMP-${timestamp}`);
    await page.waitForTimeout(600);
    await expect(page.getByText(nameOne)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(nameTwo)).toBeVisible();
  });
});
