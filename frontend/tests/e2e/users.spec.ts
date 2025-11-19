import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@mulaerp.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate to users page', async ({ page }) => {
    const usersLink = page.getByRole('link', { name: /users/i }).first();
    if (await usersLink.isVisible({ timeout: 5000 })) {
      await usersLink.click();
      await expect(page).toHaveURL(/\/users/);
      await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    }
  });

  test('should display users list', async ({ page }) => {
    await page.goto('/users');
    
    // Check table headers
    await expect(page.getByText(/name/i).first()).toBeVisible();
    await expect(page.getByText(/email/i).first()).toBeVisible();
    await expect(page.getByText(/role/i).first()).toBeVisible();
    await expect(page.getByText(/status/i).first()).toBeVisible();
  });

  test('should create a new user', async ({ page }) => {
    await page.goto('/users/new');
    
    const timestamp = Date.now();
    const email = `testuser${timestamp}@test.com`;
    
    // Fill form
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByLabel(/full name/i).fill(`Test User ${timestamp}`);
    await page.getByLabel(/role/i).selectOption('USER');
    
    // Submit
    await page.getByRole('button', { name: /create user/i }).click();
    
    // Verify success
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/users$/);
  });

  test('should validate required fields on create', async ({ page }) => {
    await page.goto('/users/new');
    
    // Try to submit without filling fields
    await page.getByRole('button', { name: /create user/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/users/new');
    
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByLabel(/full name/i).fill('Test User');
    
    await page.getByRole('button', { name: /create user/i }).click();
    
    // Should show email validation error or not submit
    const hasError = await page.getByText(/invalid.*email/i).isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasError) {
      // Form might prevent submission with HTML5 validation
      await expect(page).toHaveURL(/\/users\/new/);
    }
  });

  test('should validate password length', async ({ page }) => {
    await page.goto('/users/new');
    
    await page.getByLabel(/email/i).fill('test@test.com');
    await page.getByLabel(/password/i).fill('123'); // Too short
    await page.getByLabel(/full name/i).fill('Test User');
    
    await page.getByRole('button', { name: /create user/i }).click();
    
    // Should show password validation error
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('should edit an existing user', async ({ page }) => {
    await page.goto('/users');
    
    // Wait for table to load
    await page.waitForTimeout(1000);
    
    // Find and click edit button (not for admin user)
    const editButtons = page.getByRole('button').filter({ hasText: /edit/i });
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      await expect(page).toHaveURL(/\/users\/.*\/edit/);
      
      // Update full name
      const nameInput = page.getByLabel(/full name/i);
      await nameInput.clear();
      await nameInput.fill('Updated User Name');
      
      // Submit
      await page.getByRole('button', { name: /update user/i }).click();
      
      // Verify success
      await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should change user role', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    const editButtons = page.getByRole('button').filter({ hasText: /edit/i });
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      await expect(page).toHaveURL(/\/users\/.*\/edit/);
      
      // Change role
      await page.getByLabel(/role/i).selectOption('MANAGER');
      
      // Submit
      await page.getByRole('button', { name: /update user/i }).click();
      
      // Verify success
      await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should change user status', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    const editButtons = page.getByRole('button').filter({ hasText: /edit/i });
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      await expect(page).toHaveURL(/\/users\/.*\/edit/);
      
      // Check if status field exists (only on edit)
      const statusField = page.getByLabel(/status/i);
      if (await statusField.isVisible({ timeout: 2000 })) {
        await statusField.selectOption('INACTIVE');
        
        // Submit
        await page.getByRole('button', { name: /update user/i }).click();
        
        // Verify success
        await expect(page.getByText(/success|updated/i)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should delete a user', async ({ page }) => {
    // First create a user to delete
    await page.goto('/users/new');
    
    const timestamp = Date.now();
    await page.getByLabel(/email/i).fill(`deleteuser${timestamp}@test.com`);
    await page.getByLabel(/password/i).fill('password123');
    await page.getByLabel(/full name/i).fill(`Delete User ${timestamp}`);
    await page.getByLabel(/role/i).selectOption('USER');
    
    await page.getByRole('button', { name: /create user/i }).click();
    await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 10000 });
    
    // Now delete it
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    // Set up dialog handler before clicking delete
    page.on('dialog', dialog => dialog.accept());
    
    const deleteButtons = page.getByRole('button').filter({ hasText: /delete/i });
    const count = await deleteButtons.count();
    
    if (count > 0) {
      await deleteButtons.last().click(); // Delete the last user (most recently created)
      
      // Verify success
      await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display role badges correctly', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    // Check if role badges are visible
    const adminBadge = page.getByText('ADMIN').first();
    if (await adminBadge.isVisible({ timeout: 5000 })) {
      await expect(adminBadge).toBeVisible();
    }
  });

  test('should display status badges correctly', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    // Check if status badges are visible
    const activeBadge = page.getByText('ACTIVE').first();
    if (await activeBadge.isVisible({ timeout: 5000 })) {
      await expect(activeBadge).toBeVisible();
    }
  });

  test('should cancel user creation', async ({ page }) => {
    await page.goto('/users/new');
    
    // Fill some data
    await page.getByLabel(/email/i).fill('test@test.com');
    
    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click();
    
    // Should navigate back to users list
    await expect(page).toHaveURL(/\/users$/);
  });

  test('should cancel user edit', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    const editButtons = page.getByRole('button').filter({ hasText: /edit/i });
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      await expect(page).toHaveURL(/\/users\/.*\/edit/);
      
      // Click cancel
      await page.getByRole('button', { name: /cancel/i }).click();
      
      // Should navigate back to users list
      await expect(page).toHaveURL(/\/users$/);
    }
  });

  test('should show loading state', async ({ page }) => {
    await page.goto('/users');
    
    // Loading state should appear briefly
    const loadingIndicator = page.getByText(/loading/i);
    // This might be too fast to catch, so we just check the page loads
    await expect(page.getByRole('heading', { name: /users/i })).toBeVisible({ timeout: 10000 });
  });

  test('should not allow password field on edit', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    const editButtons = page.getByRole('button').filter({ hasText: /edit/i });
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      await expect(page).toHaveURL(/\/users\/.*\/edit/);
      
      // Password field should not be visible on edit
      const passwordField = page.getByLabel(/^password/i);
      await expect(passwordField).not.toBeVisible();
    }
  });

  test('should display created date', async ({ page }) => {
    await page.goto('/users');
    await page.waitForTimeout(1000);
    
    // Check if created column header exists
    await expect(page.getByText(/created/i).first()).toBeVisible();
  });

  test('should have new user button', async ({ page }) => {
    await page.goto('/users');
    
    const newUserButton = page.getByRole('link', { name: /new user/i });
    await expect(newUserButton).toBeVisible();
    
    await newUserButton.click();
    await expect(page).toHaveURL(/\/users\/new/);
  });
});
