import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { DataTable, SearchInput, Button, Badge, useToast, type Column } from '../../components/ui';

type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID';

interface WarrantySummary {
  id: string;
  warrantyNumber: string;
  productName: string;
  expiryDate: string;
  status: WarrantyStatus;
}

const FILTERS: Array<WarrantyStatus | 'ALL'> = ['ALL', 'ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID'];

const STATUS_VARIANT: Record<WarrantyStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  EXPIRED: 'default',
  CLAIMED: 'info',
  VOID: 'danger',
};

export default function WarrantyListPage() {
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [warranties, setWarranties] = useState<WarrantySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WarrantyStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchWarranties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const fetchWarranties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), size: '10' });
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const response = await api.get(`/warranties?${params}`);
      setWarranties(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch warranties:', err);
      showError(getErrorMessage(err, 'Failed to load warranties'));
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<WarrantySummary>[] = [
    {
      key: 'warrantyNumber',
      header: 'Number',
      render: (w) => <span className="font-medium text-slate-900">{w.warrantyNumber}</span>,
    },
    {
      key: 'productName',
      header: 'Product',
    },
    {
      key: 'expiryDate',
      header: 'Expiry',
      render: (w) => new Date(w.expiryDate).toLocaleDateString(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => <Badge variant={STATUS_VARIANT[w.status]}>{w.status}</Badge>,
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Warranties</h1>
            <p className="text-sm text-slate-500 mt-1">Issued warranties and their claim status</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/repairs')} icon={<Wrench className="w-5 h-5" />}>
            Repairs
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  statusFilter === status
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {status === 'ALL' ? 'All' : status}
              </button>
            ))}
          </div>

          <SearchInput
            aria-label="Search warranties"
            placeholder="Search by warranty number or product..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={warranties}
            columns={columns}
            keyExtractor={(w) => w.id}
            loading={loading}
            emptyMessage="No warranties found."
            onRowClick={(w) => navigate(`/warranties/${w.id}`)}
            pagination={{
              currentPage: page,
              totalPages,
              onPageChange: setPage,
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
