import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Send, XCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Modal,
  ModalFooter,
  useToast,
} from '../../components/ui';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

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

interface StockTakeLine {
  id: string;
  sessionId: string;
  productId: string;
  productSku: string;
  productName: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  note: string | null;
}

interface DraftLine {
  counted: string;
  note: string;
}

const PAGE_SIZE = 50;
const STOCK_WRITER_ROLES = ['ADMIN', 'MANAGER', 'INVENTORY'];
const APPROVER_ROLES = ['ADMIN', 'MANAGER'];

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

function varianceDisplay(variance: number | null) {
  if (variance === null) return <span className="text-slate-400">-</span>;
  if (variance === 0) return <span className="text-slate-500 tabular-nums">0</span>;
  return (
    <span className={`font-medium tabular-nums ${variance < 0 ? 'text-red-600' : 'text-amber-600'}`}>
      {variance > 0 ? '+' : ''}
      {variance}
    </span>
  );
}

export default function StockTakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [lines, setLines] = useState<StockTakeLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});
  const [loading, setLoading] = useState(true);
  const [linesLoading, setLinesLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [onlyVariances, setOnlyVariances] = useState(false);
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const canWrite = STOCK_WRITER_ROLES.includes(user?.role ?? '');
  const canApprove = APPROVER_ROLES.includes(user?.role ?? '');
  const canEditCounts = canWrite && (session?.status === 'OPEN' || session?.status === 'COUNTING');

  const fetchSession = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get(`/inventory/stock-takes/${id}`);
      setSession(response.data);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load stock take'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLines = useCallback(async () => {
    if (!id) return;
    try {
      setLinesLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: PAGE_SIZE.toString(),
        onlyVariances: onlyVariances.toString(),
      });
      const response = await api.get(`/inventory/stock-takes/${id}/lines?${params}`);
      const content: StockTakeLine[] = response.data.content;
      setLines(content);
      setTotalPages(response.data.totalPages);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const line of content) {
          if (!next[line.id]) {
            next[line.id] = {
              counted: line.countedQuantity !== null ? String(line.countedQuantity) : '',
              note: line.note ?? '',
            };
          }
        }
        return next;
      });
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load count sheet'));
    } finally {
      setLinesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, onlyVariances]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const updateDraft = (lineId: string, patch: Partial<DraftLine>) => {
    setDrafts((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));
  };

  const saveLine = async (line: StockTakeLine) => {
    const draft = drafts[line.id];
    if (!draft || draft.counted.trim() === '') return;
    const countedQuantity = Number(draft.counted);
    if (Number.isNaN(countedQuantity)) return;
    // No-op if nothing actually changed since the last save - avoids a network call every time
    // focus merely passes through a row without an edit.
    if (countedQuantity === line.countedQuantity && draft.note === (line.note ?? '')) return;

    setSavingLineId(line.id);
    try {
      const response = await api.put(`/inventory/stock-takes/${session?.id}/lines/${line.id}`, {
        countedQuantity,
        note: draft.note || undefined,
      });
      const updated: StockTakeLine = response.data;
      setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      fetchSession();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to save count'));
    } finally {
      setSavingLineId(null);
    }
  };

  const handleCountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Blur triggers the save via onBlur below, then focus moves to the next row's count input.
      (e.target as HTMLInputElement).blur();
      const next = inputRefs.current[rowIndex + 1];
      next?.focus();
      next?.select();
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const response = await api.post(`/inventory/stock-takes/${session.id}/submit`);
      setSession(response.data);
      success('Stock take submitted for review');
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to submit stock take'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!session) return;
    if (!confirm(`Cancel stock take ${session.sessionNumber}? This has no stock effect.`)) return;
    setCancelling(true);
    try {
      const response = await api.post(`/inventory/stock-takes/${session.id}/cancel`);
      setSession(response.data);
      success('Stock take cancelled');
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to cancel stock take'));
    } finally {
      setCancelling(false);
    }
  };

  const handleApprove = async () => {
    if (!session) return;
    setApproving(true);
    try {
      const response = await api.post(`/inventory/stock-takes/${session.id}/approve`);
      setSession(response.data);
      setApproveModalOpen(false);
      success('Stock take approved - adjustments created');
      fetchLines();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to approve stock take'));
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">Loading...</div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-slate-500">Stock take not found.</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/inventory/stock-takes')}>
            Back to Stock Takes
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{session.sessionNumber}</h1>
              <Badge variant={statusBadgeVariant(session.status)}>{session.status}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {session.warehouseName} ({session.warehouseCode}) &middot; opened{' '}
              {new Date(session.openedAt).toLocaleString('en-MY')}
            </p>
            {session.notes && <p className="text-sm text-slate-600 mt-1">{session.notes}</p>}
            {session.approvedAt && (
              <p className="text-xs text-slate-500 mt-1">
                Approved {new Date(session.approvedAt).toLocaleString('en-MY')} by {session.approvedBy}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {(session.status === 'OPEN' || session.status === 'COUNTING') && (
              <Button onClick={handleSubmit} loading={submitting} icon={<Send className="w-4 h-4" />}>
                Submit for Review
              </Button>
            )}
            {session.status === 'REVIEW' && canApprove && (
              <Button onClick={() => setApproveModalOpen(true)} icon={<CheckCircle2 className="w-4 h-4" />}>
                Approve
              </Button>
            )}
            {session.status !== 'APPROVED' && session.status !== 'CANCELLED' && (
              <Button
                variant="danger"
                onClick={handleCancel}
                loading={cancelling}
                icon={<XCircle className="w-4 h-4" />}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card padding="sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Lines</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{session.totalLines}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Counted</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">
              {session.countedLines} / {session.totalLines}
            </p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Variances</p>
            <p className={`text-2xl font-semibold tabular-nums ${session.varianceLines > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {session.varianceLines}
            </p>
          </Card>
        </div>

        <Card padding="none" className="overflow-hidden">
          <CardHeader className="p-4 pb-0 mb-0 flex items-center justify-between">
            <CardTitle>Count Sheet</CardTitle>
            <label className="flex items-center gap-2 text-sm text-slate-600 pb-4">
              <input
                type="checkbox"
                checked={onlyVariances}
                onChange={(e) => {
                  setOnlyVariances(e.target.checked);
                  setPage(0);
                }}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
              />
              Only show variances
            </label>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">Counted</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Variance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {linesLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {onlyVariances ? 'No variances recorded yet' : 'No lines in this stock take'}
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const draft = drafts[line.id] ?? { counted: '', note: '' };
                    const draftVariance =
                      draft.counted.trim() !== '' && !Number.isNaN(Number(draft.counted))
                        ? Number(draft.counted) - line.expectedQuantity
                        : line.variance;
                    return (
                      <tr key={line.id}>
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-900 whitespace-nowrap">
                          {line.productSku}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-700">{line.productName}</td>
                        <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-700">
                          {line.expectedQuantity}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            ref={(el) => {
                              inputRefs.current[index] = el;
                            }}
                            type="number"
                            aria-label={`Counted quantity for ${line.productSku}`}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500"
                            value={draft.counted}
                            disabled={!canEditCounts || savingLineId === line.id}
                            onChange={(e) => updateDraft(line.id, { counted: e.target.value })}
                            onBlur={() => saveLine(line)}
                            onKeyDown={(e) => handleCountKeyDown(e, index)}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">{varianceDisplay(draftVariance)}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            aria-label={`Note for ${line.productSku}`}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500"
                            value={draft.note}
                            disabled={!canEditCounts || savingLineId === line.id}
                            onChange={(e) => updateDraft(line.id, { note: e.target.value })}
                            onBlur={() => saveLine(line)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-700">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={approveModalOpen} onClose={() => setApproveModalOpen(false)} title="Approve Stock Take" size="sm">
        <p className="text-sm text-slate-700">
          Approving <span className="font-medium">{session.sessionNumber}</span> will create{' '}
          <span className="font-medium">{session.varianceLines}</span> stock adjustment
          {session.varianceLines === 1 ? '' : 's'} for the lines with a non-zero variance, updating
          product and warehouse stock accordingly. This cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setApproveModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApprove} loading={approving}>
            Confirm Approval
          </Button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
