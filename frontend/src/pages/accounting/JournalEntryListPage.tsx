import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import api from '../../lib/api';

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  status: string;
  reference?: string;
}

export default function JournalEntryListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const response = await api.get('/accounting/journal-entries');
      setEntries(response.data);
    } catch (err) {
      showError('Failed to fetch journal entries');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (id: string) => {
    if (!confirm('Are you sure you want to post this journal entry?')) return;

    try {
      await api.post(`/accounting/journal-entries/${id}/post`);
      success('Journal entry posted successfully');
      fetchEntries();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to post journal entry');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) return;

    try {
      await api.delete(`/accounting/journal-entries/${id}`);
      success('Journal entry deleted successfully');
      fetchEntries();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to delete journal entry');
    }
  };

  const columns = [
    { key: 'entryNumber', header: 'Entry #' },
    {
      key: 'entryDate',
      header: 'Date',
      render: (entry: JournalEntry) => new Date(entry.entryDate).toLocaleDateString(),
    },
    { key: 'description', header: 'Description' },
    { key: 'reference', header: 'Reference' },
    {
      key: 'status',
      header: 'Status',
      render: (entry: JournalEntry) => (
        <span className={`px-2 py-1 rounded text-xs ${
          entry.status === 'POSTED' ? 'bg-green-100 text-green-800' :
          entry.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {entry.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (entry: JournalEntry) => (
        <div className="flex gap-2">
          {entry.status === 'DRAFT' && (
            <>
              <button
                onClick={() => navigate(`/accounting/journal-entries/${entry.id}/edit`)}
                className="text-blue-600 hover:text-blue-800"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePost(entry.id)}
                className="text-green-600 hover:text-green-800"
                title="Post"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-red-600 hover:text-red-800"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {entry.status === 'POSTED' && (
            <button
              onClick={() => navigate(`/accounting/journal-entries/${entry.id}`)}
              className="text-blue-600 hover:text-blue-800"
            >
              View
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      {/* Gradient Banner Header */}
      <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 rounded-xl shadow-lg p-8 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Journal Entries</h1>
            <p className="text-teal-100">Record and manage double-entry accounting transactions</p>
          </div>
          <Button 
            onClick={() => navigate('/accounting/journal-entries/new')}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={entries}
        keyExtractor={(entry) => entry.id} />
    </div>
  );
}
