import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api, getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { useToast } from '../../components/ui/Toast';
import Layout from '../../components/Layout';

// WP3: how many units a line can have before the "one serial number per line" textarea stops
// being practical - past this, tracking is still possible via the batch fields, just not serials.
const MAX_SERIAL_ENTRY_QUANTITY = 20;

interface ReceiveTrackingEntry {
  batchNumber: string;
  expiryDate: string;
  serialNumbers: string;
}

interface PurchaseOrderItem {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  receivedQuantity?: number;
}

interface PurchaseOrderDetail {
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDate?: string;
  status: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [po, setPo] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // WP3: optional receiving details (batch/serial) collected before confirming RECEIVED.
  // Entirely optional - "Receive without tracking" below skips all of it, unchanged from before.
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [receiveTracking, setReceiveTracking] = useState<Record<string, ReceiveTrackingEntry>>({});

  useEffect(() => {
    fetchPurchaseOrder();
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/purchase-orders/${id}`);
      setPo(response.data);
    } catch {
      showToast('error', 'Failed to fetch purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string, body?: { items: unknown[] }) => {
    try {
      await api.patch(`/purchase-orders/${id}/status?status=${status}`, body);
      showToast('success', 'Status updated successfully');
      setReceivingOpen(false);
      setReceiveTracking({});
      fetchPurchaseOrder();
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Failed to update status'));
    }
  };

  const updateReceiveField = (itemId: string, field: keyof ReceiveTrackingEntry, value: string) => {
    setReceiveTracking((prev) => {
      const existing: ReceiveTrackingEntry = prev[itemId] || { batchNumber: '', expiryDate: '', serialNumbers: '' };
      return { ...prev, [itemId]: { ...existing, [field]: value } };
    });
  };

  /** Builds the optional tracking body for RECEIVED - only items with something filled in are sent. */
  const confirmReceipt = () => {
    const items = (po?.items || [])
      .map((item: PurchaseOrderItem) => {
        const entry = receiveTracking[item.id];
        if (!entry) return null;

        const batchNumber = entry.batchNumber?.trim();
        const serialNumbers = (entry.serialNumbers || '')
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        if (!batchNumber && serialNumbers.length === 0) return null;

        return {
          itemId: item.id,
          ...(batchNumber ? { batchNumber, expiryDate: entry.expiryDate || null } : {}),
          ...(serialNumbers.length > 0 ? { serialNumbers } : {}),
        };
      })
      .filter((entry: unknown): entry is Record<string, unknown> => entry !== null);

    handleStatusChange('RECEIVED', items.length > 0 ? { items } : undefined);
  };

  if (loading) {
    return <Layout><div>Loading...</div></Layout>;
  }

  if (!po) {
    return <Layout><div>Purchase order not found</div></Layout>;
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
      DRAFT: 'default',
      SENT: 'warning',
      RECEIVED: 'success',
      CANCELLED: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <Layout>
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold text-slate-900">Purchase Order {po.poNumber}</h1>
        {getStatusBadge(po.status)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">Order Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-slate-500">PO Number</dt>
              <dd className="font-medium">{po.poNumber}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Supplier</dt>
              <dd className="font-medium">{po.supplierName}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Order Date</dt>
              <dd className="font-medium">{new Date(po.orderDate).toLocaleDateString()}</dd>
            </div>
            {po.expectedDate && (
              <div>
                <dt className="text-sm text-slate-500">Expected Date</dt>
                <dd className="font-medium">{new Date(po.expectedDate).toLocaleDateString()}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-slate-500">Status</dt>
              <dd className="font-medium">{po.status}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            {po.status === 'DRAFT' && (
              <>
                <Link to={`/purchase-orders/${id}/edit`} className="block">
                  <Button className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Purchase Order
                  </Button>
                </Link>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => handleStatusChange('SENT')}
                >
                  Mark as Sent
                </Button>
              </>
            )}
            {po.status === 'SENT' && !receivingOpen && (
              <>
                <Button
                  className="w-full"
                  onClick={() => setReceivingOpen(true)}
                >
                  Mark as Received
                </Button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('RECEIVED')}
                  className="w-full text-xs text-slate-500 hover:text-brand-600 py-1"
                >
                  Receive without batch/serial tracking
                </button>
              </>
            )}
            {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => handleStatusChange('CANCELLED')}
              >
                Cancel Order
              </Button>
            )}
          </div>
        </div>
      </div>

      {po.status === 'SENT' && receivingOpen && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Receiving details (optional)</h2>
            <button
              type="button"
              onClick={() => setReceivingOpen(false)}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Collapse
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            For each line, optionally give the received units a batch number + expiry date, and/or
            list individual serial numbers (one per line). Leave a line blank to receive it
            untracked - exactly as before.
          </p>
          <div className="space-y-4">
            {po.items.map((item: PurchaseOrderItem) => {
              const entry = receiveTracking[item.id] || { batchNumber: '', expiryDate: '', serialNumbers: '' };
              return (
                <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {entry.batchNumber || entry.serialNumbers ? (
                      <ChevronDown className="h-4 w-4 text-brand-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <p className="font-medium">{item.productName}</p>
                    <span className="text-sm text-slate-500">
                      ({item.productSku}, qty {item.quantity})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Batch number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. B-001"
                        value={entry.batchNumber}
                        onChange={(e) => updateReceiveField(item.id, 'batchNumber', e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Expiry date
                      </label>
                      <input
                        type="date"
                        value={entry.expiryDate}
                        onChange={(e) => updateReceiveField(item.id, 'expiryDate', e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    {item.quantity <= MAX_SERIAL_ENTRY_QUANTITY && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Serial numbers (one per line, max {item.quantity})
                        </label>
                        <textarea
                          rows={2}
                          placeholder={'SN-1\nSN-2'}
                          value={entry.serialNumbers}
                          onChange={(e) => updateReceiveField(item.id, 'serialNumbers', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={confirmReceipt}>Confirm Receipt</Button>
            <Button variant="ghost" onClick={() => { setReceivingOpen(false); setReceiveTracking({}); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-4">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Product</th>
                <th className="text-right py-2">Quantity</th>
                <th className="text-right py-2">Unit Price</th>
                <th className="text-right py-2">Tax Rate</th>
                <th className="text-right py-2">Total</th>
                <th className="text-right py-2">Received</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item: PurchaseOrderItem) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-slate-500">{item.productSku}</p>
                    </div>
                  </td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">{formatMoney(item.unitPrice)}</td>
                  <td className="text-right py-2">{item.taxRate}%</td>
                  <td className="text-right py-2">{formatMoney(item.total)}</td>
                  <td className="text-right py-2">{item.receivedQuantity || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatMoney(po.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>{formatMoney(po.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatMoney(po.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {po.notes && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-slate-700">{po.notes}</p>
        </div>
      )}
    </div>
    </Layout>
  );
}
