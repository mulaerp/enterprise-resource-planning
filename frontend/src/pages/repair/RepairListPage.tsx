import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShieldCheck } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import {
  DataTable,
  SearchInput,
  Button,
  useToast,
  type Column,
} from '../../components/ui';
import {
  REPAIR_FLOW,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_BADGE_CLASSES,
  type RepairStatus,
} from '../../lib/repair-status';

interface RepairSummary {
  id: string;
  jobNumber: string;
  customerId?: string;
  customerName?: string;
  walkInName?: string;
  deviceDescription: string;
  status: RepairStatus;
  totalCost: number;
  isWarrantyClaim: boolean;
}

const FILTERS: Array<RepairStatus | 'ALL'> = ['ALL', ...REPAIR_FLOW, 'CANCELLED'];

export default function RepairListPage() {
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [repairs, setRepairs] = useState<RepairSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchRepairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const fetchRepairs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), size: '10' });
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const response = await api.get(`/repairs?${params}`);
      setRepairs(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch repairs:', err);
      showError(getErrorMessage(err, 'Failed to load repairs'));
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<RepairSummary>[] = [
    {
      key: 'jobNumber',
      header: 'Job Number',
      render: (repair) => <span className="font-medium text-slate-900">{repair.jobNumber}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (repair) => (
        <span>{repair.customerName || repair.walkInName || '-'}</span>
      ),
    },
    {
      key: 'deviceDescription',
      header: 'Device',
      render: (repair) => <span className="text-slate-600">{repair.deviceDescription}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (repair) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded-full border ${REPAIR_STATUS_BADGE_CLASSES[repair.status]}`}
        >
          {repair.isWarrantyClaim && <ShieldCheck className="w-3.5 h-3.5" />}
          {REPAIR_STATUS_LABELS[repair.status]}
        </span>
      ),
    },
    {
      key: 'totalCost',
      header: 'Total',
      className: 'text-right',
      render: (repair) => formatMoney(repair.totalCost),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Repairs</h1>
            <p className="text-sm text-slate-500 mt-1">Track intake, diagnosis, and collection of repair jobs</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/warranties')}
              icon={<ShieldCheck className="w-5 h-5" />}
            >
              Warranties
            </Button>
            <Button onClick={() => navigate('/repairs/new')} icon={<Plus className="w-5 h-5" />}>
              New Repair
            </Button>
          </div>
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
                {status === 'ALL' ? 'All' : REPAIR_STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          <SearchInput
            aria-label="Search repairs"
            placeholder="Search by job number, customer, or device..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={repairs}
            columns={columns}
            keyExtractor={(repair) => repair.id}
            loading={loading}
            emptyMessage="No repair jobs found."
            onRowClick={(repair) => navigate(`/repairs/${repair.id}`)}
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
