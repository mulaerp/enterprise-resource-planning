import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ToastProvider } from './components/ui';

// Lazy load pages for better performance (Phase 5.1)
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProductListPage = lazy(() => import('./pages/products/ProductListPage'));
const ProductFormPage = lazy(() => import('./pages/products/ProductFormPage'));
const CustomerListPage = lazy(() => import('./pages/customers/CustomerListPage'));
const CustomerFormPage = lazy(() => import('./pages/customers/CustomerFormPage'));
const SupplierListPage = lazy(() => import('./pages/suppliers/SupplierListPage'));
const SupplierFormPage = lazy(() => import('./pages/suppliers/SupplierFormPage'));
const SalesOrderListPage = lazy(() => import('./pages/sales/SalesOrderListPage'));
const SalesOrderFormPage = lazy(() => import('./pages/sales/SalesOrderFormPage'));
const SalesOrderDetailPage = lazy(() => import('./pages/sales/SalesOrderDetailPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SalesReportPage = lazy(() => import('./pages/reports/SalesReportPage'));
const InventoryReportPage = lazy(() => import('./pages/reports/InventoryReportPage'));
const PurchaseOrderListPage = lazy(() => import('./pages/purchase/PurchaseOrderListPage'));
const PurchaseOrderFormPage = lazy(() => import('./pages/purchase/PurchaseOrderFormPage'));
const PurchaseOrderDetailPage = lazy(() => import('./pages/purchase/PurchaseOrderDetailPage'));
const InvoiceListPage = lazy(() => import('./pages/invoice/InvoiceListPage'));
const InvoiceFormPage = lazy(() => import('./pages/invoice/InvoiceFormPage'));
const InvoiceDetailPage = lazy(() => import('./pages/invoice/InvoiceDetailPage'));
const PaymentListPage = lazy(() => import('./pages/payment/PaymentListPage'));
const PaymentFormPage = lazy(() => import('./pages/payment/PaymentFormPage'));
const UserListPage = lazy(() => import('./pages/users/UserListPage'));
const UserFormPage = lazy(() => import('./pages/users/UserFormPage'));
const CompanySettingsPage = lazy(() => import('./pages/settings/CompanySettingsPage'));
const AccountingPage = lazy(() => import('./pages/accounting/AccountingPage'));
const AccountListPage = lazy(() => import('./pages/accounting/AccountListPage'));
const AccountFormPage = lazy(() => import('./pages/accounting/AccountFormPage'));
const JournalEntryListPage = lazy(() => import('./pages/accounting/JournalEntryListPage'));
const JournalEntryFormPage = lazy(() => import('./pages/accounting/JournalEntryFormPage'));
const TrialBalancePage = lazy(() => import('./pages/accounting/TrialBalancePage'));
const StockAdjustmentListPage = lazy(() => import('./pages/inventory/StockAdjustmentListPage'));
const StockAdjustmentFormPage = lazy(() => import('./pages/inventory/StockAdjustmentFormPage'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <ToastProvider>
          <Router>
            <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductListPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />
              <Route path="/customers" element={<CustomerListPage />} />
              <Route path="/customers/new" element={<CustomerFormPage />} />
              <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
              <Route path="/suppliers" element={<SupplierListPage />} />
              <Route path="/suppliers/new" element={<SupplierFormPage />} />
              <Route path="/suppliers/:id/edit" element={<SupplierFormPage />} />
              <Route path="/sales-orders" element={<SalesOrderListPage />} />
              <Route path="/sales-orders/new" element={<SalesOrderFormPage />} />
              <Route path="/sales-orders/:id" element={<SalesOrderDetailPage />} />
              <Route path="/sales-orders/:id/edit" element={<SalesOrderFormPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/sales" element={<SalesReportPage />} />
              <Route path="/reports/inventory" element={<InventoryReportPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrderListPage />} />
              <Route path="/purchase-orders/new" element={<PurchaseOrderFormPage />} />
              <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
              <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderFormPage />} />
              <Route path="/invoices" element={<InvoiceListPage />} />
              <Route path="/invoices/new" element={<InvoiceFormPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />
              <Route path="/payments" element={<PaymentListPage />} />
              <Route path="/payments/new" element={<PaymentFormPage />} />
              <Route path="/users" element={<UserListPage />} />
              <Route path="/users/new" element={<UserFormPage />} />
              <Route path="/users/:id/edit" element={<UserFormPage />} />
              <Route path="/settings/company" element={<CompanySettingsPage />} />
              <Route path="/accounting" element={<AccountingPage />} />
              <Route path="/accounting/accounts" element={<AccountListPage />} />
              <Route path="/accounting/accounts/new" element={<AccountFormPage />} />
              <Route path="/accounting/accounts/:id/edit" element={<AccountFormPage />} />
              <Route path="/accounting/journal-entries" element={<JournalEntryListPage />} />
              <Route path="/accounting/journal-entries/new" element={<JournalEntryFormPage />} />
              <Route path="/accounting/journal-entries/:id/edit" element={<JournalEntryFormPage />} />
              <Route path="/accounting/trial-balance" element={<TrialBalancePage />} />
              <Route path="/inventory/adjustments" element={<StockAdjustmentListPage />} />
              <Route path="/inventory/adjustments/new" element={<StockAdjustmentFormPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </Suspense>
          </Router>
        </ToastProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
