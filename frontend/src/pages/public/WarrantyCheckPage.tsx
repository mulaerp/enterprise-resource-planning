import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import publicApi from '../../lib/public-api';
import PublicLayout from '../../components/PublicLayout';
import { Badge, Button, Input } from '../../components/ui';

interface WarrantyCheckResult {
  found: boolean;
  status?: 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID';
  productName?: string;
  startDate?: string;
  expiryDate?: string;
  remainingDays?: number;
  /** e.g. "10 days (member)" / "6 month(s) (product)" - see WarrantyDto#coverageLabel. */
  coverageLabel?: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  EXPIRED: 'default',
  CLAIMED: 'info',
  VOID: 'danger',
};

export default function WarrantyCheckPage() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<WarrantyCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setChecking(true);
    setErrorMessage('');
    setResult(null);
    try {
      const response = await publicApi.get(`/public/warranty/${encodeURIComponent(code.trim())}`);
      setResult(response.data);
    } catch (err) {
      console.error('Warranty check failed:', err);
      setErrorMessage('Something went wrong checking that warranty. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Warranty Check</h1>
          <p className="text-slate-500 mt-1">
            Enter your warranty number or the product's serial number to check its coverage.
          </p>
        </div>

        <form onSubmit={handleCheck} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <Input
            label="Warranty or serial number"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. WTY-2026-000123-a1b2"
          />
          <Button type="submit" loading={checking} disabled={!code.trim()}>
            Check
          </Button>
        </form>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        {result && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            {result.found ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Warranty found</span>
                  {result.status && <Badge variant={STATUS_VARIANT[result.status] || 'default'}>{result.status}</Badge>}
                </div>
                <dl className="space-y-2 text-sm">
                  {result.productName && (
                    <div>
                      <dt className="text-slate-500">Product</dt>
                      <dd className="font-medium text-slate-900">{result.productName}</dd>
                    </div>
                  )}
                  {result.coverageLabel && (
                    <div>
                      <dt className="text-slate-500">Coverage</dt>
                      <dd className="text-slate-700">{result.coverageLabel}</dd>
                    </div>
                  )}
                  {result.startDate && (
                    <div>
                      <dt className="text-slate-500">Start date</dt>
                      <dd className="text-slate-700">{new Date(result.startDate).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {result.expiryDate && (
                    <div>
                      <dt className="text-slate-500">Expiry date</dt>
                      <dd className="text-slate-700">{new Date(result.expiryDate).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {result.remainingDays != null && (
                    <div>
                      <dt className="text-slate-500">Days remaining</dt>
                      <dd className="text-slate-700 tabular-nums">
                        {result.remainingDays > 0 ? result.remainingDays : 0}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <XCircle className="w-5 h-5" />
                <span>No warranty found for that number.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
