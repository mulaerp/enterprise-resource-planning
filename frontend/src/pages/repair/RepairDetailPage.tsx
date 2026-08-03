import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Plus, ShieldCheck, Trash2, Undo2, Wallet, X } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import { Button, Modal, ModalFooter, Textarea, useToast } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import {
  REPAIR_FLOW,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_BADGE_CLASSES,
  nextRepairStatus,
  canCancelRepair,
  type RepairStatus,
} from '../../lib/repair-status';

// V37: refunding a repair payment is MANAGER/ADMIN only - server enforces this regardless
// (RoleRules.MANAGER_UP), this just keeps the action out of a cashier's UI entirely.
const REFUND_ROLES = ['ADMIN', 'MANAGER'];

interface RepairPart {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

type PaymentAmountType = 'DEPOSIT' | 'BALANCE' | 'FULL';
type PaymentMethod = 'CASH' | 'CARD' | 'EWALLET' | 'STORE_CREDIT';

interface RepairPayment {
  id: string;
  amountType: PaymentAmountType;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  // V37
  isRefund?: boolean;
  originalPaymentId?: string;
  refundReason?: string;
  refundedBy?: string;
}

interface RepairJob {
  id: string;
  jobNumber: string;
  customerId?: string;
  customerName?: string;
  walkInName?: string;
  walkInPhone?: string;
  // Optional link to a catalogue product (RepairFormPage's "Device (from catalogue)" picker).
  // RepairJobDto only carries the id, never a name/SKU - fetched separately below when present.
  productId?: string;
  serialNumber?: string;
  deviceDescription: string;
  reportedFault: string;
  diagnosis?: string;
  status: RepairStatus;
  quoteAmount?: number;
  partsCost?: number;
  labourCost?: number;
  totalCost: number;
  warrantyId?: string;
  isWarrantyClaim: boolean;
  notes?: string;
  receivedAt: string;
  completedAt?: string;
  collectedAt?: string;
  promisedDate?: string;
  approvedAt?: string;
  parts?: RepairPart[];
  payments?: RepairPayment[];
  totalPaid?: number;
  // V37
  totalRefunded?: number;
  netPaid?: number;
  issuedWarrantyId?: string;
}

interface ProductSearchItem {
  id: string;
  sku: string;
  name: string;
}

interface LinkedProduct {
  id: string;
  sku: string;
  name: string;
}

const formatDateTime = (s?: string) => (s ? new Date(s).toLocaleString() : '-');
const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '-');

export default function RepairDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { user } = useAuth();
  const canRefund = REFUND_ROLES.includes(user?.role ?? '');

  const [repair, setRepair] = useState<RepairJob | null>(null);
  const [linkedProduct, setLinkedProduct] = useState<LinkedProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [diagnosis, setDiagnosis] = useState('');
  const [partsCost, setPartsCost] = useState('0');
  const [labourCost, setLabourCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Parts picker
  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<ProductSearchItem[]>([]);
  const [partQuantity, setPartQuantity] = useState('1');
  const [selectedPart, setSelectedPart] = useState<ProductSearchItem | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [removingPartId, setRemovingPartId] = useState<string | null>(null);

  // Payments
  const [paymentAmountType, setPaymentAmountType] = useState<PaymentAmountType>('DEPOSIT');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [addingPayment, setAddingPayment] = useState(false);

  // Collect & Pay
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('CASH');
  const [collecting, setCollecting] = useState(false);

  // Refund a payment (V37)
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<RepairPayment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('CASH');
  const [refundReason, setRefundReason] = useState('');
  const [refundOverride, setRefundOverride] = useState(false);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    fetchRepair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!partQuery.trim()) {
      setPartResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/products?search=${encodeURIComponent(partQuery)}&page=0&size=8`);
        setPartResults(response.data.content);
      } catch (err) {
        console.error('Product search failed:', err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [partQuery]);

  // The linked catalogue product (if any) - RepairJobDto only returns productId, never a
  // name/SKU, so fetch it separately for display. Non-blocking: a failure here just falls back
  // to showing nothing rather than breaking the page.
  useEffect(() => {
    if (!repair?.productId) {
      setLinkedProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/products/${repair.productId}`);
        if (!cancelled) {
          setLinkedProduct({ id: response.data.id, sku: response.data.sku, name: response.data.name });
        }
      } catch (err) {
        console.error('Failed to fetch linked product:', err);
        if (!cancelled) setLinkedProduct(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repair?.productId]);

  const fetchRepair = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/repairs/${id}`);
      const job: RepairJob = response.data;
      setRepair(job);
      setDiagnosis(job.diagnosis || '');
      setPartsCost((job.partsCost ?? 0).toString());
      setLabourCost((job.labourCost ?? 0).toString());
      setNotes(job.notes || '');
      setPromisedDate(job.promisedDate ? job.promisedDate.slice(0, 10) : '');
    } catch (err) {
      console.error('Failed to fetch repair job:', err);
      showError(getErrorMessage(err, 'Failed to load repair job'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (!repair) return;
    const next = nextRepairStatus(repair.status);
    if (!next) return;

    setAdvancing(true);
    try {
      await api.patch(`/repairs/${repair.id}/status?status=${next}`);
      success(`Repair advanced to ${REPAIR_STATUS_LABELS[next]}`);
      fetchRepair();
    } catch (err) {
      console.error('Failed to advance repair status:', err);
      showError(getErrorMessage(err, 'Failed to advance status'));
    } finally {
      setAdvancing(false);
    }
  };

  const handleCancel = async () => {
    if (!repair) return;
    setCancelling(true);
    try {
      await api.patch(`/repairs/${repair.id}/status?status=CANCELLED`);
      success('Repair job cancelled');
      setCancelModalOpen(false);
      fetchRepair();
    } catch (err) {
      console.error('Failed to cancel repair job:', err);
      showError(getErrorMessage(err, 'Failed to cancel repair job'));
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repair) return;

    setSaving(true);
    try {
      const payload = {
        diagnosis: diagnosis.trim() || undefined,
        partsCost: parseFloat(partsCost) || 0,
        labourCost: parseFloat(labourCost) || 0,
        notes: notes.trim() || undefined,
        promisedDate: promisedDate || undefined,
      };
      await api.put(`/repairs/${repair.id}`, payload);
      success('Repair details saved');
      fetchRepair();
    } catch (err) {
      console.error('Failed to save repair details:', err);
      showError(getErrorMessage(err, 'Failed to save repair details'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddPart = async () => {
    if (!repair || !selectedPart) return;
    const quantity = parseInt(partQuantity, 10) || 1;
    setAddingPart(true);
    try {
      await api.post(`/repairs/${repair.id}/parts`, { productId: selectedPart.id, quantity });
      success(`${selectedPart.name} added`);
      setSelectedPart(null);
      setPartQuery('');
      setPartResults([]);
      setPartQuantity('1');
      fetchRepair();
    } catch (err) {
      console.error('Failed to add repair part:', err);
      showError(getErrorMessage(err, 'Failed to add part'));
    } finally {
      setAddingPart(false);
    }
  };

  const handleRemovePart = async (partId: string) => {
    if (!repair) return;
    setRemovingPartId(partId);
    try {
      await api.delete(`/repairs/${repair.id}/parts/${partId}`);
      success('Part removed');
      fetchRepair();
    } catch (err) {
      console.error('Failed to remove repair part:', err);
      showError(getErrorMessage(err, 'Failed to remove part'));
    } finally {
      setRemovingPartId(null);
    }
  };

  const handleAddPayment = async () => {
    if (!repair) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      showError('Enter a payment amount first');
      return;
    }
    setAddingPayment(true);
    try {
      await api.post(`/repairs/${repair.id}/payments`, {
        amountType: paymentAmountType,
        amount,
        paymentMethod,
      });
      success('Payment recorded');
      setPaymentAmount('');
      fetchRepair();
    } catch (err) {
      console.error('Failed to record payment:', err);
      showError(getErrorMessage(err, 'Failed to record payment'));
    } finally {
      setAddingPayment(false);
    }
  };

  // netPaid (collections minus refunds, V37) is the figure that actually matters for "how much
  // is left to collect" - falls back to totalPaid for a job fetched before this field existed
  // (shouldn't happen post-migration, but keeps this resilient).
  const netPaid = repair ? (repair.netPaid ?? repair.totalPaid ?? 0) : 0;
  const remainingBalance = repair ? Math.max(0, repair.totalCost - netPaid) : 0;

  const openCollectModal = () => {
    setCollectAmount(remainingBalance > 0 ? remainingBalance.toFixed(2) : '');
    setCollectMethod('CASH');
    setCollectModalOpen(true);
  };

  const handleCollectAndPay = async () => {
    if (!repair) return;
    setCollecting(true);
    try {
      const amount = parseFloat(collectAmount) || 0;
      if (amount > 0) {
        await api.post(`/repairs/${repair.id}/payments`, {
          amountType: netPaid > 0 ? 'BALANCE' : 'FULL',
          amount,
          paymentMethod: collectMethod,
        });
      }
      await api.patch(`/repairs/${repair.id}/status?status=COLLECTED`);
      success('Repair collected and paid');
      setCollectModalOpen(false);
      fetchRepair();
    } catch (err) {
      console.error('Failed to collect repair job:', err);
      showError(getErrorMessage(err, 'Failed to collect repair job - check the amount covers the remaining balance'));
    } finally {
      setCollecting(false);
    }
  };

  // Defaults the refund amount to the smaller of "this specific payment's own amount" and "what's
  // actually still refundable job-wide" (net paid) - the server's cap is job-level (a refund may
  // exceed its own original payment as long as the job overall still has that much net paid), but
  // defaulting to the row the manager clicked "Refund" on is the least surprising starting point.
  const openRefundModal = (payment: RepairPayment) => {
    setRefundTarget(payment);
    setRefundAmount(Math.min(payment.amount, netPaid).toFixed(2));
    setRefundMethod(payment.paymentMethod);
    setRefundReason('');
    setRefundOverride(false);
    setRefundModalOpen(true);
  };

  const handleRefundPayment = async () => {
    if (!repair || !refundTarget) return;
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      showError('Enter a refund amount first');
      return;
    }
    if (!refundReason.trim()) {
      showError('A reason is required for a refund');
      return;
    }
    setRefunding(true);
    try {
      await api.post(`/repairs/${repair.id}/payments/${refundTarget.id}/refund`, {
        amount,
        method: refundMethod,
        reason: refundReason.trim(),
        override: refundOverride,
      });
      success('Refund recorded');
      setRefundModalOpen(false);
      fetchRepair();
    } catch (err) {
      console.error('Failed to refund payment:', err);
      showError(getErrorMessage(err, 'Failed to refund payment'));
    } finally {
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-slate-500">Loading...</div>
      </Layout>
    );
  }

  if (!repair) {
    return (
      <Layout>
        <div className="p-6 text-slate-500">Repair job not found.</div>
      </Layout>
    );
  }

  const next = nextRepairStatus(repair.status);
  const isCancelled = repair.status === 'CANCELLED';
  const stepperIndex = REPAIR_FLOW.indexOf(repair.status);
  const partsFromStock = repair.parts && repair.parts.length > 0;
  const partsCostPreview = partsFromStock
    ? (repair.parts ?? []).reduce((sum, p) => sum + p.lineTotal, 0)
    : parseFloat(partsCost) || 0;
  const previewTotal = repair.isWarrantyClaim ? 0 : partsCostPreview + (parseFloat(labourCost) || 0);
  const partsEditable = ['RECEIVED', 'DIAGNOSED', 'AWAITING_APPROVAL', 'APPROVED'].includes(repair.status);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/repairs')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Repairs
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Repair {repair.jobNumber}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full border ${REPAIR_STATUS_BADGE_CLASSES[repair.status]}`}
            >
              {REPAIR_STATUS_LABELS[repair.status]}
            </span>
          </div>
        </div>

        {repair.isWarrantyClaim && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 text-brand-800 rounded-lg px-4 py-3 text-sm">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>
              This is a warranty claim - no charge applies.
              {repair.warrantyId && (
                <>
                  {' '}
                  <Link to={`/warranties/${repair.warrantyId}`} className="font-medium underline">
                    View warranty
                  </Link>
                </>
              )}
            </span>
          </div>
        )}

        {/* Status stepper */}
        {!isCancelled && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <ol className="flex flex-wrap items-center gap-2">
              {REPAIR_FLOW.map((step, idx) => (
                <li key={step} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                      idx <= stepperIndex
                        ? REPAIR_STATUS_BADGE_CLASSES[step]
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {idx < stepperIndex && <Check className="w-3.5 h-3.5" />}
                    {REPAIR_STATUS_LABELS[step]}
                  </span>
                  {idx < REPAIR_FLOW.length - 1 && (
                    <span className="text-slate-300">&rarr;</span>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              {next && next === 'COLLECTED' ? (
                <Button icon={<Wallet className="w-4 h-4" />} onClick={openCollectModal}>
                  Collect &amp; Pay
                </Button>
              ) : (
                next && (
                  <Button onClick={handleAdvance} loading={advancing}>
                    Advance to {REPAIR_STATUS_LABELS[next]}
                  </Button>
                )
              )}
              {canCancelRepair(repair.status) && (
                <Button variant="danger" icon={<X className="w-4 h-4" />} onClick={() => setCancelModalOpen(true)}>
                  Cancel Job
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Customer</dt>
                <dd className="font-medium text-slate-900">
                  {repair.customerName || repair.walkInName || '-'}
                  {repair.walkInPhone && !repair.customerName ? ` · ${repair.walkInPhone}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Device</dt>
                <dd className="font-medium text-slate-900">{repair.deviceDescription}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Catalogue product</dt>
                <dd className="font-medium text-slate-900">
                  {repair.productId ? (
                    linkedProduct ? (
                      <Link to={`/products/${linkedProduct.id}/edit`} className="text-brand-700 underline">
                        {linkedProduct.name} ({linkedProduct.sku})
                      </Link>
                    ) : (
                      <span className="text-slate-400">Loading...</span>
                    )
                  ) : (
                    <span className="font-normal text-slate-500">Walk-in device (not in catalogue)</span>
                  )}
                </dd>
              </div>
              {repair.serialNumber && (
                <div>
                  <dt className="text-slate-500">Serial number</dt>
                  <dd className="font-medium text-slate-900">{repair.serialNumber}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Reported fault</dt>
                <dd className="text-slate-700">{repair.reportedFault}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Received</dt>
                <dd className="text-slate-700">{formatDateTime(repair.receivedAt)}</dd>
              </div>
              {repair.promisedDate && (
                <div>
                  <dt className="text-slate-500">Promised date</dt>
                  <dd className="text-slate-700">{formatDate(repair.promisedDate)}</dd>
                </div>
              )}
              {repair.approvedAt && (
                <div>
                  <dt className="text-slate-500">Approved</dt>
                  <dd className="text-slate-700">{formatDateTime(repair.approvedAt)}</dd>
                </div>
              )}
              {repair.completedAt && (
                <div>
                  <dt className="text-slate-500">Completed</dt>
                  <dd className="text-slate-700">{formatDateTime(repair.completedAt)}</dd>
                </div>
              )}
              {repair.collectedAt && (
                <div>
                  <dt className="text-slate-500">Collected</dt>
                  <dd className="text-slate-700">{formatDateTime(repair.collectedAt)}</dd>
                </div>
              )}
              {repair.issuedWarrantyId && (
                <div>
                  <dt className="text-slate-500">Workmanship warranty</dt>
                  <dd className="text-slate-700">
                    <Link to={`/warranties/${repair.issuedWarrantyId}`} className="font-medium underline text-brand-700">
                      View warranty
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Payments</dt>
                <dd className="text-slate-700 tabular-nums">
                  {formatMoney(netPaid)} of {formatMoney(repair.totalCost)} paid (net)
                  {(repair.totalRefunded ?? 0) > 0 && (
                    <span className="block text-xs text-slate-500">
                      {formatMoney(repair.totalPaid ?? 0)} collected &minus; {formatMoney(repair.totalRefunded ?? 0)} refunded
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <form
            onSubmit={handleSaveDetails}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-slate-900">Diagnosis &amp; Costs</h2>
            <Textarea
              label="Diagnosis"
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="parts-cost" className="block text-sm font-medium text-slate-700 mb-1">
                  Other parts (not from stock)
                </label>
                <input
                  id="parts-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={repair.isWarrantyClaim || partsFromStock}
                  value={partsCost}
                  onChange={(e) => setPartsCost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500"
                />
                {partsFromStock && (
                  <p className="mt-1 text-xs text-slate-500">Superseded by the parts picker below.</p>
                )}
              </div>
              <div>
                <label htmlFor="labour-cost" className="block text-sm font-medium text-slate-700 mb-1">
                  Labour cost
                </label>
                <input
                  id="labour-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={repair.isWarrantyClaim}
                  value={labourCost}
                  onChange={(e) => setLabourCost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
            {repair.isWarrantyClaim && (
              <p className="text-xs text-slate-500">Warranty claims are not charged - parts/labour costs are locked at zero.</p>
            )}
            <div>
              <label htmlFor="promised-date" className="block text-sm font-medium text-slate-700 mb-1">
                Promised date
              </label>
              <input
                id="promised-date"
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              />
            </div>
            <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span className="text-lg font-semibold text-slate-900 tabular-nums">
                {formatMoney(previewTotal)}
              </span>
            </div>

            <Button type="submit" loading={saving} className="w-full">
              Save Details
            </Button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Parts picker */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Parts (from stock)</h2>

            {(repair.parts ?? []).length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {(repair.parts ?? []).map((part) => (
                  <div key={part.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{part.productName}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {part.quantity} x {formatMoney(part.unitCost)} = {formatMoney(part.lineTotal)}
                      </p>
                    </div>
                    {partsEditable && (
                      <button
                        type="button"
                        aria-label={`Remove ${part.productName}`}
                        onClick={() => handleRemovePart(part.id)}
                        disabled={removingPartId === part.id}
                        className="text-slate-400 hover:text-red-600 p-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {partsEditable ? (
              <div className="space-y-2">
                <label htmlFor="part-search" className="block text-xs font-medium text-slate-500 mb-1">
                  Search products
                </label>
                <input
                  id="part-search"
                  type="text"
                  value={partQuery}
                  onChange={(e) => {
                    setPartQuery(e.target.value);
                    setSelectedPart(null);
                  }}
                  placeholder="Search by name or SKU..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                />
                {partResults.length > 0 && !selectedPart && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {partResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedPart(p);
                          setPartQuery(p.name);
                          setPartResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{p.name}</span>{' '}
                        <span className="text-xs text-slate-500">{p.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="w-24">
                    <label htmlFor="part-quantity" className="block text-xs font-medium text-slate-500 mb-1">
                      Qty
                    </label>
                    <input
                      id="part-quantity"
                      type="number"
                      min="1"
                      value={partQuantity}
                      onChange={(e) => setPartQuantity(e.target.value)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={handleAddPart}
                    loading={addingPart}
                    disabled={!selectedPart}
                  >
                    Add Part
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Parts can only be added or removed before the job enters In Repair.
              </p>
            )}
          </div>

          {/* Payments */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Payments</h2>

            {(repair.payments ?? []).length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {(repair.payments ?? []).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 flex items-center gap-1.5">
                        {payment.isRefund && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold rounded bg-red-50 text-red-700 border border-red-200">
                            REFUND
                          </span>
                        )}
                        {payment.amountType} &middot; {payment.paymentMethod}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateTime(payment.paidAt)}</p>
                      {payment.isRefund && payment.refundReason && (
                        <p className="text-xs text-slate-500 truncate" title={payment.refundReason}>
                          {payment.refundReason}
                          {payment.refundedBy && ` · by ${payment.refundedBy}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`tabular-nums font-medium ${payment.isRefund ? 'text-red-700' : 'text-slate-900'}`}
                      >
                        {payment.isRefund ? '−' : ''}
                        {formatMoney(payment.amount)}
                      </span>
                      {canRefund && !payment.isRefund && netPaid > 0 && (
                        <button
                          type="button"
                          aria-label={`Refund ${formatMoney(payment.amount)} ${payment.paymentMethod} payment`}
                          onClick={() => openRefundModal(payment)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Refund"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isCancelled && repair.status !== 'COLLECTED' && (
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <label htmlFor="payment-amount-type" className="block text-xs font-medium text-slate-500 mb-1">
                    Type
                  </label>
                  <select
                    id="payment-amount-type"
                    value={paymentAmountType}
                    onChange={(e) => setPaymentAmountType(e.target.value as PaymentAmountType)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <option value="DEPOSIT">Deposit</option>
                    <option value="BALANCE">Balance</option>
                    <option value="FULL">Full</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="payment-amount" className="block text-xs font-medium text-slate-500 mb-1">
                    Amount
                  </label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  />
                </div>
                <div>
                  <label htmlFor="payment-method" className="block text-xs font-medium text-slate-500 mb-1">
                    Method
                  </label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="EWALLET">E-Wallet</option>
                    <option value="STORE_CREDIT">Store Credit</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <Button type="button" size="sm" onClick={handleAddPayment} loading={addingPayment} className="w-full">
                    Record Payment
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Repair Job" size="sm">
        <p className="text-slate-600">
          Are you sure you want to cancel repair job <strong>{repair.jobNumber}</strong>? This action
          cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
            Keep Job
          </Button>
          <Button variant="danger" onClick={handleCancel} loading={cancelling}>
            Cancel Job
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={collectModalOpen} onClose={() => setCollectModalOpen(false)} title="Collect & Pay" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Remaining balance: <span className="font-medium tabular-nums">{formatMoney(remainingBalance)}</span>
          </p>
          <div>
            <label htmlFor="collect-amount" className="block text-sm font-medium text-slate-700 mb-1">
              Amount collected
            </label>
            <input
              id="collect-amount"
              type="number"
              min="0"
              step="0.01"
              value={collectAmount}
              onChange={(e) => setCollectAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            />
          </div>
          <div>
            <label htmlFor="collect-method" className="block text-sm font-medium text-slate-700 mb-1">
              Payment method
            </label>
            <select
              id="collect-method"
              value={collectMethod}
              onChange={(e) => setCollectMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="EWALLET">E-Wallet</option>
              <option value="STORE_CREDIT">Store Credit</option>
            </select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setCollectModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCollectAndPay} loading={collecting}>
            Collect &amp; Pay
          </Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={refundModalOpen} onClose={() => setRefundModalOpen(false)} title="Refund Payment" size="sm">
        <div className="space-y-4">
          {refundTarget && (
            <p className="text-sm text-slate-600">
              Refunding against the {formatMoney(refundTarget.amount)} {refundTarget.amountType.toLowerCase()} paid by{' '}
              {refundTarget.paymentMethod}. Net paid on this job: <span className="font-medium tabular-nums">{formatMoney(netPaid)}</span>
              {' '}of <span className="font-medium tabular-nums">{formatMoney(repair.totalCost)}</span>.
            </p>
          )}

          {repair.status === 'COLLECTED' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This job has already been collected - the customer paid in full. Refunding money now may leave it
                underpaid relative to the total cost, which is blocked unless you confirm below.
              </span>
            </div>
          )}

          <div>
            <label htmlFor="refund-amount" className="block text-sm font-medium text-slate-700 mb-1">
              Amount
            </label>
            <input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              max={netPaid}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            />
          </div>
          <div>
            <label htmlFor="refund-method" className="block text-sm font-medium text-slate-700 mb-1">
              Refund method
            </label>
            <select
              id="refund-method"
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="EWALLET">E-Wallet</option>
              <option value="STORE_CREDIT">Store Credit (member only)</option>
            </select>
          </div>
          <Textarea
            label="Reason (required)"
            rows={2}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="e.g. job cancelled after deposit, overpayment at collection, goodwill refund..."
          />
          {repair.status === 'COLLECTED' && (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={refundOverride}
                onChange={(e) => setRefundOverride(e.target.checked)}
                className="mt-0.5"
              />
              <span>I understand this may leave a collected job underpaid relative to its total cost (override).</span>
            </label>
          )}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setRefundModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRefundPayment} loading={refunding}>
            Refund
          </Button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
