import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { Badge, Button, Modal, ModalFooter, Textarea, useToast } from '../../components/ui';

type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID';

interface Warranty {
  id: string;
  warrantyNumber: string;
  productId: string;
  productName: string;
  serialId?: string;
  batchId?: string;
  posSaleId?: string;
  salesOrderId?: string;
  customerId?: string;
  memberId?: string;
  startDate: string;
  months: number | null;
  durationDays?: number | null;
  durationSource?: 'PRODUCT_MONTHS' | 'GUEST_BASE' | 'MEMBER_BASE';
  /** e.g. "10 days (member)" / "6 month(s) (product)" - see WarrantyDto#coverageLabel. */
  coverageLabel?: string;
  expiryDate: string;
  status: WarrantyStatus;
  terms?: string;
}

const STATUS_VARIANT: Record<WarrantyStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  EXPIRED: 'default',
  CLAIMED: 'info',
  VOID: 'danger',
};

export default function WarrantyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const [reportedFault, setReportedFault] = useState('');
  const [filingClaim, setFilingClaim] = useState(false);

  useEffect(() => {
    fetchWarranty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchWarranty = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/warranties/${id}`);
      setWarranty(response.data);
    } catch (err) {
      console.error('Failed to fetch warranty:', err);
      showError(getErrorMessage(err, 'Failed to load warranty'));
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!warranty) return;
    setVoiding(true);
    try {
      await api.post(`/warranties/${warranty.id}/void`);
      success('Warranty voided');
      setVoidModalOpen(false);
      fetchWarranty();
    } catch (err) {
      console.error('Failed to void warranty:', err);
      showError(getErrorMessage(err, 'Failed to void warranty'));
    } finally {
      setVoiding(false);
    }
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warranty || !reportedFault.trim()) return;

    setFilingClaim(true);
    try {
      const response = await api.post(`/warranties/${warranty.id}/claim`, {
        reportedFault: reportedFault.trim(),
      });
      success('Warranty claim filed - repair job created');
      navigate(`/repairs/${response.data.id}`);
    } catch (err) {
      console.error('Failed to file warranty claim:', err);
      showError(getErrorMessage(err, 'Failed to file warranty claim'));
    } finally {
      setFilingClaim(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-slate-500">Loading...</div>
      </Layout>
    );
  }

  if (!warranty) {
    return (
      <Layout>
        <div className="p-6 text-slate-500">Warranty not found.</div>
      </Layout>
    );
  }

  const canVoid = warranty.status !== 'VOID';
  const canClaim = warranty.status === 'ACTIVE';

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/warranties')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Warranties
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Warranty {warranty.warrantyNumber}</h1>
            <Badge variant={STATUS_VARIANT[warranty.status]}>{warranty.status}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Warranty Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Product</dt>
                <dd className="font-medium text-slate-900">{warranty.productName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Coverage</dt>
                <dd className="text-slate-700">{warranty.coverageLabel ?? `${warranty.months} month(s)`}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Start date</dt>
                <dd className="text-slate-700">{new Date(warranty.startDate).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Expiry date</dt>
                <dd className="text-slate-700">{new Date(warranty.expiryDate).toLocaleDateString()}</dd>
              </div>
              {warranty.terms && (
                <div>
                  <dt className="text-slate-500">Terms</dt>
                  <dd className="text-slate-700 whitespace-pre-wrap">{warranty.terms}</dd>
                </div>
              )}
            </dl>

            {canVoid && (
              <Button
                variant="danger"
                className="mt-6"
                icon={<Ban className="w-4 h-4" />}
                onClick={() => setVoidModalOpen(true)}
              >
                Void Warranty
              </Button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">File a Claim</h2>
            {canClaim ? (
              <form onSubmit={handleFileClaim} className="space-y-4">
                <Textarea
                  label="Reported fault"
                  required
                  rows={4}
                  value={reportedFault}
                  onChange={(e) => setReportedFault(e.target.value)}
                  helperText="Filing a claim creates a no-charge repair job linked to this warranty."
                />
                <Button type="submit" loading={filingClaim} disabled={!reportedFault.trim()}>
                  File Claim
                </Button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">
                This warranty is {warranty.status.toLowerCase()} and can no longer be claimed.
              </p>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={voidModalOpen} onClose={() => setVoidModalOpen(false)} title="Void Warranty" size="sm">
        <p className="text-slate-600">
          Are you sure you want to void warranty <strong>{warranty.warrantyNumber}</strong>? This
          action cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setVoidModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleVoid} loading={voiding}>
            Void Warranty
          </Button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
