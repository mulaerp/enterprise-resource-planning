import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, AlertTriangle, ShieldCheck } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { DataTable, Badge, Button, Modal, ModalFooter, Textarea, useToast, type Column } from '../../components/ui';
import type { ShopOrder, OrderStatus } from '../../lib/shop-types';

interface PageResponse {
  content: ShopOrder[];
  totalPages: number;
  number: number;
}

interface VoidResponse {
  order: ShopOrder;
  refundMethod: string;
  refundAmount: number;
  stockReturned: Array<{ productId: string; sku: string; productName: string; quantity: number }>;
  storeCreditReversed: number;
  pointsDeducted: number;
  warrantiesVoided: string[];
}

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'default',
  RESERVED: 'warning',
  AWAITING_PAYMENT: 'warning',
  PAID: 'info',
  READY: 'info',
  FULFILLED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  VOIDED: 'danger',
};

/**
 * Staff-facing web-order management (WEBSHOP Gap C) - there was no staff UI at all for
 * order/quote admin actions before this (order admin was API-only, see the webshop skill); this
 * page is the home for it, under Oversight since managing collected/dispatched web orders is
 * branch-manager territory the same way cash-up/exceptions are. Every action here already existed
 * as a staff API (RoleRules.SHOP_ORDER_STAFF for ready/fulfil, RoleRules.MANAGER_UP for
 * cancel/void) - this page just gives staff a way to reach them without curling the API directly.
 */
export default function WebOrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<ShopOrder | null>(null);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidSummary, setVoidSummary] = useState<VoidResponse | null>(null);

  // MANAGER_UP backs POST .../void server-side (RoleRules.MANAGER_UP) - a cashier hitting the
  // button directly still gets a 403 from the API; this just keeps the button itself hidden for
  // the role that can't use it, same pattern as SaleDetailPage's canVoid.
  const canVoid = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  useEffect(() => {
    fetchOrders(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchOrders = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await api.get<PageResponse>('/shop/admin/orders', {
        params: { page: pageNumber, size: 20, sort: 'createdAt,desc' },
      });
      setOrders(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load web orders'));
    } finally {
      setLoading(false);
    }
  };

  const handleReady = async (order: ShopOrder) => {
    setBusyId(order.id);
    try {
      await api.post(`/shop/admin/orders/${order.id}/ready`);
      showSuccess(`Order ${order.orderNumber} marked ready`);
      fetchOrders(page);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to mark order ready'));
    } finally {
      setBusyId(null);
    }
  };

  const handleFulfil = async (order: ShopOrder) => {
    setBusyId(order.id);
    try {
      const response = await api.post<ShopOrder>(`/shop/admin/orders/${order.id}/fulfil`, {});
      const numbers = response.data.warrantyNumbers;
      showSuccess(
        `Order ${order.orderNumber} fulfilled` + (numbers.length > 0 ? ` - warranty issued: ${numbers.join(', ')}` : '')
      );
      fetchOrders(page);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to fulfil order'));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (order: ShopOrder) => {
    setBusyId(order.id);
    try {
      await api.post(`/shop/admin/orders/${order.id}/cancel`);
      showSuccess(`Order ${order.orderNumber} cancelled, stock released`);
      fetchOrders(page);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to cancel order'));
    } finally {
      setBusyId(null);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget || !reason.trim()) return;
    setVoiding(true);
    try {
      const response = await api.post<VoidResponse>(`/shop/admin/orders/${voidTarget.id}/void`, { reason: reason.trim() });
      setVoidSummary(response.data);
      setReason('');
      showSuccess(
        `Order ${response.data.order.orderNumber} voided. Refund ${response.data.refundAmount > 0 ? formatMoney(response.data.refundAmount) : 'none'} owed via ${response.data.refundMethod}.`
      );
      fetchOrders(page);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to void order'));
    } finally {
      setVoiding(false);
    }
  };

  const closeVoidModal = () => {
    if (voiding) return;
    setVoidTarget(null);
    setVoidSummary(null);
    setReason('');
  };

  const columns: Column<ShopOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order',
      render: (order) => <span className="font-mono text-sm text-slate-900">{order.orderNumber}</span>,
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (order) => (order.shopCustomerId ? 'Member' : (order.guestName ?? 'Guest')),
    },
    {
      key: 'createdAt',
      header: 'Placed',
      render: (order) => new Date(order.createdAt).toLocaleString(),
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      render: (order) => <span className="tabular-nums">{formatMoney(order.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <Badge variant={STATUS_VARIANT[order.status]} size="sm">
          {order.status}
        </Badge>
      ),
    },
    {
      key: 'warranty',
      header: 'Warranty',
      render: (order) =>
        order.warrantyNumbers.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            {order.warrantyNumbers.length}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {order.status === 'RESERVED' && (
            <Button size="sm" variant="secondary" loading={busyId === order.id} onClick={() => handleReady(order)}>
              Mark ready
            </Button>
          )}
          {(order.status === 'RESERVED' || order.status === 'READY') && (
            <Button size="sm" loading={busyId === order.id} onClick={() => handleFulfil(order)}>
              Fulfil
            </Button>
          )}
          {(order.status === 'RESERVED' || order.status === 'AWAITING_PAYMENT') && (
            <Button size="sm" variant="secondary" loading={busyId === order.id} onClick={() => handleCancel(order)}>
              Cancel
            </Button>
          )}
          {order.status === 'FULFILLED' && canVoid && (
            <Button
              size="sm"
              variant="danger"
              icon={<Ban className="w-3.5 h-3.5" />}
              onClick={() => setVoidTarget(order)}
            >
              Void
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/oversight')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Oversight
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">Web Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage online storefront orders - mark ready, hand over/fulfil, cancel a reservation, or void a
            completed order (managers only).
          </p>
        </div>

        <DataTable
          data={orders}
          columns={columns}
          keyExtractor={(order) => order.id}
          loading={loading}
          emptyMessage="No web orders yet"
          pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        />
      </div>

      <Modal isOpen={!!voidTarget} onClose={closeVoidModal} title="Void Web Order" size="sm">
        {voidTarget && !voidSummary && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-medium">
                  This reverses order <span className="font-mono">{voidTarget.orderNumber}</span>:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Stock is returned to inventory.</li>
                  <li>The revenue/COGS journal entries this order posted at fulfilment are reversed.</li>
                  <li>Any points earned or store credit redeemed on this order are reversed.</li>
                  <li>Any warranty issued from this order is VOIDed.</li>
                </ul>
                <p>This cannot be undone.</p>
              </div>
            </div>
            <Textarea
              label="Reason for void"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. customer returned the item, refund agreed"
              rows={3}
            />
          </div>
        )}
        {voidSummary && (
          <div className="space-y-2 text-sm text-slate-700">
            <p className="font-medium text-slate-900">
              Order {voidSummary.order.orderNumber} voided.
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {voidSummary.stockReturned.map((item) => (
                <li key={item.productId}>
                  {item.quantity}x {item.productName} ({item.sku}) returned to stock
                </li>
              ))}
              <li>
                Refund owed: {formatMoney(voidSummary.refundAmount)} via {voidSummary.refundMethod}
              </li>
              {voidSummary.storeCreditReversed > 0 && (
                <li>Store credit {formatMoney(voidSummary.storeCreditReversed)} credited back to the member</li>
              )}
              {voidSummary.pointsDeducted > 0 && <li>{voidSummary.pointsDeducted} points deducted from the member</li>}
              {voidSummary.warrantiesVoided.length > 0 && (
                <li>Warranty VOIDed: {voidSummary.warrantiesVoided.join(', ')}</li>
              )}
            </ul>
          </div>
        )}
        <ModalFooter>
          {!voidSummary ? (
            <>
              <Button variant="secondary" onClick={closeVoidModal} disabled={voiding}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleVoid} loading={voiding} disabled={!reason.trim()}>
                Void Order
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={closeVoidModal}>
              Close
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
