import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { History, RefreshCw } from 'lucide-react';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { api, getErrorMessage } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface CompanyForm {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
}

interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  // V31: rateSource distinguishes an operator's manual PUT from an automatic provider fetch;
  // rateFetchedAt is when an AUTO fetch last set this row's rate (null if never auto-fetched).
  rateSource: 'MANUAL' | 'AUTO';
  rateFetchedAt: string | null;
}

interface FetchLogEntry {
  id: string;
  fetchedAt: string;
  provider: string;
  status: 'SUCCESS' | 'FAILED';
  message: string | null;
  ratesUpdated: number;
}

export default function CompanySettingsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // PUT /currencies/{code} is MANAGER+ (server-enforced, 400 if attempted on MYR or by a USER
  // role) - gray out editing client-side too so a USER role doesn't hit a guaranteed rejection.
  const canEditRates = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [lastFetchLog, setLastFetchLog] = useState<FetchLogEntry | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CompanyForm>({
    defaultValues: {
      currency: 'USD',
    },
  });

  // GET /currencies/fetch-log is MANAGER+ (same tier as the refresh trigger) - only fetch it for
  // a user who can actually see it, otherwise it's a guaranteed 403.
  const fetchLastFetchLog = useCallback(async () => {
    if (!canEditRates) {
      return;
    }
    try {
      const response = await api.get('/currencies/fetch-log?page=0&size=1');
      const rows: FetchLogEntry[] = response.data.content || [];
      setLastFetchLog(rows[0] ?? null);
    } catch {
      // Non-fatal - the status line just stays blank if this fails.
    }
  }, [canEditRates]);

  useEffect(() => {
    fetchCompany();
    fetchCurrencies();
    fetchLastFetchLog();
  }, [fetchLastFetchLog]);

  const fetchCurrencies = async () => {
    try {
      setCurrenciesLoading(true);
      const response = await api.get('/currencies');
      const rows: CurrencyRow[] = response.data.content || response.data;
      setCurrencies(rows);
      setRateDrafts(Object.fromEntries(rows.map((c) => [c.code, c.rate.toString()])));
    } catch {
      showToast('error', 'Failed to fetch exchange rates');
    } finally {
      setCurrenciesLoading(false);
    }
  };

  const handleRefreshRates = async () => {
    try {
      setRefreshingRates(true);
      const response = await api.post('/currencies/refresh-rates');
      showToast(
        'success',
        `Refreshed ${response.data.updated} exchange rate(s) from ${response.data.provider}`
      );
      await fetchCurrencies();
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to refresh exchange rates from provider'));
    } finally {
      setRefreshingRates(false);
      await fetchLastFetchLog();
    }
  };

  const handleRateSave = async (code: string) => {
    const draft = rateDrafts[code];
    const rate = parseFloat(draft);
    if (!Number.isFinite(rate) || rate <= 0) {
      showToast('error', 'Enter a positive exchange rate');
      return;
    }
    try {
      setSavingCode(code);
      await api.put(`/currencies/${code}`, { rate });
      setCurrencies((prev) => prev.map((c) => (c.code === code ? { ...c, rate } : c)));
      showToast('success', `${code} exchange rate updated`);
    } catch (err) {
      showToast('error', getErrorMessage(err, `Failed to update ${code} exchange rate`));
    } finally {
      setSavingCode(null);
    }
  };

  const fetchCompany = async () => {
    try {
      const response = await api.get('/companies');
      const companies = response.data.content || [];
      if (companies.length > 0) {
        const company = companies[0];
        setCompanyId(company.id);
        setValue('name', company.name);
        setValue('taxId', company.taxId);
        setValue('address', company.address);
        setValue('phone', company.phone);
        setValue('email', company.email);
        setValue('currency', company.currency);
      }
    } catch {
      showToast('error', 'Failed to fetch company settings');
    }
  };

  const onSubmit = async (data: CompanyForm) => {
    try {
      setLoading(true);
      if (companyId) {
        await api.put(`/companies/${companyId}`, data);
        showToast('success', 'Company settings updated successfully');
      } else {
        const response = await api.post('/companies', data);
        setCompanyId(response.data.id);
        showToast('success', 'Company settings created successfully');
      }
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Failed to save company settings'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Company Settings</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xl font-semibold">Company Information</h2>

          <div>
            <label htmlFor="company-name" className="block text-sm font-medium mb-1">Company Name *</label>
            <Input
              id="company-name"
              {...register('name', { required: 'Company name is required' })}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-tax-id" className="block text-sm font-medium mb-1">Tax ID</label>
              <Input id="company-tax-id" {...register('taxId')} />
            </div>

            <div>
              <label htmlFor="company-currency" className="block text-sm font-medium mb-1">Currency</label>
              <Input id="company-currency" {...register('currency')} placeholder="USD" />
            </div>
          </div>

          <div>
            <label htmlFor="company-address" className="block text-sm font-medium mb-1">Address</label>
            <textarea
              id="company-address"
              {...register('address')}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-phone" className="block text-sm font-medium mb-1">Phone</label>
              <Input id="company-phone" {...register('phone')} />
            </div>

            <div>
              <label htmlFor="company-email" className="block text-sm font-medium mb-1">Email</label>
              <Input id="company-email" type="email" {...register('email')} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xl font-semibold">System Settings</h2>
          
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-slate-700">
              Additional system settings like email configuration, backup schedules, 
              and integrations can be configured in the application.yml file.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Exchange Rates</h2>
            <p className="text-sm text-slate-500 mt-1">
              All amounts in Mula ERP are stored in MYR. These rates control how the public
              storefront converts MYR prices into other display currencies. Rates refresh
              automatically once a day from a live provider; managers and admins can also trigger
              a refresh manually or override any rate by hand.
            </p>
          </div>
          {canEditRates && (
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw size={16} />}
              loading={refreshingRates}
              disabled={refreshingRates}
              onClick={handleRefreshRates}
            >
              {refreshingRates ? 'Refreshing...' : 'Refresh from provider'}
            </Button>
          )}
        </div>

        {!canEditRates && (
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm text-slate-700">Only managers and admins can edit exchange rates.</p>
          </div>
        )}

        {canEditRates && lastFetchLog && (
          <p className="text-xs text-slate-500">
            Last fetch:{' '}
            {lastFetchLog.status === 'SUCCESS' ? (
              <span className="text-green-700">
                succeeded ({lastFetchLog.ratesUpdated} rate{lastFetchLog.ratesUpdated === 1 ? '' : 's'} updated
                via {lastFetchLog.provider})
              </span>
            ) : (
              <span className="text-red-600">failed ({lastFetchLog.message ?? 'unknown error'})</span>
            )}
            {' at '}
            {new Date(lastFetchLog.fetchedAt).toLocaleString('en-MY')}
          </p>
        )}

        {currenciesLoading ? (
          <p className="text-sm text-slate-500">Loading exchange rates...</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {currencies.map((currency) => {
              const isBase = currency.code === 'MYR';
              return (
                <div key={currency.code} className="py-3 flex items-center gap-4">
                  <div className="w-28 flex-shrink-0">
                    <p className="font-medium text-slate-900">{currency.code}</p>
                    <p className="text-xs text-slate-500">{currency.name}</p>
                  </div>
                  <div className="flex-1 max-w-[160px]">
                    <label
                      htmlFor={`currency-rate-${currency.code}`}
                      className="sr-only"
                    >
                      {currency.code} rate to base
                    </label>
                    <Input
                      id={`currency-rate-${currency.code}`}
                      type="number"
                      step="0.000001"
                      min="0"
                      disabled={isBase || !canEditRates}
                      value={isBase ? '1.000000' : (rateDrafts[currency.code] ?? '')}
                      onChange={(e) =>
                        setRateDrafts((prev) => ({ ...prev, [currency.code]: e.target.value }))
                      }
                    />
                  </div>
                  {!isBase && (
                    <div className="w-32 flex-shrink-0 text-xs text-slate-500">
                      <p>
                        <span
                          className={
                            currency.rateSource === 'AUTO'
                              ? 'inline-block px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium'
                              : 'inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium'
                          }
                        >
                          {currency.rateSource === 'AUTO' ? 'Auto' : 'Manual'}
                        </span>
                      </p>
                      {currency.rateFetchedAt && (
                        <p className="mt-1">
                          Fetched {new Date(currency.rateFetchedAt).toLocaleString('en-MY')}
                        </p>
                      )}
                    </div>
                  )}
                  {!isBase && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!canEditRates || savingCode === currency.code}
                      onClick={() => handleRateSave(currency.code)}
                    >
                      {savingCode === currency.code ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                  {isBase && (
                    <span className="text-xs text-slate-400 w-[88px] text-center">Base currency</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Audit Logs</h2>
          <p className="text-sm text-slate-600 mt-1">Review the site-wide trail of create, update, and delete actions.</p>
        </div>
        <Link to="/settings/audit-logs">
          <Button variant="secondary" icon={<History size={16} />}>
            View Audit Logs
          </Button>
        </Link>
      </div>
    </div>
    </Layout>
  );
}
