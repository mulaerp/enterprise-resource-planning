import React, { useState } from 'react';
import { X, Save, Package, Plus, Trash2 } from 'lucide-react';

interface Component {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  cost: number;
}

interface AddBOMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bom: any) => void;
}

export default function AddBOMModal({ isOpen, onClose, onSave }: AddBOMModalProps) {
  const [formData, setFormData] = useState({
    productName: '',
    laborHours: 0,
    laborCost: 0,
    overheadCost: 0
  });

  const [components, setComponents] = useState<Component[]>([
    { itemId: '', itemName: '', quantity: 1, unit: 'pcs', cost: 0 }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const addComponent = () => {
    setComponents(prev => [...prev, { itemId: '', itemName: '', quantity: 1, unit: 'pcs', cost: 0 }]);
  };

  const removeComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof Component, value: any) => {
    setComponents(prev => prev.map((comp, i) => 
      i === index ? { ...comp, [field]: value } : comp
    ));
  };

  const calculateTotalCost = () => {
    return components.reduce((sum, comp) => sum + (comp.quantity * comp.cost), 0);
  };

  const calculateFinalCost = () => {
    return calculateTotalCost() + formData.laborCost + formData.overheadCost;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.productName.trim()) newErrors.productName = 'Product name is required';
    if (components.length === 0) newErrors.components = 'At least one component is required';
    
    components.forEach((comp, index) => {
      if (!comp.itemName.trim()) newErrors[`comp-${index}-name`] = 'Component name is required';
      if (comp.quantity <= 0) newErrors[`comp-${index}-quantity`] = 'Valid quantity is required';
      if (comp.cost < 0) newErrors[`comp-${index}-cost`] = 'Valid cost is required';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const newBOM = {
      id: `BOM${Date.now()}`,
      productId: `P${Date.now()}`,
      productName: formData.productName,
      components: components.filter(comp => comp.itemName.trim()),
      totalCost: calculateTotalCost(),
      laborHours: formData.laborHours,
      laborCost: formData.laborCost,
      overheadCost: formData.overheadCost,
      finalCost: calculateFinalCost()
    };

    onSave(newBOM);
    
    // Reset form
    setFormData({ productName: '', laborHours: 0, laborCost: 0, overheadCost: 0 });
    setComponents([{ itemId: '', itemName: '', quantity: 1, unit: 'pcs', cost: 0 }]);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Package className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Create Bill of Materials</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.productName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter product name"
              />
              {errors.productName && <p className="text-red-500 text-xs mt-1">{errors.productName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Labor Hours
              </label>
              <input
                type="number"
                name="laborHours"
                value={formData.laborHours}
                onChange={handleChange}
                step="0.1"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Labor Cost ($)
              </label>
              <input
                type="number"
                name="laborCost"
                value={formData.laborCost}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overhead Cost ($)
              </label>
              <input
                type="number"
                name="overheadCost"
                value={formData.overheadCost}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Components</h3>
              <button
                type="button"
                onClick={addComponent}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center space-x-1 text-sm"
              >
                <Plus size={16} />
                <span>Add Component</span>
              </button>
            </div>

            {errors.components && <p className="text-red-500 text-sm mb-4">{errors.components}</p>}

            <div className="space-y-3">
              {components.map((component, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 border border-gray-200 rounded-lg">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Component Name</label>
                    <input
                      type="text"
                      value={component.itemName}
                      onChange={(e) => updateComponent(index, 'itemName', e.target.value)}
                      className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                        errors[`comp-${index}-name`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter component name"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={component.quantity}
                      onChange={(e) => updateComponent(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.1"
                      className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                        errors[`comp-${index}-quantity`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      value={component.unit}
                      onChange={(e) => updateComponent(index, 'unit', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="pcs">Pieces</option>
                      <option value="kg">Kilograms</option>
                      <option value="m">Meters</option>
                      <option value="l">Liters</option>
                      <option value="box">Box</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit Cost ($)</label>
                    <input
                      type="number"
                      value={component.cost}
                      onChange={(e) => updateComponent(index, 'cost', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 ${
                        errors[`comp-${index}-cost`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => removeComponent(index)}
                      className="w-full bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 flex items-center justify-center"
                      disabled={components.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {components.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Material Cost:</span>
                  <span>${calculateTotalCost().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Labor Cost:</span>
                  <span>${formData.laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Overhead Cost:</span>
                  <span>${formData.overheadCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total Cost:</span>
                  <span>${calculateFinalCost().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

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
              <span>Create BOM</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}