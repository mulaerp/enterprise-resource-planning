import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import Layout from '../../components/Layout';
import DataTable from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

interface Payment {
  id: string;
  paymentNumber: string;
  invoiceNumber: string;
  paymentDate: string;
  amount: number;
  method: string;
  status: string;
}

export default function PaymentListPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payments');
      setPayments(response.data.content || []);
    } catch (error) {
      showToast('Failed to fetch payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchPayments();
      return;
    }

    try {
      const response = await api.get(`/payments/search?query=${searchQuery}`);
      setPayments(response.data.content || []);
    } catch (error) {
      showToast('Search failed', 'error');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
      PENDING: 'warning',
      COMPLETED: 'success',
      FAILED: 'error',
      CANCELLED: 'error',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const columns = [
    { key: 'paymentNumber', header: 'Payment #' },
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'paymentDate', header: 'Date', render: (row: Payment) => new Date(row.paymentDate).toLocaleDateString() },
    { key: 'amount', header: 'Amount', render: (row: Payment) => `$${row.amount.toFixed(2)}` },
    { key: 'method', header: 'Method' },
    { key: 'status', header: 'Status', render: (row: Payment) => getStatusBadge(row.status) },
  ];

  return (
    <Layout>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Payments</h1>
        <Link to="/payments/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search payments..."
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
        data={payments}
        loading={loading}
        keyExtractor={(pay) => pay.id}
      />
    </div>
    </Layout>
  );
}
