import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, AlertCircle, Upload } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { getProductImage, getProductImagePlaceholder } from '../../lib/product-image';
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
  imageUrl?: string | null;
}

interface ImportRowError {
  row: number;
  message: string;
}

interface ProductImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: ImportRowError[];
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

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

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

  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
    if (importFileInputRef.current) importFileInputRef.current.value = '';
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      showError('Choose a CSV file first');
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      const response = await api.post<ProductImportResult>('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(response.data);
      success(`Imported ${response.data.imported} product(s)`);
      fetchProducts();
    } catch (err) {
      console.error('Failed to import products:', err);
      showError('Failed to import products');
    } finally {
      setImporting(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'imageUrl',
      header: 'Photo',
      render: (product) => (
        <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 shrink-0">
          <img
            src={getProductImage(product)}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = getProductImagePlaceholder(product);
            }}
          />
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      render: (product) => <span className="font-medium text-slate-900">{product.sku}</span>,
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
        <span className="text-slate-500">{product.categoryName || '-'}</span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'Price',
      sortable: true,
      render: (product) => formatMoney(product.unitPrice),
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
            className="text-brand-600 hover:text-brand-900 p-1"
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
        {/* Page Header */}
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your product inventory</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={openImportModal}
                icon={<Upload className="w-5 h-5" />}
                data-testid="import-products-csv-button"
              >
                Import CSV
              </Button>
              <Button onClick={() => navigate('/products/new')} icon={<Plus className="w-5 h-5" />}>
                New Product
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
          <p className="text-slate-600">
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

        {/* Import CSV Modal */}
        <Modal isOpen={importModalOpen} onClose={closeImportModal} title="Import Products CSV" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Columns: <code>sku, name, category, costPrice, unitPrice, stockQuantity</code>, plus
              optional <code>condition, tags, acquisitionCost</code>. The first row must be a header.
            </p>
            <div>
              <label htmlFor="product-import-file" className="block text-sm font-medium text-slate-700 mb-1">
                CSV file
              </label>
              <input
                id="product-import-file"
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                data-testid="import-products-csv-file-input"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-700"
              />
            </div>

            {importResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="text-slate-700">
                  Imported <strong>{importResult.imported}</strong>, skipped{' '}
                  <strong>{importResult.skipped}</strong>, duplicates{' '}
                  <strong>{importResult.duplicates}</strong>.
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc list-inside text-red-600 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={closeImportModal}>
              Close
            </Button>
            <Button
              onClick={handleImportSubmit}
              loading={importing}
              icon={<Upload className="w-4 h-4" />}
              data-testid="import-products-csv-submit"
            >
              Import
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </Layout>
  );
}
