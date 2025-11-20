import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
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

interface Product {
  id: string;
  sku: string;
  name: string;
  categoryName?: string;
  unitPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  status: string;
}

export default function ProductListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    productId: string | null;
    productName: string | null;
  }>({
    isOpen: false,
    productId: null,
    productName: null,
  });

  useEffect(() => {
    fetchProducts();
  }, [page, search, sortBy, sortDir]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: '10',
        sortBy,
        sortDir,
      });
      if (search) params.append('search', search);

      const response = await api.get(`/products?${params}`);
      setProducts(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      showError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.productId) return;

    try {
      await api.delete(`/products/${deleteModal.productId}`);
      success(`Product "${deleteModal.productName}" deleted successfully`);
      closeDeleteModal();
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      showError('Failed to delete product');
    }
  };

  const openDeleteModal = (product: Product) => {
    setDeleteModal({
      isOpen: true,
      productId: product.id,
      productName: product.name,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      productId: null,
      productName: null,
    });
  };

  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      render: (product) => <span className="font-medium text-gray-900">{product.sku}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
    },
    {
      key: 'categoryName',
      header: 'Category',
      render: (product) => (
        <span className="text-gray-500">{product.categoryName || '-'}</span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'Price',
      sortable: true,
      render: (product) => `$${product.unitPrice.toFixed(2)}`,
    },
    {
      key: 'stockQuantity',
      header: 'Stock',
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-1">
          <span className={product.stockQuantity <= product.reorderLevel ? 'text-red-600 font-medium' : ''}>
            {product.stockQuantity}
          </span>
          {product.stockQuantity <= product.reorderLevel && (
            <span title="Low stock">
              <AlertCircle size={16} className="text-red-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (product) => (
        <Badge variant={product.status === 'ACTIVE' ? 'success' : 'default'}>
          {product.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (product) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/products/${product.id}/edit`);
            }}
            className="text-indigo-600 hover:text-indigo-900 p-1"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(product);
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
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Products</h1>
              <p className="text-blue-100">Manage your product inventory</p>
            </div>
            <Button onClick={() => navigate('/products/new')} icon={<Plus className="w-5 h-5" />}>
              Add Product
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <SearchInput
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={products}
            columns={columns}
            keyExtractor={(product) => product.id}
            loading={loading}
            emptyMessage="No products found. Create your first product!"
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
        <Modal isOpen={deleteModal.isOpen} onClose={closeDeleteModal} title="Delete Product" size="sm">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteModal.productName}</strong>? This action
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
