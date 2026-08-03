import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { getProductImage, getProductImagePlaceholder } from '../../lib/product-image';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ui/Toast';

interface Category {
  id: string;
  name: string;
}

interface ProductForm {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  unitPrice: string;
  costPrice: string;
  stockQuantity: string;
  reorderLevel: string;
  status: string;
  warrantyMonths: string;
  buyPrice: string;
}

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const isEdit = !!id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProductForm>({
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    unitPrice: '0',
    costPrice: '0',
    stockQuantity: '0',
    reorderLevel: '0',
    status: 'ACTIVE',
    warrantyMonths: '',
    buyPrice: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProductForm, string>>>({});

  // WP: product images - optional photo upload, wired up as a two-step save (product first,
  // then the image via POST /products/{id}/image) since the multipart upload endpoint needs an
  // existing product id.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [existingCategoryName, setExistingCategoryName] = useState<string>('');

  // Recomputed only when the chosen file changes, and revoked on cleanup - avoids leaking a
  // fresh blob: URL on every render.
  const imagePreviewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    fetchCategories();
    if (isEdit) {
      fetchProduct();
    }
  }, [id]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/products/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      const product = response.data;
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        categoryId: product.categoryId || '',
        unitPrice: product.unitPrice.toString(),
        costPrice: product.costPrice.toString(),
        stockQuantity: product.stockQuantity.toString(),
        reorderLevel: product.reorderLevel.toString(),
        status: product.status,
        warrantyMonths: product.warrantyMonths != null ? product.warrantyMonths.toString() : '',
        buyPrice: product.buyPrice != null ? product.buyPrice.toString() : '',
      });
      setExistingImageUrl(product.imageUrl ?? null);
      setExistingCategoryName(product.categoryName ?? '');
    } catch (error) {
      console.error('Failed to fetch product:', error);
      showError('Failed to load product');
    }
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof ProductForm, string>> = {};
    if (!formData.sku.trim()) nextErrors.sku = 'SKU is required';
    if (!formData.name.trim()) nextErrors.name = 'Name is required';
    if (formData.unitPrice.trim() === '' || Number.isNaN(parseFloat(formData.unitPrice))) {
      nextErrors.unitPrice = 'Unit price is required';
    }
    if (formData.costPrice.trim() === '' || Number.isNaN(parseFloat(formData.costPrice))) {
      nextErrors.costPrice = 'Cost price is required';
    }
    if (formData.stockQuantity.trim() === '' || Number.isNaN(parseInt(formData.stockQuantity))) {
      nextErrors.stockQuantity = 'Stock quantity is required';
    }
    if (formData.reorderLevel.trim() === '' || Number.isNaN(parseInt(formData.reorderLevel))) {
      nextErrors.reorderLevel = 'Reorder level is required';
    }
    if (formData.warrantyMonths.trim() !== '' && Number.isNaN(parseInt(formData.warrantyMonths))) {
      nextErrors.warrantyMonths = 'Enter a whole number of months';
    }
    if (formData.buyPrice.trim() !== '' && Number.isNaN(parseFloat(formData.buyPrice))) {
      nextErrors.buyPrice = 'Enter a valid price';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        categoryId: formData.categoryId || null,
        unitPrice: parseFloat(formData.unitPrice),
        costPrice: parseFloat(formData.costPrice),
        stockQuantity: parseInt(formData.stockQuantity),
        reorderLevel: parseInt(formData.reorderLevel),
        warrantyMonths: formData.warrantyMonths.trim() === '' ? null : parseInt(formData.warrantyMonths, 10),
        buyPrice: formData.buyPrice.trim() === '' ? null : parseFloat(formData.buyPrice),
      };

      let productId = id;

      if (isEdit) {
        await api.put(`/products/${id}`, payload);
      } else {
        const created = await api.post('/products', payload);
        productId = created.data.id;
      }

      if (imageFile && productId) {
        try {
          const imageFormData = new FormData();
          imageFormData.append('file', imageFile);
          await api.post(`/products/${productId}/image`, imageFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (imageError) {
          // Non-blocking: the product itself saved fine, only the photo upload failed.
          console.error('Failed to upload product photo:', imageError);
          showError(getErrorMessage(imageError, 'Product saved, but the photo upload failed'));
        }
      }

      success(isEdit ? 'Product updated successfully' : 'Product created successfully');
      navigate('/products');
    } catch (error) {
      console.error('Failed to save product:', error);
      showError(getErrorMessage(error, 'Failed to save product'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <button
            onClick={() => navigate('/products')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Products
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h1>
        </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="product-sku" className="block text-sm font-medium text-slate-700 mb-2">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              id="product-sku"
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              disabled={isEdit}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
            />
            {errors.sku && <p className="text-red-500 text-sm mt-1">{errors.sku}</p>}
          </div>

          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-slate-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="product-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="product-description" className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              id="product-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="product-category" className="block text-sm font-medium text-slate-700 mb-2">
              Category
            </label>
            <select
              id="product-category"
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="product-status" className="block text-sm font-medium text-slate-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="product-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div>
            <label htmlFor="product-unit-price" className="block text-sm font-medium text-slate-700 mb-2">
              Unit Price <span className="text-red-500">*</span>
            </label>
            <input
              id="product-unit-price"
              type="number"
              name="unitPrice"
              value={formData.unitPrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="product-cost-price" className="block text-sm font-medium text-slate-700 mb-2">
              Cost Price <span className="text-red-500">*</span>
            </label>
            <input
              id="product-cost-price"
              type="number"
              name="costPrice"
              value={formData.costPrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="product-stock-quantity" className="block text-sm font-medium text-slate-700 mb-2">
              Stock Quantity <span className="text-red-500">*</span>
            </label>
            <input
              id="product-stock-quantity"
              type="number"
              name="stockQuantity"
              value={formData.stockQuantity}
              onChange={handleChange}
              min="0"
              required
              readOnly={isEdit}
              disabled={isEdit}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
            {/* PROBLEM 2 fix: stock is no longer editable here - the server ignores this field on
                PUT /products/{id} (ProductService#updateProduct). Stock changes must flow through
                InventoryService adjustments so every change gets a StockMovement ledger row. */}
            {isEdit && (
              <p className="text-xs text-slate-500 mt-1">
                Stock quantity can&apos;t be edited here.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/inventory/adjustments/new')}
                  className="text-brand-600 hover:text-brand-800 underline"
                >
                  Create a stock adjustment
                </button>{' '}
                instead.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="product-reorder-level" className="block text-sm font-medium text-slate-700 mb-2">
              Reorder Level <span className="text-red-500">*</span>
            </label>
            <input
              id="product-reorder-level"
              type="number"
              name="reorderLevel"
              value={formData.reorderLevel}
              onChange={handleChange}
              min="0"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="product-warranty-months" className="block text-sm font-medium text-slate-700 mb-2">
              Warranty (months)
            </label>
            <input
              id="product-warranty-months"
              type="number"
              name="warrantyMonths"
              value={formData.warrantyMonths}
              onChange={handleChange}
              min="0"
              step="1"
              placeholder="Optional - leave blank for no warranty"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.warrantyMonths && <p className="text-red-500 text-sm mt-1">{errors.warrantyMonths}</p>}
          </div>

          <div>
            <label htmlFor="product-buy-price" className="block text-sm font-medium text-slate-700 mb-2">
              Buy price (trade-in)
            </label>
            <input
              id="product-buy-price"
              type="number"
              name="buyPrice"
              value={formData.buyPrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              placeholder="Optional - leave blank if we don't buy this"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.buyPrice && <p className="text-red-500 text-sm mt-1">{errors.buyPrice}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="product-photo" className="block text-sm font-medium text-slate-700 mb-2">
              Product photo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                <img
                  src={
                    imagePreviewUrl ??
                    getProductImage({ imageUrl: existingImageUrl, categoryName: existingCategoryName })
                  }
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getProductImagePlaceholder({ categoryName: existingCategoryName });
                  }}
                />
              </div>
              <input
                id="product-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-700"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Optional. JPG, PNG or WEBP, up to 5MB.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-600 text-white px-6 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300"
          >
            Cancel
          </button>
        </div>
      </form>
      </div>
    </Layout>
  );
}
