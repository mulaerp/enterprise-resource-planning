import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Link2, Unlink } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Modal, { ModalFooter } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';

interface BankTransaction {
  id: string;
  txnDate: string;
  description: string;
  amount: number;
  reference?: string;
  sourceFilename?: string;
  reconciled: boolean;
  matchedPaymentId?: string;
  matchedPaymentNumber?: string;
  importBatchId: string;
}

interface PageResponse<T> {
  content: T[];
  number: number;
  totalPages: number;
  totalElements: number;
}

interface BankSummary {
  unreconciledCount: number;
  reconciledCount: number;
  unreconciledTotal: number;
}

interface ImportResult {
  importBatchId: string;
  imported: number;
  skipped: number;
  duplicates: number;
}

interface PaymentSuggestion {
  paymentId: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  daysDifference: number;
}

const PAGE_SIZE = 20;

function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BankReconciliationPage() {
  const { success, error: showError } = useToast();

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'true' | 'false'>('all');

  const [summary, setSummary] = useState<BankSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [activeTxn, setActiveTxn] = useState<BankTransaction | null>(null);
  const [suggestions, setSuggestions] = useState<PaymentSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [matchingPaymentId, setMatchingPaymentId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await api.get<BankSummary>('/bank/summary');
      setSummary(response.data);
    } catch {
      showError('Failed to fetch reconciliation summary');
    }
  }, [showError]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, size: PAGE_SIZE };
      if (reconciledFilter !== 'all') {
        params.reconciled = reconciledFilter;
      }
      const response = await api.get<PageResponse<BankTransaction>>('/bank/transactions', { params });
      setTransactions(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch {
      showError('Failed to fetch bank transactions');
    } finally {
      setLoading(false);
    }
  }, [page, reconciledFilter, showError]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleImport = async () => {
    if (!selectedFile) {
      showError('Choose a statement file first');
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await api.post<ImportResult>('/bank/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(response.data);
      success(`Imported ${response.data.imported} transaction(s)`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPage(0);
      fetchTransactions();
      fetchSummary();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to import statement'));
    } finally {
      setImporting(false);
    }
  };

  const openSuggestions = async (txn: BankTransaction) => {
    setActiveTxn(txn);
    setSuggestionsLoading(true);
    setSuggestions([]);
    try {
      const response = await api.get<PaymentSuggestion[]>(`/bank/transactions/${txn.id}/suggestions`);
      setSuggestions(response.data);
    } catch {
      showError('Failed to fetch matching suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const closeSuggestions = () => {
    setActiveTxn(null);
    setSuggestions([]);
  };

  const handleMatch = async (paymentId: string) => {
    if (!activeTxn) return;
    setMatchingPaymentId(paymentId);
    try {
      await api.post(`/bank/transactions/${activeTxn.id}/match`, { paymentId });
      success('Transaction matched and reconciled');
      closeSuggestions();
      fetchTransactions();
      fetchSummary();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to match transaction'));
    } finally {
      setMatchingPaymentId(null);
    }
  };

  const handleUnmatch = async (txn: BankTransaction) => {
    if (!confirm('Unmatch this transaction?')) return;
    try {
      await api.post(`/bank/transactions/${txn.id}/unmatch`);
      success('Transaction unmatched');
      fetchTransactions();
      fetchSummary();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to unmatch transaction'));
    }
  };

  const columns: Column<BankTransaction>[] = [
    {
      key: 'txnDate',
      header: 'Date',
      render: (txn) => new Date(txn.txnDate).toLocaleDateString('en-GB'),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right tabular-nums',
      render: (txn) => (
        <span className={txn.amount < 0 ? 'text-red-700' : 'text-green-700'}>
          {formatAmount(txn.amount)}
        </span>
      ),
    },
    {
      key: 'reconciled',
      header: 'Status',
      render: (txn) =>
        txn.reconciled ? (
          <Badge variant="success">Reconciled</Badge>
        ) : (
          <Badge variant="warning">Unreconciled</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (txn) =>
        txn.reconciled ? (
          <button
            onClick={() => handleUnmatch(txn)}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-red-700"
            title="Unmatch"
          >
            <Unlink className="w-4 h-4" /> Unmatch
          </button>
        ) : (
          <button
            onClick={() => openSuggestions(txn)}
            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800"
            title="Match"
          >
            <Link2 className="w-4 h-4" /> Match
          </button>
        ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bank Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Import a bank statement and match transactions against recorded payments
          </p>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Import statement</h2>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label htmlFor="bank-statement-file" className="block text-sm font-medium text-slate-700 mb-1">
                Statement file (CSV)
              </label>
              <input
                id="bank-statement-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-700"
              />
            </div>
            <Button onClick={handleImport} loading={importing} icon={<Upload className="w-4 h-4" />}>
              Import
            </Button>
          </div>
          {importResult && (
            <p className="text-sm text-slate-600">
              Imported <span className="font-medium text-slate-900">{importResult.imported}</span>, skipped{' '}
              <span className="font-medium text-slate-900">{importResult.skipped}</span>, duplicates{' '}
              <span className="font-medium text-slate-900">{importResult.duplicates}</span> (batch{' '}
              {importResult.importBatchId.slice(0, 8)})
            </p>
          )}
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="warning" size="lg">
            Unreconciled {summary?.unreconciledCount ?? 0}
          </Badge>
          <Badge variant="success" size="lg">
            Reconciled {summary?.reconciledCount ?? 0}
          </Badge>
          {summary && (
            <span className="text-sm text-slate-500">
              Unreconciled total: {formatAmount(summary.unreconciledTotal)}
            </span>
          )}
        </div>

        {/* Filter */}
        <div className="max-w-xs">
          <Select
            label="Filter"
            value={reconciledFilter}
            onChange={(e) => {
              setPage(0);
              setReconciledFilter(e.target.value as 'all' | 'true' | 'false');
            }}
            options={[
              { value: 'all', label: 'All transactions' },
              { value: 'false', label: 'Unreconciled only' },
              { value: 'true', label: 'Reconciled only' },
            ]}
          />
        </div>

        <DataTable
          columns={columns}
          data={transactions}
          keyExtractor={(txn) => txn.id}
          loading={loading}
          emptyMessage="No bank transactions imported yet"
          pagination={{
            currentPage: page,
            totalPages,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* Match suggestions modal */}
      <Modal isOpen={!!activeTxn} onClose={closeSuggestions} title="Match bank transaction" size="lg">
        {activeTxn && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-900">{activeTxn.description}</span>
              </p>
              <p>
                {new Date(activeTxn.txnDate).toLocaleDateString('en-GB')} &middot;{' '}
                <span className={activeTxn.amount < 0 ? 'text-red-700' : 'text-green-700'}>
                  {formatAmount(activeTxn.amount)}
                </span>
              </p>
            </div>

            {suggestionsLoading ? (
              <p className="text-sm text-slate-500">Loading suggestions...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-slate-500">No candidate payments found within ±3 days.</p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                {suggestions.map((s) => (
                  <div key={s.paymentId} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.paymentNumber}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(s.paymentDate).toLocaleDateString('en-GB')} &middot;{' '}
                        {formatAmount(s.amount)} &middot; {s.daysDifference} day(s) away
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleMatch(s.paymentId)}
                      loading={matchingPaymentId === s.paymentId}
                    >
                      Match
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <ModalFooter>
              <Button variant="secondary" onClick={closeSuggestions}>
                Close
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
