import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Download, Send, DollarSign, FileText, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import CreateInvoiceModal from '../components/modals/CreateInvoiceModal';
import LhdnService from '../services/lhdnService';

interface Invoice {
  id: string;
  customer: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  issueDate: string;
  items?: any[];
  notes?: string;
  lhdnStatus?: 'pending' | 'submitted' | 'validated' | 'rejected' | 'cancelled';
  lhdnUuid?: string;
  lhdnSubmissionUid?: string;
}

export default function Invoicing() {
  const [invoices, setInvoices] = useState<Invoice[]>([
    { id: 'INV-001', customer: 'John Doe', amount: 1250.00, status: 'paid', dueDate: '2024-02-15', issueDate: '2024-01-15', lhdnStatus: 'validated' },
    { id: 'INV-002', customer: 'Jane Smith', amount: 890.50, status: 'sent', dueDate: '2024-02-14', issueDate: '2024-01-14', lhdnStatus: 'submitted' },
    { id: 'INV-003', customer: 'Bob Johnson', amount: 2100.75, status: 'overdue', dueDate: '2024-01-20', issueDate: '2024-01-05' },
    { id: 'INV-004', customer: 'Alice Brown', amount: 675.25, status: 'draft', dueDate: '2024-02-20', issueDate: '2024-01-12' }
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
  const [submittingToLhdn, setSubmittingToLhdn] = useState<string | null>(null);
  const [lhdnMessage, setLhdnMessage] = useState<string>('');

  const lhdnService = LhdnService.getInstance();

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filterStatus || invoice.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLhdnStatusColor = (status?: string) => {
    switch (status) {
      case 'validated': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleAddInvoice = (newInvoice: Invoice) => {
    setInvoices(prev => [...prev, newInvoice]);
  };

  const handleDeleteInvoice = (id: string) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      setInvoices(prev => prev.filter(invoice => invoice.id !== id));
    }
  };

  const handleUpdateStatus = (id: string, newStatus: Invoice['status']) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id ? { ...invoice, status: newStatus } : invoice
    ));
  };

  const handleSendInvoice = (id: string) => {
    handleUpdateStatus(id, 'sent');
    alert('Invoice sent successfully!');
  };

  const handleMarkAsPaid = (id: string) => {
    handleUpdateStatus(id, 'paid');
    alert('Invoice marked as paid!');
  };

  const handleSubmitToLhdn = async (invoice: Invoice) => {
    const enabled = await lhdnService.isEnabled();
    if (!enabled) {
      setLhdnMessage('❌ LHDN MyInvois integration is disabled. Please enable it in Configuration.');
      return;
    }

    setSubmittingToLhdn(invoice.id);
    setLhdnMessage('');

    try {
      // Convert ERP invoice to LHDN format
      const lhdnInvoiceData = lhdnService.convertToLhdnFormat(invoice);
      
      // Submit to LHDN
      const result = await lhdnService.submitInvoice(lhdnInvoiceData);
      
      if (result.success) {
        // Update invoice with LHDN details
        setInvoices(prev => prev.map(inv => 
          inv.id === invoice.id ? {
            ...inv,
            lhdnStatus: 'submitted',
            lhdnUuid: result.invoiceUuid,
            lhdnSubmissionUid: result.submissionUid
          } : inv
        ));
        setLhdnMessage(`✅ Invoice ${invoice.id} submitted to LHDN successfully!`);
      } else {
        setLhdnMessage(`❌ Failed to submit invoice ${invoice.id} to LHDN: ${result.message}`);
      }
    } catch (error) {
      setLhdnMessage(`❌ Error submitting invoice ${invoice.id} to LHDN: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmittingToLhdn(null);
    }
  };

  const handleCheckLhdnStatus = async (invoice: Invoice) => {
    if (!invoice.lhdnUuid) {
      setLhdnMessage('❌ No LHDN UUID found for this invoice');
      return;
    }

    try {
      const result = await lhdnService.getInvoiceStatus(invoice.lhdnUuid);
      
      if (result.success) {
        // Update invoice status
        setInvoices(prev => prev.map(inv => 
          inv.id === invoice.id ? {
            ...inv,
            lhdnStatus: result.status as any
          } : inv
        ));
        setLhdnMessage(`✅ LHDN status for ${invoice.id}: ${result.status}`);
      } else {
        setLhdnMessage(`❌ Failed to get LHDN status for ${invoice.id}: ${result.message}`);
      }
    } catch (error) {
      setLhdnMessage(`❌ Error checking LHDN status for ${invoice.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const downloadInvoice = (invoice: Invoice) => {
    // Simulate PDF generation
    alert(`Downloading invoice ${invoice.id} as PDF...`);
  };

  const exportInvoices = () => {
    const csvContent = [
      ['ID', 'Customer', 'Amount', 'Status', 'Issue Date', 'Due Date', 'LHDN Status'],
      ...invoices.map(invoice => [
        invoice.id, invoice.customer, invoice.amount, invoice.status, 
        invoice.issueDate, invoice.dueDate, invoice.lhdnStatus || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidAmount = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueInvoices = invoices.filter(invoice => invoice.status === 'overdue').length;
  const lhdnSubmittedCount = invoices.filter(invoice => invoice.lhdnStatus).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
        <div className="flex space-x-3">
          <button 
            onClick={exportInvoices}
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
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* LHDN Status Message */}
      {lhdnMessage && (
        <div className={`p-4 rounded-lg ${
          lhdnMessage.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${
            lhdnMessage.startsWith('✅') ? 'text-green-800' : 'text-red-800'
          }`}>
            {lhdnMessage}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <span className="text-blue-600 text-xl font-bold">#</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <span className="text-purple-600 text-xl font-bold">$</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">${totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Paid Amount</p>
              <p className="text-2xl font-bold text-gray-900">${paidAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
              <span className="text-red-600 text-xl font-bold">!</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{overdueInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
              <FileText className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">LHDN Submitted</p>
              <p className="text-2xl font-bold text-gray-900">{lhdnSubmittedCount}</p>
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
                placeholder="Search invoices..."
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
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LHDN Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{invoice.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{invoice.customer}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${invoice.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLhdnStatusColor(invoice.lhdnStatus)}`}>
                      {invoice.lhdnStatus || 'Not submitted'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{invoice.issueDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{invoice.dueDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => downloadInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View/Download"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => downloadInvoice(invoice)}
                        className="text-green-600 hover:text-green-800"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                      {invoice.status === 'draft' && (
                        <button 
                          onClick={() => handleSendInvoice(invoice.id)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Send Invoice"
                        >
                          <Send size={16} />
                        </button>
                      )}
                      {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                        <button 
                          onClick={() => handleMarkAsPaid(invoice.id)}
                          className="text-green-600 hover:text-green-800"
                          title="Mark as Paid"
                        >
                          <DollarSign size={16} />
                        </button>
                      )}
                      {!invoice.lhdnStatus && invoice.status !== 'draft' && (
                        <button 
                          onClick={() => handleSubmitToLhdn(invoice)}
                          disabled={submittingToLhdn === invoice.id}
                          className="text-yellow-600 hover:text-yellow-800 disabled:opacity-50"
                          title="Submit to LHDN"
                        >
                          {submittingToLhdn === invoice.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                          ) : (
                            <Zap size={16} />
                          )}
                        </button>
                      )}
                      {invoice.lhdnUuid && (
                        <button 
                          onClick={() => handleCheckLhdnStatus(invoice)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Check LHDN Status"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button className="text-blue-600 hover:text-blue-800">
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteInvoice(invoice.id)}
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

      <CreateInvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleAddInvoice}
        customers={customers}
        products={products}
      />
    </div>
  );
}