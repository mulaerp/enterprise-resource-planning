import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';
import type { Column } from '../../components/ui';

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface WarehouseStockRow {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
}

export default function WarehouseStockPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stock, setStock] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [warehouseRes, stockRes] = await Promise.all([
        api.get(`/warehouses/${id}`),
        api.get(`/warehouses/${id}/stock`),
      ]);
      setWarehouse(warehouseRes.data);
      setStock(stockRes.data.content || stockRes.data);
    } catch (err) {
      console.error('Failed to fetch warehouse stock:', err);
      showError('Failed to load warehouse stock');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<WarehouseStockRow>[] = [
    {
      key: 'productSku',
      header: 'SKU',
      render: (row) => <span className="font-medium text-slate-900">{row.productSku}</span>,
    },
    { key: 'productName', header: 'Product' },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (row) => <span className="tabular-nums">{row.quantity}</span>,
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <button
            onClick={() => navigate('/inventory/warehouses')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Warehouses
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Warehouse Stock</h1>
              <p className="text-sm text-slate-500 mt-1">
                {warehouse ? `${warehouse.name} (${warehouse.code})` : 'Stock levels for this warehouse'}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/inventory/warehouses/${id}/edit`)}
            >
              Edit Warehouse
            </Button>
          </div>
        </div>

        <DataTable
          data={stock}
          columns={columns}
          keyExtractor={(row) => row.productId}
          loading={loading}
          emptyMessage="No stock recorded for this warehouse."
        />
      </div>
    </Layout>
  );
}
