import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import { DataTable, Badge, useToast, type Column } from '../../components/ui';

interface PosSaleSummary {
  id: string;
  saleNumber: string;
  createdAt: string;
  createdBy: string | null;
  paymentMethod: string;
  total: number;
  netCashAmount: number;
  status: 'COMPLETED' | 'VOIDED';
}

interface PageResponse {
  content: PosSaleSummary[];
  totalPages: number;
  number: number;
}

/** Sales history list - V34 gives every sale a status (COMPLETED/VOIDED); the void action itself
 * lives on SaleDetailPage.tsx (MANAGER/ADMIN only - see RoleRules.MANAGER_UP). */
export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [sales, setSales] = useState<PosSaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchSales(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchSales = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await api.get<PageResponse>('/pos/sales', { params: { page: pageNumber, size: 20 } });
      setSales(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load sales history'));
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<PosSaleSummary>[] = [
    {
      key: 'saleNumber',
      header: 'Sale',
      render: (sale) => <span className="font-mono text-sm text-slate-900">{sale.saleNumber}</span>,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (sale) => new Date(sale.createdAt).toLocaleString(),
    },
    {
      key: 'createdBy',
      header: 'Cashier',
      render: (sale) => sale.createdBy ?? 'unknown',
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
      render: (sale) => <Badge variant="default" size="sm">{sale.paymentMethod}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      render: (sale) => <span className="tabular-nums">{formatMoney(sale.netCashAmount ?? sale.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (sale) => (
        <Badge variant={sale.status === 'VOIDED' ? 'danger' : 'success'} size="sm">
          {sale.status}
        </Badge>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Point of Sale
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">Sales History</h1>
          <p className="text-sm text-slate-500 mt-1">Every PoS sale, completed or voided - open a sale to void it (managers only).</p>
        </div>

        <DataTable
          data={sales}
          columns={columns}
          keyExtractor={(sale) => sale.id}
          loading={loading}
          emptyMessage="No sales recorded yet"
          onRowClick={(sale) => navigate(`/pos/sales/${sale.id}`)}
          pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        />
      </div>
    </Layout>
  );
}
