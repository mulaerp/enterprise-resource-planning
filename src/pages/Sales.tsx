import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Download } from 'lucide-react';
import CreateSaleModal from '../components/modals/CreateSaleModal';

interface Sale {
  id: string;
  customer: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  date: string;
  paymentMethod?: string;
  items?: any[];
  notes?: string;
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([
    { id: 'S001', customer: 'John Doe', amount: 1250.00, status: 'completed', date: '2024-01-15', paymentMethod: 'card' },
    { id: 'S002', customer: 'Jane Smith', amount: 890.50, status: 'pending', date: '2024-01-14', paymentMethod: 'cash' },
    { id: 'S003', customer: 'Bob Johnson', amount: 2100.75, status: 'completed', date: '2024-01-13', paymentMethod: 'card' },
    { id: 'S004', customer: 'Alice Brown', amount: 675.25, status: 'cancelled', date: '2024-01-12', paymentMethod: 'cash' }
  ]);

  const [customers] = useState([
    { id: 'C001', name: 'John Doe', email: 'john@example.com' },
    { id: 'C002', name: 'Jane Smith', email: 'jane@example.com' },
    { id: 'C003', name: 'Bob Johnson', email: 'bob@example.com' },
    { id: 'C004', name: 'Alice Brown', email: 'alice@example.com' }
  ]);

  const [products] = useState([
    { id: 'P001', name: 'Laptop Computer', price: 899.99 },
    { id: 'P002', name: 'Office Chair', price: 199.99 },
    { id: 'P003', name: 'Wireless Mouse', price: 29.99 },
    { id: 'P004', name: 'Standing Desk', price: 599.99 }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || sale.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Sale['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddSale = (newSale: Sale) => {
    setSales(prev => [...prev, newSale]);
  };

  const handleDeleteSale = (id: string) => {
    if (window.confirm('Are you sure you want to delete this sale?')) {
      setSales(prev => prev.filter(sale => sale.id !== id));
    }
  };

  const handleUpdateStatus = (id: string, newStatus: Sale['status']) => {
    setSales(prev => prev.map(sale => 
      sale.id === id ? { ...sale, status: newStatus } : sale
    ));
  };

  const exportSales = () => {
    const csvContent = [
      ['ID', 'Customer', 'Amount', 'Status', 'Date', 'Payment Method'],
      ...sales.map(sale => [
        sale.id, sale.customer, sale.amount, sale.status, sale.date, sale.paymentMethod || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalSales = sales.length;
  const totalRevenue = sales.filter(sale => sale.status === 'completed').reduce((sum, sale) => sum + sale.amount, 0);
  const pendingSales = sales.filter(sale => sale.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sales Management</h1>
        <div className="flex space-x-3">
          <button 
            onClick={exportSales}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Download size={20} />
            <span>Export</span>
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>New Sale</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <span className="text-blue-600 text-xl font-bold">#</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{totalSales}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <span className="text-green-600 text-xl font-bold">$</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
              <span className="text-yellow-600 text-xl font-bold">⏳</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Sales</p>
              <p className="text-2xl font-bold text-gray-900">{pendingSales}</p>
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
                placeholder="Search sales..."
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
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.customer}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${sale.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={sale.status}
                      onChange={(e) => handleUpdateStatus(sale.id, e.target.value as Sale['status'])}
                      className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(sale.status)}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{sale.paymentMethod || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Eye size={16} />
                      </button>
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteSale(sale.id)}
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

      <CreateSaleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleAddSale}
        customers={customers}
        products={products}
      />
    </div>
  );
}