import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import Layout from '../../components/Layout';
import { DataTable, SearchInput, Button, Badge, useToast, type Column } from '../../components/ui';

interface Member {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  tier: string;
  discountPercent: number;
}

export default function MembersListPage() {
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), size: '10' });
      if (search) params.append('search', search);

      const response = await api.get(`/members?${params}`);
      setMembers(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      showError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (member) => (
        <div>
          <span className="font-medium text-slate-900">{member.name}</span>
          <p className="text-xs text-slate-500">{member.code}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
    },
    {
      key: 'email',
      header: 'Email',
      render: (member) => <span className="text-slate-500">{member.email || '-'}</span>,
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (member) => <Badge variant="info">{member.tier}</Badge>,
    },
    {
      key: 'points',
      header: 'Points',
      className: 'tabular-nums',
    },
    {
      key: 'discountPercent',
      header: 'Discount',
      render: (member) => `${member.discountPercent}%`,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (member) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/pos/members/${member.id}/edit`);
            }}
            className="text-brand-600 hover:text-brand-900 p-1"
            title="Edit"
            aria-label="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Point of Sale
          </button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
              <p className="text-sm text-slate-500 mt-1">Manage loyalty members and their discount tier</p>
            </div>
            <Button onClick={() => navigate('/pos/members/new')} icon={<Plus className="w-5 h-5" />}>
              Add Member
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <SearchInput
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={members}
            columns={columns}
            keyExtractor={(member) => member.id}
            loading={loading}
            emptyMessage="No members found. Add your first member!"
            pagination={{
              currentPage: page,
              totalPages,
              onPageChange: setPage,
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
