import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Boxes } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
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

interface Warehouse {
  id: string;
  code: string;
  name: string;
  address?: string;
  active: boolean;
}

export default function WarehouseListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    warehouseId: string | null;
    warehouseName: string | null;
  }>({
    isOpen: false,
    warehouseId: null,
    warehouseName: null,
  });

  useEffect(() => {
    fetchWarehouses();
  }, [page, search, sortBy, sortDir]);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: '10',
        sortBy,
        sortDir,
      });
      if (search) params.append('search', search);

      const response = await api.get(`/warehouses?${params}`);
      setWarehouses(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
      showError('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.warehouseId) return;

    try {
      await api.delete(`/warehouses/${deleteModal.warehouseId}`);
      success(`Warehouse "${deleteModal.warehouseName}" deleted successfully`);
      closeDeleteModal();
      fetchWarehouses();
    } catch (err) {
      console.error('Failed to delete warehouse:', err);
      showError(getErrorMessage(err, 'Failed to delete warehouse'));
    }
  };

  const openDeleteModal = (warehouse: Warehouse) => {
    setDeleteModal({
      isOpen: true,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      warehouseId: null,
      warehouseName: null,
    });
  };

  const columns: Column<Warehouse>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (warehouse) => <span className="font-medium text-slate-900">{warehouse.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'address',
      header: 'Address',
      render: (warehouse) => <span className="text-slate-500">{warehouse.address || '-'}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (warehouse) => (
        <Badge variant={warehouse.active ? 'success' : 'default'}>
          {warehouse.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (warehouse) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/inventory/warehouses/${warehouse.id}/stock`);
            }}
            className="text-brand-600 hover:text-brand-900 p-1"
            title="View Stock"
          >
            <Boxes className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/inventory/warehouses/${warehouse.id}/edit`);
            }}
            className="text-brand-600 hover:text-brand-900 p-1"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(warehouse);
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
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Warehouses</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your warehouse locations</p>
          </div>
          <Button
            onClick={() => navigate('/inventory/warehouses/new')}
            icon={<Plus className="w-5 h-5" />}
          >
            Add Warehouse
          </Button>
        </div>

        <div className="space-y-4">
          <SearchInput
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={warehouses}
            columns={columns}
            keyExtractor={(warehouse) => warehouse.id}
            loading={loading}
            emptyMessage="No warehouses found. Create your first warehouse!"
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
        <Modal isOpen={deleteModal.isOpen} onClose={closeDeleteModal} title="Delete Warehouse" size="sm">
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{deleteModal.warehouseName}</strong>? This action
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
