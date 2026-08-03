import { useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card, DataTable, Select, Input, Button, Badge, useToast, type Column } from '../../components/ui';
import ProductSelector from '../../components/business/ProductSelector';
import api from '../../lib/api';

interface StockMovement {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  warehouseId: string | null;
  movementType: string;
  quantityDelta: number;
  quantityAfter: number | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface ReconcileResult {
  productId: string;
  currentStock: number;
  ledgerSum: number;
  baselineOffset: number | null;
  consistent: boolean | null;
  note: string;
}

const MOVEMENT_TYPES = ['ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'POS_SALE', 'SO_DELIVERY', 'PO_RECEIPT', 'RECOUNT'];

const TYPE_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  ADJUSTMENT: 'info',
  RECOUNT: 'info',
  TRANSFER_OUT: 'warning',
  TRANSFER_IN: 'success',
  POS_SALE: 'danger',
  SO_DELIVERY: 'danger',
  PO_RECEIPT: 'success',
};

/**
 * WP7: read-only view over the append-only stock movement ledger recorded by
 * StockMovementService.recordMovement (backend). This page only reads via
 * GET /api/v1/inventory/movements and GET /api/v1/inventory/movements/reconcile/{productId} -
 * it never writes movements itself (counters + the ledger are both written only from the
 * services that mutate stock: adjustments, transfers, PoS sales, PO receiving, SO delivery).
 */
export default function StockMovementsPage() {
  const { error: showError } = useToast();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  useEffect(() => {
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, size: 20 };
      if (productId) params.productId = productId;
      if (movementType) params.movementType = movementType;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/inventory/movements', { params });
      setMovements(response.data.content || []);
      setTotalPages(response.data.totalPages ?? 0);
    } catch (err) {
      console.error('Failed to fetch stock movements:', err);
      showError('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  const fetchReconcile = async (id: string) => {
    if (!id) {
      setReconcile(null);
      return;
    }
    try {
      setReconcileLoading(true);
      const response = await api.get(`/inventory/movements/reconcile/${id}`);
      setReconcile(response.data);
    } catch (err) {
      console.error('Failed to fetch reconciliation:', err);
      showError('Failed to load reconciliation for this product');
      setReconcile(null);
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(0);
    fetchMovements();
    fetchReconcile(productId);
  };

  const handleReset = () => {
    setProductId('');
    setMovementType('');
    setStartDate('');
    setEndDate('');
    setReconcile(null);
    setPage(0);
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (m) => new Date(m.createdAt).toLocaleString(),
    },
    {
      key: 'productName',
      header: 'Product',
      render: (m) => (
        <div>
          <div className="font-medium text-slate-900">{m.productName}</div>
          <div className="text-xs text-slate-500">{m.productSku}</div>
        </div>
      ),
    },
    {
      key: 'movementType',
      header: 'Type',
      render: (m) => (
        <Badge variant={TYPE_BADGE_VARIANT[m.movementType] || 'default'} size="sm">
          {m.movementType}
        </Badge>
      ),
    },
    {
      key: 'quantityDelta',
      header: 'Delta',
      render: (m) => (
        <span className={m.quantityDelta >= 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
          {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
        </span>
      ),
    },
    { key: 'quantityAfter', header: 'Total After' },
    { key: 'reference', header: 'Reference' },
    {
      key: 'notes',
      header: 'Notes',
      render: (m) => (
        <span className="text-xs text-slate-600 whitespace-normal break-words max-w-md block">
          {m.notes || '—'}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ListTree className="text-brand-600" size={28} />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Stock Movements</h1>
            <p className="text-sm text-slate-500 mt-1">
              Append-only ledger of every stock-affecting event (adjustments, transfers, PoS sales, PO
              receipts, SO deliveries) - a read-only audit trail alongside the live stock counters.
            </p>
          </div>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ProductSelector
              label="Product"
              value={productId}
              onChange={(id) => setProductId(id)}
            />

            <Select
              label="Movement Type"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="">All</option>
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>

            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={handleFilter} loading={loading}>Apply Filters</Button>
            <Button variant="ghost" onClick={handleReset}>Reset</Button>
          </div>
        </Card>

        {productId && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Reconciliation</h2>
            {reconcileLoading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : reconcile ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Current Stock</div>
                  <div className="text-lg font-semibold text-slate-900">{reconcile.currentStock}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Ledger Sum</div>
                  <div className="text-lg font-semibold text-slate-900">{reconcile.ledgerSum}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Baseline Offset</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {reconcile.baselineOffset ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Consistent</div>
                  <div>
                    {reconcile.consistent === null ? (
                      <Badge variant="default" size="sm">Unknown</Badge>
                    ) : reconcile.consistent ? (
                      <Badge variant="success" size="sm">Yes</Badge>
                    ) : (
                      <Badge variant="danger" size="sm">No</Badge>
                    )}
                  </div>
                </div>
                <p className="col-span-2 md:col-span-4 text-xs text-slate-500 mt-1">{reconcile.note}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a product and apply filters to reconcile.</p>
            )}
          </Card>
        )}

        <DataTable
          data={movements}
          columns={columns}
          keyExtractor={(m) => m.id}
          loading={loading}
          emptyMessage="No stock movements found"
          pagination={{
            currentPage: page,
            totalPages,
            onPageChange: setPage,
          }}
        />
      </div>
    </Layout>
  );
}
