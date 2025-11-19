import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface JournalEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

interface JournalEntryForm {
  entryDate: string;
  description: string;
  reference?: string;
  lines: JournalEntryLine[];
}

export default function JournalEntryFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  const { register, control, handleSubmit, formState: { errors }, reset, watch } = useForm<JournalEntryForm>({
    defaultValues: {
      entryDate: new Date().toISOString().split('T')[0],
      lines: [
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const lines = watch('lines');

  useEffect(() => {
    fetchAccounts();
    if (id) {
      fetchEntry();
    }
  }, [id]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounting/accounts');
      setAccounts(response.data.filter((a: any) => a.isActive));
    } catch (error) {
      toast.error('Failed to fetch accounts');
    }
  };

  const fetchEntry = async () => {
    try {
      const response = await api.get(`/accounting/journal-entries/${id}`);
      reset(response.data);
    } catch (error) {
      toast.error('Failed to fetch journal entry');
    }
  };

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    const difference = totalDebits - totalCredits;
    return { totalDebits, totalCredits, difference };
  };

  const onSubmit = async (data: JournalEntryForm) => {
    const { difference } = calculateTotals();
    if (Math.abs(difference) > 0.01) {
      toast.error('Journal entry must be balanced (debits = credits)');
      return;
    }

    setLoading(true);
    try {
      if (id) {
        await api.put(`/accounting/journal-entries/${id}`, data);
        toast.success('Journal entry updated successfully');
      } else {
        await api.post('/accounting/journal-entries', data);
        toast.success('Journal entry created successfully');
      }
      navigate('/accounting/journal-entries');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save journal entry');
    } finally {
      setLoading(false);
    }
  };

  const { totalDebits, totalCredits, difference } = calculateTotals();

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">
        {id ? 'Edit Journal Entry' : 'New Journal Entry'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              {...register('entryDate', { required: 'Date is required' })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {errors.entryDate && (
              <p className="text-red-500 text-sm mt-1">{errors.entryDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reference</label>
            <input
              {...register('reference')}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Reference number"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description *</label>
          <textarea
            {...register('description', { required: 'Description is required' })}
            className="w-full px-3 py-2 border rounded-lg"
            rows={2}
            placeholder="Entry description"
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Lines</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ accountId: '', debit: 0, credit: 0, description: '' })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Line
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium">Account</th>
                  <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
                  <th className="px-4 py-2 text-right text-sm font-medium">Debit</th>
                  <th className="px-4 py-2 text-right text-sm font-medium">Credit</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-t">
                    <td className="px-4 py-2">
                      <select
                        {...register(`lines.${index}.accountId`, { required: true })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      >
                        <option value="">Select account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        {...register(`lines.${index}.description`)}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Line description"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.debit`)}
                        className="w-full px-2 py-1 border rounded text-sm text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lines.${index}.credit`)}
                        className="w-full px-2 py-1 border rounded text-sm text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {fields.length > 2 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right font-semibold">
                    Totals:
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    ${totalDebits.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    ${totalCredits.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
                {Math.abs(difference) > 0.01 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-center text-red-600 text-sm">
                      Out of balance by ${Math.abs(difference).toFixed(2)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/accounting/journal-entries')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
