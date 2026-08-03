import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { Button, Input, Select, useToast } from '../../components/ui';

interface VoucherForm {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: string;
  minSpend: string;
  expiresAt: string;
  usageLimit: string;
}

export default function VoucherFormPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<VoucherForm>({
    code: '',
    type: 'PERCENT',
    value: '',
    minSpend: '',
    expiresAt: '',
    usageLimit: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        type: formData.type,
        value: parseFloat(formData.value),
        minSpend: formData.minSpend ? parseFloat(formData.minSpend) : undefined,
        expiresAt: formData.expiresAt || undefined,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : undefined,
      };

      await api.post('/vouchers', payload);
      success('Voucher created');
      navigate('/pos/vouchers');
    } catch (err) {
      console.error('Failed to save voucher:', err);
      showError(getErrorMessage(err, 'Failed to save voucher'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/pos/vouchers')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Vouchers
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">Add New Voucher</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Code"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g. WELCOME10"
            />

            <Select
              label="Type"
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PERCENT' | 'FIXED' })}
              options={[
                { value: 'PERCENT', label: 'Percent off' },
                { value: 'FIXED', label: 'Fixed amount off' },
              ]}
            />

            <Input
              label="Value"
              type="number"
              min="0"
              step="0.01"
              required
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              helperText={formData.type === 'PERCENT' ? 'Percent, e.g. 10 for 10%' : 'Amount off, e.g. 5.00'}
            />

            <Input
              label="Min Spend"
              type="number"
              min="0"
              step="0.01"
              value={formData.minSpend}
              onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
            />

            <Input
              label="Expiry Date"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />

            <Input
              label="Usage Limit"
              type="number"
              min="1"
              value={formData.usageLimit}
              onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
              helperText="Leave blank for unlimited"
            />
          </div>

          <div className="mt-6 flex gap-4">
            <Button type="submit" loading={loading}>
              Create Voucher
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/pos/vouchers')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
