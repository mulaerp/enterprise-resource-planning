import React, { useState } from 'react';
import { X, Save, Clock } from 'lucide-react';

interface AddWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workOrder: any) => void;
  billsOfMaterials: any[];
}

export default function AddWorkOrderModal({ isOpen, onClose, onSave, billsOfMaterials }: AddWorkOrderModalProps) {
  const [formData, setFormData] = useState({
    bomId: '',
    quantity: 1,
    priority: 'medium',
    assignedTo: '',
    expectedDays: 5,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.bomId) newErrors.bomId = 'BOM selection is required';
    if (formData.quantity <= 0) newErrors.quantity = 'Valid quantity is required';
    if (!formData.assignedTo.trim()) newErrors.assignedTo = 'Assigned person is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const selectedBOM = billsOfMaterials.find(bom => bom.id === formData.bomId);
    const startDate = new Date();
    const expectedEndDate = new Date();
    expectedEndDate.setDate(startDate.getDate() + formData.expectedDays);

    const newWorkOrder = {
      id: `WO${Date.now()}`,
      bomId: formData.bomId,
      productName: selectedBOM?.productName || 'Unknown Product',
      quantity: formData.quantity,
      status: 'draft',
      startDate: startDate.toISOString().split('T')[0],
      expectedEndDate: expectedEndDate.toISOString().split('T')[0],
      assignedTo: formData.assignedTo,
      priority: formData.priority,
      progress: 0,
      notes: formData.notes
    };

    onSave(newWorkOrder);
    
    // Reset form
    setFormData({
      bomId: '',
      quantity: 1,
      priority: 'medium',
      assignedTo: '',
      expectedDays: 5,
      notes: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Clock className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Create Work Order</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bill of Materials *
              </label>
              <select
                name="bomId"
                value={formData.bomId}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.bomId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select BOM</option>
                {billsOfMaterials.map(bom => (
                  <option key={bom.id} value={bom.id}>
                    {bom.productName} ({bom.id})
                  </option>
                ))}
              </select>
              {errors.bomId && <p className="text-red-500 text-xs mt-1">{errors.bomId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.quantity ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To *
              </label>
              <input
                type="text"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.assignedTo ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter assignee name"
              />
              {errors.assignedTo && <p className="text-red-500 text-xs mt-1">{errors.assignedTo}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Duration (Days)
              </label>
              <input
                type="number"
                name="expectedDays"
                value={formData.expectedDays}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="5"
              />
            </div>
          </div>

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
              placeholder="Additional notes for the work order"
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
              <span>Create Work Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}