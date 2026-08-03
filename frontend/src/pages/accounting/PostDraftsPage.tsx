import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface AccountSubtotal {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

interface SourceGroup {
  source: string;
  count: number;
  totalDebits: number;
  totalCredits: number;
  entryIds: string[];
  accountSubtotals: AccountSubtotal[];
}

interface DraftPreview {
  startDate: string | null;
  endDate: string | null;
  totalCount: number;
  totalDebits: number;
  totalCredits: number;
  sources: SourceGroup[];
}

interface PostBatchResult {
  posted: number;
  totalDebits: number;
  totalCredits: number;
}

const firstDayOfYear = () => {
  const date = new Date();
  date.setMonth(0, 1);
  return date.toISOString().split('T')[0];
};

const today = () => new Date().toISOString().split('T')[0];

/**
 * WP: fixes the "books report zero" audit finding - every auto-journal hook posts DRAFT entries
 * and the only way to POST one used to be one-at-a-time with a per-row confirm dialog
 * (JournalEntryListPage). This screen previews outstanding drafts grouped by source with
 * per-account subtotals, then posts a selection (or the whole range) in one all-or-nothing batch.
 */
export default function PostDraftsPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [startDate, setStartDate] = useState(firstDayOfYear());
  const [endDate, setEndDate] = useState(today());
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<PostBatchResult | null>(null);

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPreview = async (opts: { preserveResult?: boolean } = {}) => {
    setLoading(true);
    // BUG FIX: handlePostSelected calls this to refresh the draft list right after a successful
    // post, in the same synchronous continuation as its own setResult(response.data) just above -
    // React 18 batches those together, so the unconditional setResult(null) that used to be here
    // wiped the "Posted N journal entries / Total debits = total credits" confirmation before it
    // ever had a chance to render, defeating the whole point of showing it. The manual "Preview"
    // button and the on-mount effect still want the reset (an explicit new preview genuinely
    // supersedes any earlier confirmation), so only handlePostSelected opts out of it.
    if (!opts.preserveResult) {
      setResult(null);
    }
    try {
      const response = await api.get<DraftPreview>('/accounting/journal-entries/drafts/preview', {
        params: { startDate, endDate },
      });
      setPreview(response.data);
      const nextSelection: Record<string, boolean> = {};
      response.data.sources.forEach((group) => {
        nextSelection[group.source] = true;
      });
      setSelectedSources(nextSelection);
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to load draft journal entries'));
    } finally {
      setLoading(false);
    }
  };

  const allSelected = !!preview && preview.sources.length > 0 && preview.sources.every((g) => selectedSources[g.source]);

  const toggleAll = () => {
    if (!preview) return;
    const next: Record<string, boolean> = {};
    preview.sources.forEach((group) => {
      next[group.source] = !allSelected;
    });
    setSelectedSources(next);
  };

  const toggleSource = (source: string) => {
    setSelectedSources((prev) => ({ ...prev, [source]: !prev[source] }));
  };

  const selectedEntryIds = (): string[] => {
    if (!preview) return [];
    return preview.sources
      .filter((group) => selectedSources[group.source])
      .flatMap((group) => group.entryIds);
  };

  const handlePostSelected = async () => {
    const entryIds = selectedEntryIds();
    if (entryIds.length === 0) {
      showError('Select at least one source group to post');
      return;
    }
    if (!confirm(`Post ${entryIds.length} draft journal entr${entryIds.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) {
      return;
    }

    setPosting(true);
    try {
      const response = await api.post<PostBatchResult>('/accounting/journal-entries/post-batch', { entryIds });
      setResult(response.data);
      success(`Posted ${response.data.posted} journal entr${response.data.posted === 1 ? 'y' : 'ies'}`);
      loadPreview({ preserveResult: true });
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to post draft journal entries'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/accounting/journal-entries')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Journal Entries
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">Post Drafts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review outstanding draft journal entries grouped by source, then post them in one batch.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Input
                id="post-drafts-start-date"
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Input
                id="post-drafts-end-date"
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={() => loadPreview()} loading={loading}>
              Preview
            </Button>
          </div>
        </Card>

        {result && (
          <Card className="p-6 border-green-200 bg-green-50">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <div>
                <p className="text-base font-semibold text-slate-900">
                  Posted {result.posted} journal entr{result.posted === 1 ? 'y' : 'ies'}
                </p>
                <p className="text-sm text-slate-600">
                  Total debits {formatMoney(result.totalDebits)} = total credits {formatMoney(result.totalCredits)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {loading && !preview && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">Loading draft entries...</p>
          </Card>
        )}

        {!loading && preview && preview.totalCount === 0 && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">No draft journal entries found for the selected period.</p>
          </Card>
        )}

        {!loading && preview && preview.totalCount > 0 && (
          <>
            <Card className="p-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  id="post-drafts-select-all"
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                />
                Select all ({preview.totalCount} draft{preview.totalCount === 1 ? '' : 's'})
              </label>
              <Button onClick={handlePostSelected} loading={posting} disabled={selectedEntryIds().length === 0}>
                Post Selected ({selectedEntryIds().length})
              </Button>
            </Card>

            {preview.sources.map((group) => (
              <Card key={group.source} padding="none" className="overflow-hidden">
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!selectedSources[group.source]}
                      onChange={() => toggleSource(group.source)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                    />
                    <h2 className="text-sm font-semibold text-slate-900">
                      {group.source} ({group.count})
                    </h2>
                  </label>
                  <span className="text-sm text-slate-600 tabular-nums">
                    Dr {formatMoney(group.totalDebits)} / Cr {formatMoney(group.totalCredits)}
                  </span>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Account Code</th>
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Account Name</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Debit</th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {group.accountSubtotals.map((subtotal) => (
                      <tr key={subtotal.accountCode} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 text-sm text-slate-700">{subtotal.accountCode}</td>
                        <td className="px-6 py-2.5 text-sm text-slate-700">{subtotal.accountName}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums text-slate-900">{formatMoney(subtotal.debit)}</td>
                        <td className="px-6 py-2.5 text-sm text-right tabular-nums text-slate-900">{formatMoney(subtotal.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}

            <Card className="p-6 flex items-center justify-between">
              <span className="text-base font-semibold text-slate-900">Grand Total</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                Dr {formatMoney(preview.totalDebits)} / Cr {formatMoney(preview.totalCredits)}
              </span>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
