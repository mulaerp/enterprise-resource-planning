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

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  status: string;
}

export default function SupplierListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    supplierId: string | null;
    supplierName: string | null;
  }>({
    isOpen: false,
    supplierId: null,
    supplierName: null,
  });

  useEffect(() => {
    fetchSuppliers();
  }, [page, search, sortBy, sortDir]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: '10',
        sortBy,
        sortDir,
      });
      if (search) params.append('search', search);

      const response = await api.get(`/suppliers?${params}`);
      setSuppliers(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.supplierId) return;

    try {
      await api.delete(`/suppliers/${deleteModal.supplierId}`);
      toast.success(`Supplier "${deleteModal.supplierName}" deleted successfully`);
      closeDeleteModal();
      fetchSuppliers();
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      toast.error('Failed to delete supplier');
    }
  };

  const openDeleteModal = (supplier: Supplier) => {
    setDeleteModal({
      isOpen: true,
      supplierId: supplier.id,
      supplierName: supplier.name,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      supplierId: null,
      supplierName: null,
    });
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (supplier) => <span className="font-medium text-gray-900">{supplier.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (supplier) => (
        <span className="text-gray-500">{supplier.email || '-'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (supplier) => (
        <span className="text-gray-500">{supplier.phone || '-'}</span>
      ),
    },
    {
      key: 'paymentTerms',
      header: 'Payment Terms',
      render: (supplier) => (
        <span className="text-gray-500">{supplier.paymentTerms || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (supplier) => (
        <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'default'}>
          {supplier.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (supplier) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/suppliers/${supplier.id}/edit`);
            }}
            className="text-indigo-600 hover:text-indigo-900 p-1"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(supplier);
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
        <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Suppliers</h1>
              <p className="text-orange-100">Manage your supplier network</p>
            </div>
            <Button onClick={() => navigate('/suppliers/new')} icon={<Plus className="w-5 h-5" />}>
              Add Supplier
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
            data={suppliers}
            columns={columns}
            keyExtractor={(supplier) => supplier.id}
            loading={loading}
            emptyMessage="No suppliers found. Create your first supplier!"
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
        <Modal isOpen={deleteModal.isOpen} onClose={closeDeleteModal} title="Delete Supplier" size="sm">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteModal.supplierName}</strong>? This action
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
