import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  total: number;
  balanceDue: number;
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/invoices');
      setInvoices(response.data.content || []);
    } catch (error) {
      showToast('error', 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchInvoices();
      return;
    }

    try {
      const response = await api.get(`/invoices/search?query=${searchQuery}`);
      setInvoices(response.data.content || []);
    } catch (error) {
      showToast('error', 'Search failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await api.delete(`/invoices/${id}`);
      showToast('success', 'Invoice deleted successfully');
      fetchInvoices();
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Failed to delete invoice');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
      DRAFT: 'default',
      SENT: 'warning',
      PAID: 'success',
      OVERDUE: 'danger',
      CANCELLED: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'customerName', header: 'Customer' },
    { key: 'invoiceDate', header: 'Invoice Date', render: (row: Invoice) => new Date(row.invoiceDate).toLocaleDateString() },
    { key: 'dueDate', header: 'Due Date', render: (row: Invoice) => new Date(row.dueDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (row: Invoice) => getStatusBadge(row.status) },
    { key: 'total', header: 'Total', render: (row: Invoice) => `$${row.total.toFixed(2)}` },
    { key: 'balanceDue', header: 'Balance', render: (row: Invoice) => `$${row.balanceDue.toFixed(2)}` },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: Invoice) => (
        <div className="flex gap-2">
          <Link to={`/invoices/${row.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {row.status === 'DRAFT' && (
            <>
              <Link to={`/invoices/${row.id}/edit`}>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
    <div className="space-y-6">
      {/* Gradient Banner Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Invoices</h1>
            <p className="text-indigo-100">Create and manage customer invoices</p>
          </div>
          <Link to="/invoices/new">
            <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30">
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        keyExtractor={(inv) => inv.id}
      />
    </div>
    </Layout>
  );
}
