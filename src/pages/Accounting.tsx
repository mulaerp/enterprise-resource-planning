import React, { useState } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Download, TrendingUp, TrendingDown, DollarSign, CreditCard, Banknote, FileText } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
  type: 'income' | 'expense' | 'transfer';
}

interface Account {
  id: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  balance: number;
  parentAccount?: string;
  isActive: boolean;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  entries: Array<{
    account: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted';
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts' | 'journal' | 'reports'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 'T001',
      date: '2024-01-15',
      description: 'Sales Revenue - Invoice INV-001',
      account: 'Sales Revenue',
      debit: 0,
      credit: 1250.00,
      balance: 1250.00,
      reference: 'INV-001',
      type: 'income'
    },
    {
      id: 'T002',
      date: '2024-01-15',
      description: 'Office Supplies Purchase',
      account: 'Office Expenses',
      debit: 150.00,
      credit: 0,
      balance: -150.00,
      reference: 'PO-001',
      type: 'expense'
    },
    {
      id: 'T003',
      date: '2024-01-16',
      description: 'Bank Transfer',
      account: 'Cash',
      debit: 500.00,
      credit: 0,
      balance: 500.00,
      reference: 'TRF-001',
      type: 'transfer'
    }
  ]);

  const [accounts, setAccounts] = useState<Account[]>([
    { id: 'A001', name: 'Cash', type: 'asset', balance: 15000, isActive: true },
    { id: 'A002', name: 'Accounts Receivable', type: 'asset', balance: 8500, isActive: true },
    { id: 'A003', name: 'Inventory', type: 'asset', balance: 25000, isActive: true },
    { id: 'A004', name: 'Equipment', type: 'asset', balance: 50000, isActive: true },
    { id: 'L001', name: 'Accounts Payable', type: 'liability', balance: 5500, isActive: true },
    { id: 'L002', name: 'Bank Loan', type: 'liability', balance: 20000, isActive: true },
    { id: 'E001', name: 'Owner Equity', type: 'equity', balance: 72000, isActive: true },
    { id: 'I001', name: 'Sales Revenue', type: 'income', balance: 45000, isActive: true },
    { id: 'EX001', name: 'Office Expenses', type: 'expense', balance: 3500, isActive: true },
    { id: 'EX002', name: 'Marketing Expenses', type: 'expense', balance: 2500, isActive: true }
  ]);

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([
    {
      id: 'JE001',
      date: '2024-01-15',
      reference: 'INV-001',
      description: 'Sales Invoice',
      entries: [
        { account: 'Accounts Receivable', debit: 1250, credit: 0 },
        { account: 'Sales Revenue', debit: 0, credit: 1250 }
      ],
      totalDebit: 1250,
      totalCredit: 1250,
      status: 'posted'
    }
  ]);

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset': return 'bg-green-100 text-green-800';
      case 'liability': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-blue-100 text-blue-800';
      case 'income': return 'bg-purple-100 text-purple-800';
      case 'expense': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'income': return <TrendingUp className="text-green-600" size={16} />;
      case 'expense': return <TrendingDown className="text-red-600" size={16} />;
      case 'transfer': return <CreditCard className="text-blue-600" size={16} />;
      default: return <FileText className="text-gray-600" size={16} />;
    }
  };

  // Calculate financial summary
  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = accounts.filter(a => a.type === 'equity').reduce((sum, a) => sum + a.balance, 0);
  const totalIncome = accounts.filter(a => a.type === 'income').reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = accounts.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.balance, 0);
  const netIncome = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Accounting</h1>
        <div className="flex space-x-3">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
            <Download size={20} />
            <span>Export</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2">
            <Plus size={20} />
            <span>New Entry</span>
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <DollarSign className="text-green-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">${totalAssets.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <CreditCard className="text-red-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Liabilities</p>
              <p className="text-2xl font-bold text-gray-900">${totalLiabilities.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <Banknote className="text-blue-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Equity</p>
              <p className="text-2xl font-bold text-gray-900">${totalEquity.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <TrendingUp className="text-purple-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-gray-900">${totalIncome.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <TrendingDown className="text-orange-600 mr-3" size={24} />
            <div>
              <p className="text-sm text-gray-600">Net Income</p>
              <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${netIncome.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'transactions', name: 'Transactions', count: transactions.length },
            { id: 'accounts', name: 'Chart of Accounts', count: accounts.length },
            { id: 'journal', name: 'Journal Entries', count: journalEntries.length },
            { id: 'reports', name: 'Financial Reports', count: 0 }
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
              {tab.count > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTransactionTypeIcon(transaction.type)}
                        <span className="ml-2 text-sm text-gray-900">{transaction.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.account}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.reference}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.debit > 0 ? `$${transaction.debit.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.credit > 0 ? `$${transaction.credit.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={transaction.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${Math.abs(transaction.balance).toFixed(2)}
                      </span>
                    </td>
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
      )}

      {/* Chart of Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Chart of Accounts</h2>
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>Add Account</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{account.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{account.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(account.type)}`}>
                        {account.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${account.balance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
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
      )}

      {/* Journal Entries Tab */}
      {activeTab === 'journal' && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Journal Entries</h2>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2">
                <Plus size={20} />
                <span>New Journal Entry</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Debit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Credit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journalEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.reference}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${entry.totalDebit.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${entry.totalCredit.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {entry.status}
                      </span>
                    </td>
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
      )}

      {/* Financial Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Balance Sheet</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Assets</span>
                  <span className="text-sm font-medium">${totalAssets.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Liabilities</span>
                  <span className="text-sm font-medium">${totalLiabilities.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Total Equity</span>
                  <span className="text-sm font-bold">${totalEquity.toLocaleString()}</span>
                </div>
              </div>
              <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                Generate Full Report
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Income Statement</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Revenue</span>
                  <span className="text-sm font-medium">${totalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Expenses</span>
                  <span className="text-sm font-medium">${totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Net Income</span>
                  <span className={`text-sm font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${netIncome.toLocaleString()}
                  </span>
                </div>
              </div>
              <button className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                Generate Full Report
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Operating Activities</span>
                  <span className="text-sm font-medium text-green-600">$12,500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Investing Activities</span>
                  <span className="text-sm font-medium text-red-600">-$5,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Financing Activities</span>
                  <span className="text-sm font-medium text-blue-600">$2,000</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Net Cash Flow</span>
                  <span className="text-sm font-bold text-green-600">$9,500</span>
                </div>
              </div>
              <button className="w-full mt-4 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                Generate Full Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}