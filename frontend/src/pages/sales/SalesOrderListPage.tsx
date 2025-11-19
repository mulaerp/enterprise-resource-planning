import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
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

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  total: number;
}

export default function SalesOrderListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('orderDate');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    orderId: string | null;
    orderNumber: string | null;
  }>({
    isOpen: false,
    orderId: null,
    orderNumber: null,
  });

  useEffect(() => {
    fetchOrders();
  }, [search, page, sortBy, sortDir]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: '10',
        sortBy,
        sortDir,
      });
      if (search) params.append('search', search);

      const response = await api.get(`/sales-orders?${params}`);
      setOrders(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch sales orders:', error);
      toast.error('Failed to load sales orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.orderId) return;

    try {
      await api.delete(`/sales-orders/${deleteModal.orderId}`);
      toast.success(`Sales order "${deleteModal.orderNumber}" deleted successfully`);
      closeDeleteModal();
      fetchOrders();
    } catch (error) {
      console.error('Failed to delete sales order:', error);
      toast.error('Failed to delete sales order');
    }
  };

  const openDeleteModal = (order: SalesOrder) => {
    setDeleteModal({
      isOpen: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      orderId: null,
      orderNumber: null,
    });
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      DRAFT: 'default',
      CONFIRMED: 'info',
      DELIVERED: 'success',
      INVOICED: 'warning',
      CANCELLED: 'danger',
    };
    return variants[status] || 'default';
  };

  const columns: Column<SalesOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order Number',
      sortable: true,
      render: (order) => <span className="font-medium text-gray-900">{order.orderNumber}</span>,
    },
    {
      key: 'customerName',
      header: 'Customer',
      sortable: true,
    },
    {
      key: 'orderDate',
      header: 'Order Date',
      sortable: true,
      render: (order) => new Date(order.orderDate).toLocaleDateString(),
    },
    {
      key: 'deliveryDate',
      header: 'Delivery Date',
      render: (order) =>
        order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (order) => `$${order.total.toFixed(2)}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (order) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/sales-orders/${order.id}`);
            }}
            className="text-blue-600 hover:text-blue-900 p-1"
            title="View"
          >
            <Eye className="w-5 h-5" />
          </button>
          {order.status === 'DRAFT' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/sales-orders/${order.id}/edit`);
                }}
                className="text-indigo-600 hover:text-indigo-900 p-1"
                title="Edit"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(order);
                }}
                className="text-red-600 hover:text-red-900 p-1"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
          <Button onClick={() => navigate('/sales-orders/new')} icon={<Plus className="w-5 h-5" />}>
            New Sales Order
          </Button>
        </div>

        <div className="space-y-4">
          <SearchInput
            placeholder="Search by order number or customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={orders}
            columns={columns}
            keyExtractor={(order) => order.id}
            loading={loading}
            emptyMessage="No sales orders found. Create your first sales order!"
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
        <Modal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          title="Delete Sales Order"
          size="sm"
        >
          <p className="text-gray-600">
            Are you sure you want to delete order <strong>{deleteModal.orderNumber}</strong>? This
            action cannot be undone.
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
