/*
 * Mula ERP - Enterprise Resource Planning System
 * Copyright (c) 2025 Mula Solution & Enterprise
 * 
 * Licensed under the Business Source License 1.1 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://github.com/mulaerp/enterprise-resource-planning/blob/main/LICENSE
 * 
 * Change Date: 2029-01-19
 * Change License: GNU General Public License v3.0 or later
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { ShopAuthProvider } from './contexts/ShopAuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './components/ui';
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute';

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
const AuditLogsPage = lazy(() => import('./pages/settings/AuditLogsPage'));
const CommercialTermsPage = lazy(() => import('./pages/settings/CommercialTermsPage'));
const AccountingPage = lazy(() => import('./pages/accounting/AccountingPage'));
const AccountListPage = lazy(() => import('./pages/accounting/AccountListPage'));
const AccountFormPage = lazy(() => import('./pages/accounting/AccountFormPage'));
const JournalEntryListPage = lazy(() => import('./pages/accounting/JournalEntryListPage'));
const JournalEntryFormPage = lazy(() => import('./pages/accounting/JournalEntryFormPage'));
const PostDraftsPage = lazy(() => import('./pages/accounting/PostDraftsPage'));
const TrialBalancePage = lazy(() => import('./pages/accounting/TrialBalancePage'));
const ProfitLossPage = lazy(() => import('./pages/accounting/ProfitLossPage'));
const BalanceSheetPage = lazy(() => import('./pages/accounting/BalanceSheetPage'));
const BankReconciliationPage = lazy(() => import('./pages/accounting/BankReconciliationPage'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
const WarehouseListPage = lazy(() => import('./pages/inventory/WarehouseListPage'));
const WarehouseFormPage = lazy(() => import('./pages/inventory/WarehouseFormPage'));
const WarehouseStockPage = lazy(() => import('./pages/inventory/WarehouseStockPage'));
const StockAdjustmentListPage = lazy(() => import('./pages/inventory/StockAdjustmentListPage'));
const StockAdjustmentFormPage = lazy(() => import('./pages/inventory/StockAdjustmentFormPage'));
const BatchListPage = lazy(() => import('./pages/inventory/BatchListPage'));
const BatchFormPage = lazy(() => import('./pages/inventory/BatchFormPage'));
const SerialListPage = lazy(() => import('./pages/inventory/SerialListPage'));
const SerialFormPage = lazy(() => import('./pages/inventory/SerialFormPage'));
const StockTransferListPage = lazy(() => import('./pages/inventory/StockTransferListPage'));
const StockTransferFormPage = lazy(() => import('./pages/inventory/StockTransferFormPage'));
const StockMovementsPage = lazy(() => import('./pages/inventory/StockMovementsPage'));
const StockTakeListPage = lazy(() => import('./pages/inventory/StockTakeListPage'));
const StockTakeDetailPage = lazy(() => import('./pages/inventory/StockTakeDetailPage'));
const RegisterPage = lazy(() => import('./pages/pos/RegisterPage'));
const IntakePage = lazy(() => import('./pages/pos/IntakePage'));
const DisplayPage = lazy(() => import('./pages/pos/DisplayPage'));
const MembersListPage = lazy(() => import('./pages/pos/MembersListPage'));
const MemberFormPage = lazy(() => import('./pages/pos/MemberFormPage'));
const VouchersListPage = lazy(() => import('./pages/pos/VouchersListPage'));
const VoucherFormPage = lazy(() => import('./pages/pos/VoucherFormPage'));
const SalesHistoryPage = lazy(() => import('./pages/pos/SalesHistoryPage'));
const SaleDetailPage = lazy(() => import('./pages/pos/SaleDetailPage'));
const RepairListPage = lazy(() => import('./pages/repair/RepairListPage'));
const RepairFormPage = lazy(() => import('./pages/repair/RepairFormPage'));
const RepairDetailPage = lazy(() => import('./pages/repair/RepairDetailPage'));
const WarrantyListPage = lazy(() => import('./pages/warranty/WarrantyListPage'));
const WarrantyDetailPage = lazy(() => import('./pages/warranty/WarrantyDetailPage'));
const OversightPage = lazy(() => import('./pages/oversight/OversightPage'));
const ItemTracePage = lazy(() => import('./pages/oversight/ItemTracePage'));
const MoneyFlowPage = lazy(() => import('./pages/oversight/MoneyFlowPage'));
const ExceptionsPage = lazy(() => import('./pages/oversight/ExceptionsPage'));
const CashUpPage = lazy(() => import('./pages/oversight/CashUpPage'));
const MyDayPage = lazy(() => import('./pages/oversight/MyDayPage'));
const WebOrdersPage = lazy(() => import('./pages/oversight/WebOrdersPage'));

// Public storefront (B2C, anonymous - rendered outside ProtectedRoute, see SHOP module spec)
const StorefrontPage = lazy(() => import('./pages/public/StorefrontPage'));
const StorefrontItemPage = lazy(() => import('./pages/public/StorefrontItemPage'));
const WarrantyCheckPage = lazy(() => import('./pages/public/WarrantyCheckPage'));

// SHOP customer accounts (B2C, anonymous entry points - a shop customer session is a SEPARATE
// identity from staff auth, see ShopAuthContext/shop-api.ts and the WEBSHOP module spec).
const ShopLoginPage = lazy(() => import('./pages/shop/ShopLoginPage'));
const ShopRegisterPage = lazy(() => import('./pages/shop/ShopRegisterPage'));
const ShopAccountPage = lazy(() => import('./pages/shop/ShopAccountPage'));

// WEBSHOP: cart/checkout/orders (guest or member) + postal trade-in quotes (MEMBERS-ONLY, see
// TradeInQuotePage's own javadoc for the OWNER DECISION) - see CartContext for the client-side
// cart and the WEBSHOP module spec for the full flow.
const CartPage = lazy(() => import('./pages/shop/CartPage'));
const CheckoutPage = lazy(() => import('./pages/shop/CheckoutPage'));
const OrderConfirmationPage = lazy(() => import('./pages/shop/OrderConfirmationPage'));
const OrderLookupPage = lazy(() => import('./pages/shop/OrderLookupPage'));
const TradeInQuotePage = lazy(() => import('./pages/shop/TradeInQuotePage'));
const TradeInQuoteLookupPage = lazy(() => import('./pages/shop/TradeInQuoteLookupPage'));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
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
              <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><ProductListPage /></ProtectedRoute>} />
              <Route path="/products/new" element={<ProtectedRoute><ProductFormPage /></ProtectedRoute>} />
              <Route path="/products/:id/edit" element={<ProtectedRoute><ProductFormPage /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><CustomerListPage /></ProtectedRoute>} />
              <Route path="/customers/new" element={<ProtectedRoute><CustomerFormPage /></ProtectedRoute>} />
              <Route path="/customers/:id/edit" element={<ProtectedRoute><CustomerFormPage /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute><SupplierListPage /></ProtectedRoute>} />
              <Route path="/suppliers/new" element={<ProtectedRoute><SupplierFormPage /></ProtectedRoute>} />
              <Route path="/suppliers/:id/edit" element={<ProtectedRoute><SupplierFormPage /></ProtectedRoute>} />
              <Route path="/sales-orders" element={<ProtectedRoute><SalesOrderListPage /></ProtectedRoute>} />
              <Route path="/sales-orders/new" element={<ProtectedRoute><SalesOrderFormPage /></ProtectedRoute>} />
              <Route path="/sales-orders/:id" element={<ProtectedRoute><SalesOrderDetailPage /></ProtectedRoute>} />
              <Route path="/sales-orders/:id/edit" element={<ProtectedRoute><SalesOrderFormPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/reports/sales" element={<ProtectedRoute><SalesReportPage /></ProtectedRoute>} />
              <Route path="/reports/inventory" element={<ProtectedRoute><InventoryReportPage /></ProtectedRoute>} />
              <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrderListPage /></ProtectedRoute>} />
              <Route path="/purchase-orders/new" element={<ProtectedRoute><PurchaseOrderFormPage /></ProtectedRoute>} />
              <Route path="/purchase-orders/:id" element={<ProtectedRoute><PurchaseOrderDetailPage /></ProtectedRoute>} />
              <Route path="/purchase-orders/:id/edit" element={<ProtectedRoute><PurchaseOrderFormPage /></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute><InvoiceListPage /></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute><InvoiceFormPage /></ProtectedRoute>} />
              <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />
              <Route path="/invoices/:id/edit" element={<ProtectedRoute><InvoiceFormPage /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute><PaymentListPage /></ProtectedRoute>} />
              <Route path="/payments/new" element={<ProtectedRoute><PaymentFormPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
              <Route path="/users/new" element={<ProtectedRoute><UserFormPage /></ProtectedRoute>} />
              <Route path="/users/:id/edit" element={<ProtectedRoute><UserFormPage /></ProtectedRoute>} />
              <Route path="/settings/company" element={<ProtectedRoute><CompanySettingsPage /></ProtectedRoute>} />
              <Route path="/settings/audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
              <Route path="/accounting" element={<ProtectedRoute><AccountingPage /></ProtectedRoute>} />
              <Route path="/accounting/accounts" element={<ProtectedRoute><AccountListPage /></ProtectedRoute>} />
              <Route path="/accounting/accounts/new" element={<ProtectedRoute><AccountFormPage /></ProtectedRoute>} />
              <Route path="/accounting/accounts/:id/edit" element={<ProtectedRoute><AccountFormPage /></ProtectedRoute>} />
              <Route path="/accounting/journal-entries" element={<ProtectedRoute><JournalEntryListPage /></ProtectedRoute>} />
              <Route path="/accounting/journal-entries/new" element={<ProtectedRoute><JournalEntryFormPage /></ProtectedRoute>} />
              <Route path="/accounting/journal-entries/:id/edit" element={<ProtectedRoute><JournalEntryFormPage /></ProtectedRoute>} />
              <Route path="/accounting/journal-entries/post-drafts" element={<ProtectedRoute><PostDraftsPage /></ProtectedRoute>} />
              <Route path="/accounting/trial-balance" element={<ProtectedRoute><TrialBalancePage /></ProtectedRoute>} />
              <Route path="/accounting/profit-loss" element={<ProtectedRoute><ProfitLossPage /></ProtectedRoute>} />
              <Route path="/accounting/balance-sheet" element={<ProtectedRoute><BalanceSheetPage /></ProtectedRoute>} />
              <Route path="/accounting/bank" element={<ProtectedRoute><BankReconciliationPage /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
              <Route path="/inventory/warehouses" element={<ProtectedRoute><WarehouseListPage /></ProtectedRoute>} />
              <Route path="/inventory/warehouses/new" element={<ProtectedRoute><WarehouseFormPage /></ProtectedRoute>} />
              <Route path="/inventory/warehouses/:id/edit" element={<ProtectedRoute><WarehouseFormPage /></ProtectedRoute>} />
              <Route path="/inventory/warehouses/:id/stock" element={<ProtectedRoute><WarehouseStockPage /></ProtectedRoute>} />
              <Route path="/inventory/adjustments" element={<ProtectedRoute><StockAdjustmentListPage /></ProtectedRoute>} />
              <Route path="/inventory/adjustments/new" element={<ProtectedRoute><StockAdjustmentFormPage /></ProtectedRoute>} />
              <Route path="/inventory/batches" element={<ProtectedRoute><BatchListPage /></ProtectedRoute>} />
              <Route path="/inventory/batches/new" element={<ProtectedRoute><BatchFormPage /></ProtectedRoute>} />
              <Route path="/inventory/batches/:id/edit" element={<ProtectedRoute><BatchFormPage /></ProtectedRoute>} />
              <Route path="/inventory/serials" element={<ProtectedRoute><SerialListPage /></ProtectedRoute>} />
              <Route path="/inventory/serials/new" element={<ProtectedRoute><SerialFormPage /></ProtectedRoute>} />
              <Route path="/inventory/serials/:id/edit" element={<ProtectedRoute><SerialFormPage /></ProtectedRoute>} />
              <Route path="/inventory/transfers" element={<ProtectedRoute><StockTransferListPage /></ProtectedRoute>} />
              <Route path="/inventory/transfers/new" element={<ProtectedRoute><StockTransferFormPage /></ProtectedRoute>} />
              <Route path="/inventory/transfers/:id" element={<ProtectedRoute><StockTransferFormPage /></ProtectedRoute>} />
              <Route path="/inventory/movements" element={<ProtectedRoute><StockMovementsPage /></ProtectedRoute>} />
              <Route path="/inventory/stock-takes" element={<ProtectedRoute><StockTakeListPage /></ProtectedRoute>} />
              <Route path="/inventory/stock-takes/:id" element={<ProtectedRoute><StockTakeDetailPage /></ProtectedRoute>} />
              <Route path="/pos" element={<ProtectedRoute><RegisterPage /></ProtectedRoute>} />
              <Route path="/pos/intake" element={<ProtectedRoute><IntakePage /></ProtectedRoute>} />
              <Route path="/pos/display" element={<ProtectedRoute><DisplayPage /></ProtectedRoute>} />
              <Route path="/pos/members" element={<ProtectedRoute><MembersListPage /></ProtectedRoute>} />
              <Route path="/pos/members/new" element={<ProtectedRoute><MemberFormPage /></ProtectedRoute>} />
              <Route path="/pos/members/:id/edit" element={<ProtectedRoute><MemberFormPage /></ProtectedRoute>} />
              <Route path="/pos/vouchers" element={<ProtectedRoute><VouchersListPage /></ProtectedRoute>} />
              <Route path="/pos/vouchers/new" element={<ProtectedRoute><VoucherFormPage /></ProtectedRoute>} />
              <Route path="/pos/sales" element={<ProtectedRoute><SalesHistoryPage /></ProtectedRoute>} />
              <Route path="/pos/sales/:id" element={<ProtectedRoute><SaleDetailPage /></ProtectedRoute>} />
              <Route path="/repairs" element={<ProtectedRoute><RepairListPage /></ProtectedRoute>} />
              <Route path="/repairs/new" element={<ProtectedRoute><RepairFormPage /></ProtectedRoute>} />
              <Route path="/repairs/:id" element={<ProtectedRoute><RepairDetailPage /></ProtectedRoute>} />
              <Route path="/warranties" element={<ProtectedRoute><WarrantyListPage /></ProtectedRoute>} />
              <Route path="/warranties/:id" element={<ProtectedRoute><WarrantyDetailPage /></ProtectedRoute>} />
              <Route path="/oversight" element={<ProtectedRoute><OversightPage /></ProtectedRoute>} />
              <Route path="/oversight/item-trace" element={<ProtectedRoute><ItemTracePage /></ProtectedRoute>} />
              <Route path="/oversight/money-flow" element={<ProtectedRoute><MoneyFlowPage /></ProtectedRoute>} />
              <Route path="/oversight/exceptions" element={<ProtectedRoute><ExceptionsPage /></ProtectedRoute>} />
              <Route path="/oversight/cash-up" element={<ProtectedRoute><CashUpPage /></ProtectedRoute>} />
              <Route path="/oversight/my-day" element={<ProtectedRoute><MyDayPage /></ProtectedRoute>} />
              <Route path="/oversight/web-orders" element={<ProtectedRoute><WebOrdersPage /></ProtectedRoute>} />
              <Route path="/oversight/settings" element={<ProtectedRoute><CommercialTermsPage /></ProtectedRoute>} />
              {/* Public B2C storefront - anonymous, no ProtectedRoute wrapper. '/' used to redirect
                  straight to /dashboard; no e2e spec navigates to bare '/' (all post-login redirects
                  assert against LoginPage's own navigate('/dashboard') instead), so this is a clean
                  swap - see the SHOP frontend report for the full goto('/') grep.
                  Grouped under one CurrencyProvider (via Outlet) so the shopper's currency choice
                  persists across storefront navigation instead of resetting on every page mount -
                  see the CURRENCY module spec. */}
              <Route element={<CurrencyProvider><ShopAuthProvider><CartProvider><Outlet /></CartProvider></ShopAuthProvider></CurrencyProvider>}>
                <Route path="/" element={<StorefrontPage />} />
                <Route path="/shop/item/:sku" element={<StorefrontItemPage />} />
                <Route path="/shop/warranty" element={<WarrantyCheckPage />} />
                {/* Customer account area - ShopAuthProvider wraps the whole public route group
                    (not just these three) because PublicLayout's header reads shop auth state
                    on every public page to render "Sign in"/"My account" - see PublicLayout.
                    CartProvider wraps the same group (PublicLayout's cart icon reads it on every
                    public page too) - see CartContext. */}
                <Route path="/shop/login" element={<ShopLoginPage />} />
                <Route path="/shop/register" element={<ShopRegisterPage />} />
                <Route path="/shop/account" element={<ShopAccountPage />} />
                {/* WEBSHOP: cart/checkout/orders + postal trade-in quotes. */}
                <Route path="/shop/cart" element={<CartPage />} />
                <Route path="/shop/checkout" element={<CheckoutPage />} />
                <Route path="/shop/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
                <Route path="/shop/orders/lookup" element={<OrderLookupPage />} />
                <Route path="/shop/trade-in" element={<TradeInQuotePage />} />
                <Route path="/shop/trade-in/lookup" element={<TradeInQuoteLookupPage />} />
              </Route>
              {/* Catch-all: an unmatched path previously rendered nothing at all (Routes with
                  no match renders blank), leaving a real user on a dead page with no way back.
                  ProtectedRoute already resolves to /login when unauthenticated, so this lands
                  everyone somewhere navigable. */}
              <Route path="*" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
            </Routes>
            </Suspense>
          </Router>
        </ToastProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
