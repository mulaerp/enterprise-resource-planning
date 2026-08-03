import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { Button, Input, Textarea, useToast } from '../../components/ui';

interface CustomerOption {
  id: string;
  name: string;
  phone?: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

type CustomerMode = 'registered' | 'walkIn';

export default function RepairFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [customerMode, setCustomerMode] = useState<CustomerMode>('walkIn');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [deviceDescription, setDeviceDescription] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [reportedFault, setReportedFault] = useState('');

  // Optional link to a catalogue product - lets a workmanship warranty be issued at collection
  // (WarrantyService#issueWorkmanshipWarranty is gated on productId != null). A genuine walk-in
  // device with no catalogue match just leaves this unset, exactly as before this feature existed.
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const productSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (!customerQuery.trim()) {
      setCustomerResults([]);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: customerQuery, page: '0', size: '5' });
        const response = await api.get(`/customers?${params}`);
        setCustomerResults(response.data.content);
      } catch (err) {
        console.error('Customer search failed:', err);
      }
    }, 250);
    return () => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    };
  }, [customerQuery]);

  useEffect(() => {
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    if (!productQuery.trim()) {
      setProductResults([]);
      return;
    }
    productSearchTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: productQuery, page: '0', size: '8' });
        const response = await api.get(`/products?${params}`);
        setProductResults(response.data.content);
      } catch (err) {
        console.error('Product search failed:', err);
      }
    }, 250);
    return () => {
      if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    };
  }, [productQuery]);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (customerMode === 'registered' && !selectedCustomer) {
      nextErrors.customer = 'Select a registered customer';
    }
    if (customerMode === 'walkIn') {
      if (!walkInName.trim()) nextErrors.walkInName = 'Walk-in name is required';
      if (!walkInPhone.trim()) nextErrors.walkInPhone = 'Walk-in phone is required';
    }
    if (!deviceDescription.trim()) nextErrors.deviceDescription = 'Device description is required';
    if (!reportedFault.trim()) nextErrors.reportedFault = 'Reported fault is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...(customerMode === 'registered'
          ? { customerId: selectedCustomer?.id }
          : { walkInName: walkInName.trim(), walkInPhone: walkInPhone.trim() }),
        ...(selectedProduct ? { productId: selectedProduct.id } : {}),
        deviceDescription: deviceDescription.trim(),
        serialNumber: serialNumber.trim() || undefined,
        reportedFault: reportedFault.trim(),
      };

      const response = await api.post('/repairs', payload);
      success(`Repair job ${response.data.jobNumber} created`);
      navigate(`/repairs/${response.data.id}`);
    } catch (err) {
      console.error('Failed to create repair job:', err);
      showError(getErrorMessage(err, 'Failed to create repair job'));
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="text-2xl font-semibold text-slate-900">New Repair Job</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl space-y-6"
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700 mb-1">Customer</legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomerMode('walkIn')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  customerMode === 'walkIn'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('registered')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                  customerMode === 'registered'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Registered customer
              </button>
            </div>

            {customerMode === 'walkIn' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Walk-in name"
                  required
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  error={errors.walkInName}
                />
                <Input
                  label="Walk-in phone"
                  required
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  error={errors.walkInPhone}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-900">{selectedCustomer.name}</p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-sm text-brand-600 hover:text-brand-800"
                      onClick={() => setSelectedCustomer(null)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      label="Search customer"
                      placeholder="Search by name or phone..."
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      error={errors.customer}
                    />
                    {customerResults.length > 0 && (
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {customerResults.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerQuery('');
                              setCustomerResults([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                          >
                            <span className="font-medium text-slate-900">{c.name}</span>
                            {c.phone && <span className="text-xs text-slate-500">{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700 mb-1">Device (from catalogue)</legend>
            <p className="text-xs text-slate-500">
              Optional - link this repair to a catalogue product so a workmanship warranty can be
              issued automatically at collection. Leave blank for a walk-in device with no
              catalogue match.
            </p>
            {selectedProduct ? (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                <div>
                  <p className="font-medium text-slate-900">{selectedProduct.name}</p>
                  <p className="text-xs text-slate-500">{selectedProduct.sku}</p>
                </div>
                <button
                  type="button"
                  className="text-sm text-brand-600 hover:text-brand-800"
                  onClick={() => setSelectedProduct(null)}
                >
                  Clear
                </button>
              </div>
            ) : (
              <>
                <Input
                  id="repair-product-search"
                  label="Search catalogue product"
                  placeholder="Search by name or SKU..."
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                />
                {productResults.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {productResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setProductQuery('');
                          setProductResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-900">{p.name}</span>
                        <span className="text-xs text-slate-500">{p.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </fieldset>

          <Input
            label="Device description"
            required
            placeholder="e.g. iPhone 13 Pro, cracked screen"
            value={deviceDescription}
            onChange={(e) => setDeviceDescription(e.target.value)}
            error={errors.deviceDescription}
          />

          <Input
            label="Serial number"
            helperText="Optional"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />

          <Textarea
            label="Reported fault"
            required
            rows={4}
            value={reportedFault}
            onChange={(e) => setReportedFault(e.target.value)}
            error={errors.reportedFault}
          />

          <div className="flex gap-4">
            <Button type="submit" loading={submitting}>
              Create Repair Job
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/repairs')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
