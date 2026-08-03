import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ui/Toast';

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
}

interface ProductBatchOption {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate?: string | null;
}

interface ProductSerialOption {
  id: string;
  serialNumber: string;
}

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  // WP3: optional batch/serial tracking - undefined/empty means "no tracking", which behaves
  // exactly as before this feature existed.
  batchId?: string;
  serialIds?: string[];
}

export default function SalesOrderFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { success, error: showError } = useToast();
  const isEdit = !!id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    tax: '0',
    notes: '',
  });

  const [items, setItems] = useState<OrderItem[]>([
    { productId: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 },
  ]);

  // WP3: per-product tracking options, and which lines have the "Tracking" section open.
  // Fetched lazily/non-blockingly - a failure here never blocks order creation, it just leaves
  // the batch/serial pickers empty for that product.
  const [batchOptions, setBatchOptions] = useState<Record<string, ProductBatchOption[]>>({});
  const [serialOptions, setSerialOptions] = useState<Record<string, ProductSerialOption[]>>({});
  const [trackingOpen, setTrackingOpen] = useState<Record<number, boolean>>({});

  // Keyboard-first line entry: Enter on the last field of a row adds a new line and focuses its
  // first field (Product). pendingFocusNewRow is set right before addItem() so the effect below
  // only steals focus for the keyboard-triggered add, not the "Add Item" button click.
  const productSelectRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const pendingFocusNewRow = useRef(false);

  const ensureTrackingOptions = async (productId: string) => {
    if (!productId) return;
    if (!(productId in batchOptions)) {
      try {
        const response = await api.get(`/batches/product/${productId}/active`);
        setBatchOptions((prev) => ({ ...prev, [productId]: response.data || [] }));
      } catch (error) {
        console.error('Failed to fetch batches for product:', error);
        setBatchOptions((prev) => ({ ...prev, [productId]: [] }));
      }
    }
    if (!(productId in serialOptions)) {
      try {
        const response = await api.get(`/serials/product/${productId}/available`);
        setSerialOptions((prev) => ({ ...prev, [productId]: response.data || [] }));
      } catch (error) {
        console.error('Failed to fetch serials for product:', error);
        setSerialOptions((prev) => ({ ...prev, [productId]: [] }));
      }
    }
  };

  const toggleTracking = (index: number) => {
    const nextOpen = !trackingOpen[index];
    setTrackingOpen((prev) => ({ ...prev, [index]: nextOpen }));
    if (nextOpen) {
      const productId = items[index]?.productId;
      if (productId) ensureTrackingOptions(productId);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    if (isEdit) {
      fetchOrder();
    }
  }, [id]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers?size=1000');
      setCustomers(response.data.content);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      // BUG FIX: size=1000 is PageSizeCap's own hard ceiling (see its Javadoc) - a catalogue that
      // grows past 1000 rows (this one has) silently drops whatever falls off the page, in
      // whatever order the backend happens to return with no sort specified. Sorting
      // newest-first means a product someone just created (the case this form actually cares
      // about - picking a product to add to a fresh sales order) stays on the page regardless of
      // how large the overall catalogue gets, instead of being pushed off by unrelated older rows.
      const response = await api.get('/products?size=1000&sortBy=createdAt&sortDir=DESC');
      setProducts(response.data.content);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/sales-orders/${id}`);
      const order = response.data;
      setFormData({
        customerId: order.customerId,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate || '',
        tax: order.tax.toString(),
        notes: order.notes || '',
      });
      const loadedItems = order.items.map((item: OrderItem) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        batchId: item.batchId || undefined,
        serialIds: item.serialIds && item.serialIds.length > 0 ? item.serialIds : undefined,
      }));
      setItems(loadedItems);
      loadedItems.forEach((item: OrderItem) => {
        if (item.productId) ensureTrackingOptions(item.productId);
      });
    } catch (error) {
      console.error('Failed to fetch order:', error);
    }
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId,
      unitPrice: product?.unitPrice || 0,
      // Product changed - any previously selected batch/serial no longer applies.
      batchId: undefined,
      serialIds: undefined,
    };
    setItems(newItems);
    if (productId) ensureTrackingOptions(productId);
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: OrderItem[keyof OrderItem]) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 }]);
  };

  const addItemFromKeyboard = () => {
    pendingFocusNewRow.current = true;
    addItem();
  };

  // Focuses the new row's Product field once it exists in the DOM, but only when the row was
  // added via the Enter-on-last-field shortcut (see addItemFromKeyboard above).
  useEffect(() => {
    if (pendingFocusNewRow.current) {
      pendingFocusNewRow.current = false;
      productSelectRefs.current[items.length - 1]?.focus();
    }
  }, [items.length]);

  const handleLastFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItemFromKeyboard();
    }
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateItemTotal = (item: OrderItem) => {
    return item.quantity * item.unitPrice - item.discount;
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + parseFloat(formData.tax || '0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        tax: parseFloat(formData.tax),
        deliveryDate: formData.deliveryDate || null,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: parseInt(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          discount: parseFloat(item.discount.toString()),
          taxRate: parseFloat(item.taxRate.toString()),
          // WP3: omitted entirely when not selected, so untracked lines post exactly the same
          // body as before this feature existed.
          ...(item.batchId ? { batchId: item.batchId } : {}),
          ...(item.serialIds && item.serialIds.length > 0 ? { serialIds: item.serialIds } : {}),
        })),
      };

      if (isEdit) {
        await api.put(`/sales-orders/${id}`, payload);
        success('Sales order updated successfully');
      } else {
        await api.post('/sales-orders', payload);
        success('Sales order created successfully');
      }

      navigate('/sales-orders');
    } catch (error) {
      console.error('Failed to save sales order:', error);
      showError(getErrorMessage(error, 'Failed to save sales order'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <button
            onClick={() => navigate('/sales-orders')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Sales Orders
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? 'Edit Sales Order' : 'New Sales Order'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Order Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sales-order-customer" className="block text-sm font-medium text-slate-700 mb-1">
                Customer *
              </label>
              <select
                id="sales-order-customer"
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                disabled={isEdit}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sales-order-date" className="block text-sm font-medium text-slate-700 mb-1">
                Order Date *
              </label>
              <input
                id="sales-order-date"
                type="date"
                required
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                disabled={isEdit}
              />
            </div>

            <div>
              <label htmlFor="sales-order-delivery-date" className="block text-sm font-medium text-slate-700 mb-1">
                Delivery Date
              </label>
              <input
                id="sales-order-delivery-date"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="sales-order-tax" className="block text-sm font-medium text-slate-700 mb-1">Tax</label>
              <input
                id="sales-order-tax"
                type="number"
                step="0.01"
                value={formData.tax}
                onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sales-order-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              id="sales-order-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Order Items</h2>
              <p className="text-xs text-slate-400 mt-0.5">Add line (Enter)</p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center px-3 py-1 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-slate-700">Item {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <label htmlFor={`sales-order-item-${index}-product`} className="block text-xs font-medium text-slate-700 mb-1">
                      Product *
                    </label>
                    <select
                      id={`sales-order-item-${index}-product`}
                      ref={(el) => { productSelectRefs.current[index] = el; }}
                      required
                      value={item.productId}
                      onChange={(e) => handleProductChange(index, e.target.value)}
                      tabIndex={index * 10 + 1}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} - {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={`sales-order-item-${index}-quantity`} className="block text-xs font-medium text-slate-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      id={`sales-order-item-${index}-quantity`}
                      type="number"
                      required
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, 'quantity', parseInt(e.target.value))
                      }
                      tabIndex={index * 10 + 2}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label htmlFor={`sales-order-item-${index}-unit-price`} className="block text-xs font-medium text-slate-700 mb-1">
                      Unit Price *
                    </label>
                    <input
                      id={`sales-order-item-${index}-unit-price`}
                      type="number"
                      required
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(index, 'unitPrice', parseFloat(e.target.value))
                      }
                      tabIndex={index * 10 + 3}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label htmlFor={`sales-order-item-${index}-discount`} className="block text-xs font-medium text-slate-700 mb-1">
                      Discount
                    </label>
                    <input
                      id={`sales-order-item-${index}-discount`}
                      type="number"
                      step="0.01"
                      value={item.discount}
                      onChange={(e) =>
                        handleItemChange(index, 'discount', parseFloat(e.target.value))
                      }
                      onKeyDown={handleLastFieldKeyDown}
                      tabIndex={index * 10 + 4}
                      title="Press Enter to add a new line"
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label htmlFor={`sales-order-item-${index}-total`} className="block text-xs font-medium text-slate-700 mb-1">
                      Total
                    </label>
                    <input
                      id={`sales-order-item-${index}-total`}
                      type="text"
                      value={formatMoney(calculateItemTotal(item))}
                      disabled
                      className="w-full px-2 py-1 text-sm border rounded bg-slate-50"
                    />
                  </div>
                </div>

                {/* WP3: optional batch/serial tracking - collapsed by default, skippable */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleTracking(index)}
                    disabled={!item.productId}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {trackingOpen[index] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Tracking (optional)
                    {(item.batchId || (item.serialIds && item.serialIds.length > 0)) && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[10px]">
                        set
                      </span>
                    )}
                  </button>

                  {trackingOpen[index] && item.productId && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div>
                        <label htmlFor={`sales-order-item-${index}-batch`} className="block text-xs font-medium text-slate-700 mb-1">
                          Batch
                        </label>
                        <select
                          id={`sales-order-item-${index}-batch`}
                          value={item.batchId || ''}
                          onChange={(e) =>
                            handleItemChange(index, 'batchId', e.target.value || undefined)
                          }
                          className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">No batch selected</option>
                          {(batchOptions[item.productId] || []).map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.batchNumber} (qty {batch.quantity}
                              {batch.expiryDate ? `, exp ${batch.expiryDate}` : ''})
                            </option>
                          ))}
                        </select>
                        {(batchOptions[item.productId] || []).length === 0 && (
                          <p className="mt-1 text-xs text-slate-400">No active batches for this product</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`sales-order-item-${index}-serials`} className="block text-xs font-medium text-slate-700 mb-1">
                          Serial numbers ({item.serialIds?.length || 0} selected, max {item.quantity})
                        </label>
                        <select
                          id={`sales-order-item-${index}-serials`}
                          multiple
                          value={item.serialIds || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                            handleItemChange(index, 'serialIds', selected.length > 0 ? selected : undefined);
                          }}
                          className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500 h-20"
                        >
                          {(serialOptions[item.productId] || []).map((serial) => (
                            <option key={serial.id} value={serial.id}>
                              {serial.serialNumber}
                            </option>
                          ))}
                        </select>
                        {(serialOptions[item.productId] || []).length === 0 && (
                          <p className="mt-1 text-xs text-slate-400">No available serials for this product</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-medium">{formatMoney(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tax:</span>
              <span className="font-medium">{formatMoney(parseFloat(formData.tax || '0'))}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>{formatMoney(calculateTotal())}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Order' : 'Create Order'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales-orders')}
            className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        </form>
      </div>
    </Layout>
  );
}
