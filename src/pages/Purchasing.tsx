import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Download, Send, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import AddPurchaseOrderModal from '../components/modals/AddPurchaseOrderModal';

interface PurchaseOrder {
  id: string;
  supplier: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totalAmount: number;
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  orderDate: string;
  expectedDelivery: string;
  actualDelivery?: string;
  notes?: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  rating: number;
  totalOrders: number;
  totalSpent: number;
  paymentTerms: string;
  category: string;
}

interface RFQ {
  id: string;
  title: string;
  description: string;
  items: Array<{
    name: string;
    quantity: number;
    specifications: string;
  }>;
  suppliers: string[];
  deadline: string;
  status: 'draft' | 'sent' | 'responses-received' | 'closed';
  responses: number;
}

export default function Purchasing() {
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers' | 'rfq'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isAddPOModalOpen, setIsAddPOModalOpen] = useState(false);

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([
    {
      id: 'PO001',
      supplier: 'Tech Components Ltd',
      items: [
        { id: '1', name: 'Motherboard', quantity: 10, unitPrice: 200, total: 2000 },
        { id: '2', name: 'RAM 16GB', quantity: 20, unitPrice: 80, total: 1600 }
      ],
      totalAmount: 3600,
      status: 'confirmed',
      orderDate: '2024-01-15',
      expectedDelivery: '2024-01-25',
      notes: 'Urgent order for production'
    },
    {
      id: 'PO002',
      supplier: 'Office Supplies Co',
      items: [
        { id: '3', name: 'Office Chairs', quantity: 5, unitPrice: 199.99, total: 999.95 }
      ],
      totalAmount: 999.95,
      status: 'sent',
      orderDate: '2024-01-16',
      expectedDelivery: '2024-01-30'
    }
  ]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([
    {
      id: 'S001',
      name: 'Tech Components Ltd',
      email: 'orders@techcomponents.com',
      phone: '+1-555-0123',
      address: '123 Tech Street, Silicon Valley, CA',
      rating: 4.8,
      totalOrders: 45,
      totalSpent: 125000,
      paymentTerms: 'Net 30',
      category: 'Electronics'
    },
    {
      id: 'S002',
      name: 'Office Supplies Co',
      email: 'sales@officesupplies.com',
      phone: '+1-555-0124',
      address: '456 Business Ave, New York, NY',
      rating: 4.2,
      totalOrders: 23,
      totalSpent: 45000,
      paymentTerms: 'Net 15',
      category: 'Office Equipment'
    }
  ]);

  const [rfqs, setRfqs] = useState<RFQ[]>([
    {
      id: 'RFQ001',
      title: 'Computer Hardware Components',
      description: 'Seeking quotes for bulk computer hardware components',
      items: [
        { name: 'Processors', quantity: 50, specifications: 'Intel i7 or equivalent' },
        { name: 'Graphics Cards', quantity: 25, specifications: 'RTX 4060 or equivalent' }
      ],
      suppliers: ['Tech Components Ltd', 'Hardware Direct', 'Component World'],
      deadline: '2024-02-01',
      status: 'sent',
      responses: 2
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'received':
      case 'responses-received': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'cancelled':
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-${i < Math.floor(rating) ? 'yellow' : 'gray'}-400`}>★</span>
    ));
  };

  const handleAddPurchaseOrder = (newPO: PurchaseOrder) => {
    setPurchaseOrders(prev => [...prev, newPO]);
  };

  const handleDeletePO = (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase order?')) {
      setPurchaseOrders(prev => prev.filter(po => po.id !== id));
    }
  };

  const handleSendPO = (id: string) => {
    setPurchaseOrders(prev => prev.map(po => 
      po.id === id ? { ...po, status: 'sent' } : po
    ));
    alert('Purchase order sent successfully!');
  };

  const handleConfirmPO = (id: string) => {
    setPurchaseOrders(prev => prev.map(po => 
      po.id === id ? { ...po, status: 'confirmed' } : po
    ));
  };

  const handleReceivePO = (id: string) => {
    setPurchaseOrders(prev => prev.map(po => 
      po.id === id ? { 
        ...po, 
        status: 'received',
        actualDelivery: new Date().toISOString().split('T')[0]
      } : po
    ));
  };

  const exportPurchaseOrders = () => {
    const csvContent = [
      ['PO Number', 'Supplier', 'Items', 'Amount', 'Status', 'Order Date', 'Expected Delivery'],
      ...purchaseOrders.map(po => [
        po.id, po.supplier, po.items.length, po.totalAmount, po.status, po.orderDate, po.expectedDelivery
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Purchasing</h1>
        <div className="flex space-x-3">
          <button 
            onClick={exportPurchaseOrders}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Download size={20} />
            <span>Export</span>
          </button>
          <button 
            onClick={() => setIsAddPOModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>New Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'orders', name: 'Purchase Orders', count: purchaseOrders.length },
            { id: 'suppliers', name: 'Suppliers', count: suppliers.length },
            { id: 'rfq', name: 'RFQ', count: rfqs.length }
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
              <span>{tab.name}</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Purchase Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Clock className="text-blue-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Pending Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {purchaseOrders.filter(po => po.status === 'sent' || po.status === 'confirmed').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <CheckCircle className="text-green-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Received</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {purchaseOrders.filter(po => po.status === 'received').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-purple-500 rounded mr-3"></div>
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <AlertTriangle className="text-yellow-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-gray-900">2</p>
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
                    placeholder="Search purchase orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Delivery</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchaseOrders.filter(order => 
                    order.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    order.id.toLowerCase().includes(searchTerm.toLowerCase())
                  ).filter(order => !filterStatus || order.status === filterStatus).map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.supplier}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.items.length} items</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.expectedDelivery}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800" title="View">
                            <Eye size={16} />
                          </button>
                          {order.status === 'draft' && (
                            <button 
                              onClick={() => handleSendPO(order.id)}
                              className="text-green-600 hover:text-green-800" 
                              title="Send"
                            >
                              <Send size={16} />
                            </button>
                          )}
                          {order.status === 'sent' && (
                            <button 
                              onClick={() => handleConfirmPO(order.id)}
                              className="text-blue-600 hover:text-blue-800" 
                              title="Confirm"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {order.status === 'confirmed' && (
                            <button 
                              onClick={() => handleReceivePO(order.id)}
                              className="text-green-600 hover:text-green-800" 
                              title="Mark as Received"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          <button className="text-blue-600 hover:text-blue-800" title="Edit">
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeletePO(order.id)}
                            className="text-red-600 hover:text-red-800" 
                            title="Delete"
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

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Supplier Management</h2>
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
                  <Plus size={20} />
                  <span>Add Supplier</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Terms</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                          <div className="text-sm text-gray-500">{supplier.id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{supplier.email}</div>
                        <div className="text-sm text-gray-500">{supplier.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supplier.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex">{getRatingStars(supplier.rating)}</div>
                          <span className="ml-1 text-sm text-gray-600">({supplier.rating})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supplier.totalOrders}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${supplier.totalSpent.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supplier.paymentTerms}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800">
                            <Edit size={16} />
                          </button>
                          <button className="text-red-600 hover:text-red-800">
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

      {/* RFQ Tab */}
      {activeTab === 'rfq' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Request for Quotation</h2>
                <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2">
                  <Plus size={20} />
                  <span>Create RFQ</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RFQ ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suppliers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rfqs.map((rfq) => (
                    <tr key={rfq.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rfq.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.items.length} items</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.suppliers.length} suppliers</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.responses}/{rfq.suppliers.length}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rfq.deadline}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rfq.status)}`}>
                          {rfq.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800">
                            <Eye size={16} />
                          </button>
                          <button className="text-blue-600 hover:text-blue-800">
                            <Edit size={16} />
                          </button>
                          <button className="text-red-600 hover:text-red-800">
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

      {/* Add Purchase Order Modal */}
      <AddPurchaseOrderModal
        isOpen={isAddPOModalOpen}
        onClose={() => setIsAddPOModalOpen(false)}
        onSave={handleAddPurchaseOrder}
        suppliers={suppliers}
      />
    </div>
  );
}