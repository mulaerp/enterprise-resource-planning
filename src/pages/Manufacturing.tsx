import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Play, Pause, CheckCircle, Clock, Package, Users, AlertTriangle } from 'lucide-react';
import AddBOMModal from '../components/modals/AddBOMModal';
import AddWorkOrderModal from '../components/modals/AddWorkOrderModal';

interface BillOfMaterials {
  id: string;
  productId: string;
  productName: string;
  components: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    cost: number;
  }>;
  totalCost: number;
  laborHours: number;
  laborCost: number;
  overheadCost: number;
  finalCost: number;
}

interface WorkOrder {
  id: string;
  bomId: string;
  productName: string;
  quantity: number;
  status: 'draft' | 'in-progress' | 'completed' | 'cancelled';
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high';
  progress: number;
  notes?: string;
}

export default function Manufacturing() {
  const [activeTab, setActiveTab] = useState<'bom' | 'workorders' | 'production'>('bom');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddBOMModalOpen, setIsAddBOMModalOpen] = useState(false);
  const [isAddWorkOrderModalOpen, setIsAddWorkOrderModalOpen] = useState(false);
  
  const [billsOfMaterials, setBillsOfMaterials] = useState<BillOfMaterials[]>([
    {
      id: 'BOM001',
      productId: 'P001',
      productName: 'Custom Laptop',
      components: [
        { itemId: 'C001', itemName: 'Motherboard', quantity: 1, unit: 'pcs', cost: 200 },
        { itemId: 'C002', itemName: 'RAM 16GB', quantity: 1, unit: 'pcs', cost: 80 },
        { itemId: 'C003', itemName: 'SSD 512GB', quantity: 1, unit: 'pcs', cost: 60 },
        { itemId: 'C004', itemName: 'Display 15"', quantity: 1, unit: 'pcs', cost: 150 }
      ],
      totalCost: 490,
      laborHours: 4,
      laborCost: 120,
      overheadCost: 50,
      finalCost: 660
    }
  ]);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    {
      id: 'WO001',
      bomId: 'BOM001',
      productName: 'Custom Laptop',
      quantity: 10,
      status: 'in-progress',
      startDate: '2024-01-15',
      expectedEndDate: '2024-01-20',
      assignedTo: 'John Smith',
      priority: 'high',
      progress: 65
    },
    {
      id: 'WO002',
      bomId: 'BOM001',
      productName: 'Custom Laptop',
      quantity: 5,
      status: 'draft',
      startDate: '2024-01-22',
      expectedEndDate: '2024-01-25',
      assignedTo: 'Jane Doe',
      priority: 'medium',
      progress: 0
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddBOM = (newBOM: BillOfMaterials) => {
    setBillsOfMaterials(prev => [...prev, newBOM]);
  };

  const handleAddWorkOrder = (newWorkOrder: WorkOrder) => {
    setWorkOrders(prev => [...prev, newWorkOrder]);
  };

  const handleDeleteBOM = (id: string) => {
    if (window.confirm('Are you sure you want to delete this BOM?')) {
      setBillsOfMaterials(prev => prev.filter(bom => bom.id !== id));
    }
  };

  const handleDeleteWorkOrder = (id: string) => {
    if (window.confirm('Are you sure you want to delete this work order?')) {
      setWorkOrders(prev => prev.filter(wo => wo.id !== id));
    }
  };

  const handleStartWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === id ? { ...wo, status: 'in-progress', progress: 10 } : wo
    ));
  };

  const handlePauseWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === id ? { ...wo, status: 'draft' } : wo
    ));
  };

  const handleCompleteWorkOrder = (id: string) => {
    setWorkOrders(prev => prev.map(wo => 
      wo.id === id ? { 
        ...wo, 
        status: 'completed', 
        progress: 100,
        actualEndDate: new Date().toISOString().split('T')[0]
      } : wo
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Manufacturing</h1>
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsAddWorkOrderModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>New Work Order</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'bom', name: 'Bill of Materials', icon: Package },
            { id: 'workorders', name: 'Work Orders', icon: Clock },
            { id: 'production', name: 'Production Planning', icon: Users }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bill of Materials Tab */}
      {activeTab === 'bom' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Bill of Materials</h2>
                <button 
                  onClick={() => setIsAddBOMModalOpen(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Plus size={20} />
                  <span>Create BOM</span>
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">BOM ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Components</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Labor Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {billsOfMaterials.map((bom) => (
                    <tr key={bom.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{bom.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bom.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bom.components.length} items</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${bom.totalCost.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${bom.laborCost.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${bom.finalCost.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800">
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteBOM(bom.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Work Orders Tab */}
      {activeTab === 'workorders' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Clock className="text-blue-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {workOrders.filter(wo => wo.status === 'in-progress').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <CheckCircle className="text-green-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {workOrders.filter(wo => wo.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <AlertTriangle className="text-yellow-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {workOrders.filter(wo => wo.status === 'draft').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Package className="text-purple-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Total Units</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {workOrders.reduce((sum, wo) => sum + wo.quantity, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search work orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workOrders.filter(order => 
                    order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    order.id.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(order.priority)}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${order.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{order.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.assignedTo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.expectedEndDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          {order.status === 'draft' && (
                            <button 
                              onClick={() => handleStartWorkOrder(order.id)}
                              className="text-green-600 hover:text-green-800" 
                              title="Start"
                            >
                              <Play size={16} />
                            </button>
                          )}
                          {order.status === 'in-progress' && (
                            <>
                              <button 
                                onClick={() => handlePauseWorkOrder(order.id)}
                                className="text-yellow-600 hover:text-yellow-800" 
                                title="Pause"
                              >
                                <Pause size={16} />
                              </button>
                              <button 
                                onClick={() => handleCompleteWorkOrder(order.id)}
                                className="text-green-600 hover:text-green-800" 
                                title="Complete"
                              >
                                <CheckCircle size={16} />
                              </button>
                            </>
                          )}
                          <button className="text-blue-600 hover:text-blue-800">
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteWorkOrder(order.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Production Planning Tab */}
      {activeTab === 'production' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Production Planning</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Capacity Planning</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Assembly Line 1</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                      </div>
                      <span className="text-sm text-gray-600">75%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Assembly Line 2</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '90%' }}></div>
                      </div>
                      <span className="text-sm text-gray-600">90%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">Quality Control</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                      <span className="text-sm text-gray-600">60%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Resource Allocation</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">Available Workers</span>
                    <span className="text-sm font-bold text-blue-600">24/30</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium">Active Machines</span>
                    <span className="text-sm font-bold text-green-600">8/10</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <span className="text-sm font-medium">Material Availability</span>
                    <span className="text-sm font-bold text-yellow-600">85%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddBOMModal
        isOpen={isAddBOMModalOpen}
        onClose={() => setIsAddBOMModalOpen(false)}
        onSave={handleAddBOM}
      />

      <AddWorkOrderModal
        isOpen={isAddWorkOrderModalOpen}
        onClose={() => setIsAddWorkOrderModalOpen(false)}
        onSave={handleAddWorkOrder}
        billsOfMaterials={billsOfMaterials}
      />
    </div>
  );
}