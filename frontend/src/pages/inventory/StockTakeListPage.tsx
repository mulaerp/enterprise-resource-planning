import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus } from 'lucide-react';
import Layout from '../../components/Layout';
import {
  DataTable,
  Button,
  Badge,
  Modal,
  ModalFooter,
  Select,
  Textarea,
  useToast,
  type Column,
} from '../../components/ui';
import api, { getErrorMessage } from '../../lib/api';

type StockTakeStatus = 'OPEN' | 'COUNTING' | 'REVIEW' | 'APPROVED' | 'CANCELLED';

interface StockTakeSession {
  id: string;
  sessionNumber: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  status: StockTakeStatus;
  openedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  notes: string | null;
  totalLines: number;
  countedLines: number;
  varianceLines: number;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

const STATUS_FILTERS: Array<{ value: StockTakeStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'COUNTING', label: 'Counting' },
  { value: 'REVIEW', label: 'In Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function statusBadgeVariant(status: StockTakeStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'REVIEW':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    case 'COUNTING':
      return 'info';
    default:
      return 'default';
  }
}

export default function StockTakeListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [sessions, setSessions] = useState<StockTakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StockTakeStatus | ''>('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newWarehouseId, setNewWarehouseId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), size: '20' });
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/inventory/stock-takes?${params}`);
      setSessions(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load stock takes'));
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = async () => {
    setNewModalOpen(true);
    if (warehouses.length === 0) {
      try {
        const response = await api.get('/warehouses?size=100');
        setWarehouses(response.data.content);
        if (response.data.content.length > 0) {
          setNewWarehouseId(response.data.content[0].id);
        }
      } catch (err) {
        showError(getErrorMessage(err, 'Failed to load warehouses'));
      }
    }
  };

  const handleOpenSession = async () => {
    if (!newWarehouseId) {
      showError('Select a warehouse');
      return;
    }
    setOpening(true);
    try {
      const response = await api.post('/inventory/stock-takes', {
        warehouseId: newWarehouseId,
        notes: newNotes || undefined,
      });
      success('Stock take opened');
      setNewModalOpen(false);
      setNewNotes('');
      navigate(`/inventory/stock-takes/${response.data.id}`);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to open stock take'));
    } finally {
      setOpening(false);
    }
  };

  const columns: Column<StockTakeSession>[] = [
    { key: 'sessionNumber', header: 'Session #' },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (s) => (
        <span>
          {s.warehouseName} <span className="text-slate-400">({s.warehouseCode})</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <Badge variant={statusBadgeVariant(s.status)}>{s.status}</Badge>,
    },
    {
      key: 'variance',
      header: 'Variance',
      render: (s) =>
        s.varianceLines > 0 ? (
          <Badge variant="warning">{s.varianceLines} variance{s.varianceLines === 1 ? '' : 's'}</Badge>
        ) : (
          <span className="text-slate-400">
            {s.countedLines}/{s.totalLines} counted
          </span>
        ),
    },
    {
      key: 'openedAt',
      header: 'Opened',
      render: (s) => new Date(s.openedAt).toLocaleString('en-MY'),
    },
    {
      key: 'approvedAt',
      header: 'Approved',
      render: (s) =>
        s.approvedAt ? (
          <span className="text-xs text-slate-500">
            {new Date(s.approvedAt).toLocaleString('en-MY')} by {s.approvedBy}
          </span>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Stock Takes</h1>
            <p className="text-sm text-slate-500 mt-1">Guided physical count sessions per warehouse</p>
          </div>
          <Button onClick={openNewModal} icon={<Plus className="w-4 h-4" />}>
            New Stock Take
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value || 'all'}
              onClick={() => {
                setStatusFilter(filter.value);
                setPage(0);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                statusFilter === filter.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={sessions}
          keyExtractor={(s) => s.id}
          loading={loading}
          emptyMessage="No stock takes found"
          onRowClick={(s) => navigate(`/inventory/stock-takes/${s.id}`)}
          pagination={{ currentPage: page, totalPages, onPageChange: setPage }}
        />
      </div>

      <Modal isOpen={newModalOpen} onClose={() => setNewModalOpen(false)} title="Open a Stock Take" size="sm">
        <div className="space-y-4">
          <Select
            label="Warehouse"
            required
            value={newWarehouseId}
            onChange={(e) => setNewWarehouseId(e.target.value)}
            options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
          />
          <Textarea
            label="Notes"
            rows={3}
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Optional context for this count"
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setNewModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleOpenSession} loading={opening}>
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Open Stock Take
          </Button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
