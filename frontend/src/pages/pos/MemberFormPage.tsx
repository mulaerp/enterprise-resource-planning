import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import Layout from '../../components/Layout';
import { Button, Input, useToast } from '../../components/ui';

interface MemberForm {
  name: string;
  phone: string;
  email: string;
}

export default function MemberFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MemberForm>({ name: '', phone: '', email: '' });

  useEffect(() => {
    if (isEdit) {
      fetchMember();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchMember = async () => {
    try {
      const response = await api.get(`/members/${id}`);
      const member = response.data;
      setFormData({
        name: member.name,
        phone: member.phone,
        email: member.email || '',
      });
    } catch (err) {
      console.error('Failed to fetch member:', err);
      showError('Failed to load member');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
      };

      if (isEdit) {
        await api.put(`/members/${id}`, payload);
      } else {
        await api.post('/members', payload);
      }

      success(isEdit ? 'Member updated' : 'Member created');
      navigate('/pos/members');
    } catch (err) {
      console.error('Failed to save member:', err);
      showError(getErrorMessage(err, 'Failed to save member'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/pos/members')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Members
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">{isEdit ? 'Edit Member' : 'Add New Member'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Input
                label="Name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <Input
              label="Phone"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="mt-6 flex gap-4">
            <Button type="submit" loading={loading}>
              {isEdit ? 'Update Member' : 'Create Member'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/pos/members')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
