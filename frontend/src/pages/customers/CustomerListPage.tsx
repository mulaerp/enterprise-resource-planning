import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import Layout from '../../components/Layout';
import {
  DataTable,
  SearchInput,
  Button,
  Badge,
  Modal,
  ModalFooter,
  useToast,
  type Column,
} from '../../components/ui';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  status: string;
}

export default function CustomerListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    customerId: string | null;
    customerName: string | null;
  }>({
    isOpen: false,
    customerId: null,
    customerName: null,
  });

  useEffect(() => {
    fetchCustomers();
  }, [page, search, sortBy, sortDir]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: '10',
        sortBy,
        sortDir,
      });
      if (search) params.append('search', search);

      const response = await api.get(`/customers?${params}`);
      setCustomers(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      showError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.customerId) return;

    try {
      await api.delete(`/customers/${deleteModal.customerId}`);
      success(`Customer "${deleteModal.customerName}" deleted successfully`);
      closeDeleteModal();
      fetchCustomers();
    } catch (err) {
      console.error('Failed to delete customer:', err);
      showError('Failed to delete customer');
    }
  };

  const openDeleteModal = (customer: Customer) => {
    setDeleteModal({
      isOpen: true,
      customerId: customer.id,
      customerName: customer.name,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      customerId: null,
      customerName: null,
    });
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (customer) => <span className="font-medium text-gray-900">{customer.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (customer) => (
        <span className="text-gray-500">{customer.email || '-'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (customer) => (
        <span className="text-gray-500">{customer.phone || '-'}</span>
      ),
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      sortable: true,
      render: (customer) => `$${customer.creditLimit.toFixed(2)}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (customer) => (
        <Badge variant={customer.status === 'ACTIVE' ? 'success' : 'default'}>
          {customer.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (customer) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/customers/${customer.id}/edit`);
            }}
            className="text-indigo-600 hover:text-indigo-900 p-1"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(customer);
            }}
            className="text-red-600 hover:text-red-900 p-1"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header with Gradient */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Customers</h1>
              <p className="text-green-100">Manage your customer relationships</p>
            </div>
            <Button onClick={() => navigate('/customers/new')} icon={<Plus className="w-5 h-5" />}>
              Add Customer
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <SearchInput
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={customers}
            columns={columns}
            keyExtractor={(customer) => customer.id}
            loading={loading}
            emptyMessage="No customers found. Create your first customer!"
            pagination={{
              currentPage: page,
              totalPages,
              onPageChange: setPage,
            }}
            sorting={{
              sortBy,
              sortDir,
              onSortChange: (newSortBy, newSortDir) => {
                setSortBy(newSortBy);
                setSortDir(newSortDir);
              },
            }}
          />
        </div>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={deleteModal.isOpen} onClose={closeDeleteModal} title="Delete Customer" size="sm">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteModal.customerName}</strong>? This action
            cannot be undone.
          </p>
          <ModalFooter>
            <Button variant="ghost" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </Layout>
  );
}
