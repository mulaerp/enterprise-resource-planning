import React, { useState } from 'react';
import { X, Save, ShoppingBag, Plus, Trash2 } from 'lucide-react';

interface PurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface AddPurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (purchaseOrder: any) => void;
  suppliers: any[];
}

export default function AddPurchaseOrderModal({ isOpen, onClose, onSave, suppliers }: AddPurchaseOrderModalProps) {
  const [formData, setFormData] = useState({
    supplier: '',
    expectedDelivery: '',
    notes: ''
  });

  const [items, setItems] = useState<PurchaseItem[]>([
    { id: '1', name: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.supplier) newErrors.supplier = 'Supplier is required';
    if (!formData.expectedDelivery) newErrors.expectedDelivery = 'Expected delivery date is required';
    if (items.length === 0) newErrors.items = 'At least one item is required';
    
    items.forEach((item, index) => {
      if (!item.name.trim()) newErrors[`item-${index}-name`] = 'Item name is required';
      if (item.quantity <= 0) newErrors[`item-${index}-quantity`] = 'Valid quantity is required';
      if (item.unitPrice < 0) newErrors[`item-${index}-price`] = 'Valid price is required';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const newPurchaseOrder = {
      id: `PO${Date.now()}`,
      supplier: formData.supplier,
      items: items.filter(item => item.name.trim()),
      totalAmount: calculateTotal(),
      status: 'draft',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: formData.expectedDelivery,
      notes: formData.notes
    };

    onSave(newPurchaseOrder);
    
    // Reset form
    setFormData({ supplier: '', expectedDelivery: '', notes: '' });
    setItems([{ id: '1', name: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Create Purchase Order</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier *
              </label>
              <select
                name="supplier"
                value={formData.supplier}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.supplier ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.name}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {errors.supplier && <p className="text-red-500 text-xs mt-1">{errors.supplier}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Delivery Date *
              </label>
              <input
                type="date"
                name="expectedDelivery"
                value={formData.expectedDelivery}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.expectedDelivery ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.expectedDelivery && <p className="text-red-500 text-xs mt-1">{errors.expectedDelivery}</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center space-x-1 text-sm"
              >
                <Plus size={16} />
                <span>Add Item</span>
              </button>
            </div>

            {errors.items && <p className="text-red-500 text-sm mb-4">{errors.items}</p>}

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-3 items-end p-3 border border-gray-200 rounded-lg">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                        errors[`item-${index}-name`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter item name"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      min="1"
                      className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                        errors[`item-${index}-quantity`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit Price</label>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                        errors[`item-${index}-price`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Total</label>
                    <div className="px-2 py-1 text-sm bg-gray-50 border border-gray-200 rounded">
                      ${item.total.toFixed(2)}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="w-full bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 flex items-center justify-center"
                      disabled={items.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Amount:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes for the purchase order"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Save size={16} />
              <span>Create Purchase Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}