/**
 * Test data generators for E2E tests
 */

export function generateProductData() {
  const timestamp = Date.now();
  return {
    sku: `TEST-${timestamp}`,
    name: `Test Product ${timestamp}`,
    description: 'Test product description for E2E testing',
    unitPrice: '99.99',
    costPrice: '50.00',
    stockQuantity: '100',
    reorderLevel: '10',
  };
}

export function generateCustomerData() {
  const timestamp = Date.now();
  return {
    name: `Test Customer ${timestamp}`,
    email: `customer${timestamp}@test.com`,
    phone: '1234567890',
    address: '123 Test Street, Test City, TC 12345',
    taxId: `TAX${timestamp}`,
    creditLimit: '10000',
  };
}

export function generateSupplierData() {
  const timestamp = Date.now();
  return {
    name: `Test Supplier ${timestamp}`,
    email: `supplier${timestamp}@test.com`,
    phone: '0987654321',
    address: '456 Supplier Avenue, Supplier City, SC 54321',
    taxId: `STAX${timestamp}`,
    paymentTerms: 'Net 30',
  };
}

export function generateSalesOrderData() {
  return {
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: 'Test sales order created by E2E tests',
  };
}

export function generateOrderItemData() {
  return {
    quantity: '5',
    discount: '0',
    taxRate: '10',
  };
}

/**
 * Wait for a specific duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string
 */
export function randomString(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random number within range
 */
export function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
