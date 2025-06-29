import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Receipt, 
  Monitor, ExternalLink, Copy, Check, Calendar, DollarSign, Clock,
  User, Settings, LogOut, Play, Square, BarChart3, Calculator,
  Wallet, TrendingUp, Package, AlertCircle, X
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  barcode?: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface POSSession {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  status: 'draft' | 'opened' | 'closed';
  openingBalance: number;
  closingBalance?: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransactions: number;
  cashier: string;
  config: {
    name: string;
    cashControl: boolean;
    receiptPrinter: boolean;
    barcodeScanner: boolean;
  };
}

interface CashMovement {
  id: string;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  timestamp: string;
}

export default function POS() {
  const [currentSession, setCurrentSession] = useState<POSSession | null>(null);
  const [sessions, setSessions] = useState<POSSession[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sessionHash, setSessionHash] = useState<string>('');
  const [hashCopied, setHashCopied] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(500);
  const [closingBalance, setClosingBalance] = useState(0);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [cashAmount, setCashAmount] = useState(0);
  const [cashReason, setCashReason] = useState('');
  const [cashType, setCashType] = useState<'in' | 'out'>('in');

  const [products] = useState<Product[]>([
    { id: 'P001', name: 'Laptop Computer', price: 899.99, category: 'Electronics', barcode: '1234567890123' },
    { id: 'P002', name: 'Office Chair', price: 199.99, category: 'Furniture', barcode: '1234567890124' },
    { id: 'P003', name: 'Wireless Mouse', price: 29.99, category: 'Electronics', barcode: '1234567890125' },
    { id: 'P004', name: 'Standing Desk', price: 599.99, category: 'Furniture', barcode: '1234567890126' },
    { id: 'P005', name: 'Monitor', price: 299.99, category: 'Electronics', barcode: '1234567890127' },
    { id: 'P006', name: 'Keyboard', price: 79.99, category: 'Electronics', barcode: '1234567890128' },
    { id: 'P007', name: 'Desk Lamp', price: 49.99, category: 'Office', barcode: '1234567890129' },
    { id: 'P008', name: 'Notebook', price: 12.99, category: 'Office', barcode: '1234567890130' }
  ]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('pos-sessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }

    const savedCurrentSession = localStorage.getItem('pos-current-session');
    if (savedCurrentSession) {
      setCurrentSession(JSON.parse(savedCurrentSession));
    }

    const savedMovements = localStorage.getItem('pos-cash-movements');
    if (savedMovements) {
      setCashMovements(JSON.parse(savedMovements));
    }
  }, []);

  // Generate session hash on component mount
  useEffect(() => {
    if (currentSession) {
      const generateSessionHash = () => {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const hash = btoa(`pos-session-${timestamp}-${randomString}`).substring(0, 16);
        return hash;
      };

      const hash = generateSessionHash();
      setSessionHash(hash);
      localStorage.setItem('pos-session-hash', hash);
    }
  }, [currentSession]);

  // Update localStorage whenever cart changes
  useEffect(() => {
    if (sessionHash && currentSession) {
      const sessionData = {
        hash: sessionHash,
        cart: cart,
        timestamp: Date.now()
      };
      localStorage.setItem(`pos-session-${sessionHash}`, JSON.stringify(sessionData));
      window.dispatchEvent(new Event('storage'));
    }
  }, [cart, sessionHash, currentSession]);

  const startNewSession = () => {
    const now = new Date();
    const newSession: POSSession = {
      id: `POS-${Date.now()}`,
      name: `POS Session ${now.toLocaleDateString()}`,
      startDate: now.toISOString().split('T')[0],
      startTime: now.toTimeString().split(' ')[0],
      status: 'opened',
      openingBalance: openingBalance,
      totalSales: 0,
      totalCash: 0,
      totalCard: 0,
      totalTransactions: 0,
      cashier: 'Demo User',
      config: {
        name: 'Main POS',
        cashControl: true,
        receiptPrinter: true,
        barcodeScanner: true
      }
    };

    setCurrentSession(newSession);
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    
    localStorage.setItem('pos-sessions', JSON.stringify(updatedSessions));
    localStorage.setItem('pos-current-session', JSON.stringify(newSession));
    setShowSessionModal(false);
  };

  const closeSession = () => {
    if (!currentSession) return;

    const now = new Date();
    const updatedSession: POSSession = {
      ...currentSession,
      status: 'closed',
      endDate: now.toISOString().split('T')[0],
      endTime: now.toTimeString().split(' ')[0],
      closingBalance: closingBalance
    };

    setCurrentSession(null);
    const updatedSessions = sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    setSessions(updatedSessions);
    
    localStorage.setItem('pos-sessions', JSON.stringify(updatedSessions));
    localStorage.removeItem('pos-current-session');
    setShowCloseModal(false);
    setCart([]);
  };

  const addCashMovement = () => {
    if (!cashAmount || !cashReason.trim()) return;

    const movement: CashMovement = {
      id: `CM-${Date.now()}`,
      type: cashType,
      amount: cashAmount,
      reason: cashReason,
      timestamp: new Date().toISOString()
    };

    const updatedMovements = [...cashMovements, movement];
    setCashMovements(updatedMovements);
    localStorage.setItem('pos-cash-movements', JSON.stringify(updatedMovements));

    // Update session balance
    if (currentSession) {
      const balanceChange = cashType === 'in' ? cashAmount : -cashAmount;
      const updatedSession = {
        ...currentSession,
        totalCash: currentSession.totalCash + (cashType === 'in' ? cashAmount : 0)
      };
      setCurrentSession(updatedSession);
      localStorage.setItem('pos-current-session', JSON.stringify(updatedSession));
    }

    setCashAmount(0);
    setCashReason('');
    setShowCashModal(false);
  };

  const addToCart = (product: Product) => {
    if (!currentSession || currentSession.status !== 'opened') {
      alert('Please start a POS session first');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev =>
        prev.map(item =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  const openCustomerDisplay = () => {
    const url = `/customer-display?hash=${sessionHash}`;
    window.open(url, '_blank', 'width=800,height=600,toolbar=no,menubar=no,scrollbars=yes,resizable=yes');
  };

  const copySessionHash = async () => {
    try {
      await navigator.clipboard.writeText(sessionHash);
      setHashCopied(true);
      setTimeout(() => setHashCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = sessionHash;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setHashCopied(true);
      setTimeout(() => setHashCopied(false), 2000);
    }
  };

  const processPayment = (method: string) => {
    if (cart.length === 0 || !currentSession) return;
    
    const total = getTotal();
    const updatedSession = {
      ...currentSession,
      totalSales: currentSession.totalSales + total,
      totalTransactions: currentSession.totalTransactions + 1,
      totalCash: method === 'Cash' ? currentSession.totalCash + total : currentSession.totalCash,
      totalCard: method === 'Card' ? currentSession.totalCard + total : currentSession.totalCard
    };

    setCurrentSession(updatedSession);
    localStorage.setItem('pos-current-session', JSON.stringify(updatedSession));

    alert(`Processing ${method} payment for $${total.toFixed(2)}`);
    
    setTimeout(() => {
      clearCart();
      alert('Payment successful! Receipt printed.');
    }, 1500);
  };

  const getCurrentCashBalance = () => {
    if (!currentSession) return 0;
    const movements = cashMovements.filter(m => 
      new Date(m.timestamp).toDateString() === new Date().toDateString()
    );
    const movementTotal = movements.reduce((sum, m) => 
      sum + (m.type === 'in' ? m.amount : -m.amount), 0
    );
    return currentSession.openingBalance + currentSession.totalCash + movementTotal;
  };

  // If no session is active, show session management
  if (!currentSession || currentSession.status !== 'opened') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
            <button
              onClick={() => setShowSessionModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-lg"
            >
              <Play size={24} />
              <span>Start New Session</span>
            </button>
          </div>

          {/* Session Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <Calendar className="text-blue-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Today's Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions.filter(s => s.startDate === new Date().toISOString().split('T')[0]).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <DollarSign className="text-green-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Today's Sales</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${sessions
                      .filter(s => s.startDate === new Date().toISOString().split('T')[0])
                      .reduce((sum, s) => sum + s.totalSales, 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <BarChart3 className="text-purple-600 mr-3" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sessions
                      .filter(s => s.startDate === new Date().toISOString().split('T')[0])
                      .reduce((sum, s) => sum + s.totalTransactions, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Recent Sessions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sessions.slice(-10).reverse().map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{session.name}</div>
                          <div className="text-sm text-gray-500">{session.cashier}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(session.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.endTime ? 
                          `${session.startTime} - ${session.endTime}` : 
                          `Started at ${session.startTime}`
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${session.totalSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.totalTransactions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          session.status === 'opened' ? 'bg-green-100 text-green-800' :
                          session.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Start Session Modal */}
        {showSessionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Start New POS Session</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Cash Balance
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Session Configuration</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-center">
                      <Check size={16} className="mr-2" />
                      <span>Cash Control Enabled</span>
                    </div>
                    <div className="flex items-center">
                      <Check size={16} className="mr-2" />
                      <span>Receipt Printer Connected</span>
                    </div>
                    <div className="flex items-center">
                      <Check size={16} className="mr-2" />
                      <span>Barcode Scanner Ready</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={startNewSession}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Start Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{currentSession.name}</h1>
              <p className="text-sm text-gray-600">
                Started: {currentSession.startDate} at {currentSession.startTime} | 
                Cashier: {currentSession.cashier}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Sales Today</p>
                <p className="text-lg font-bold text-green-600">${currentSession.totalSales.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Transactions</p>
                <p className="text-lg font-bold text-blue-600">{currentSession.totalTransactions}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Cash Balance</p>
                <p className="text-lg font-bold text-purple-600">${getCurrentCashBalance().toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCashModal(true)}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-1 text-sm"
            >
              <Wallet size={16} />
              <span>Cash</span>
            </button>
            <button
              onClick={openCustomerDisplay}
              className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-1 text-sm"
            >
              <Monitor size={16} />
              <span>Display</span>
            </button>
            <button
              onClick={() => setShowCloseModal(true)}
              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-1 text-sm"
            >
              <Square size={16} />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Session Hash Info */}
      {sessionHash && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Monitor size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Customer Display Hash:</span>
              <code className="text-xs bg-white px-2 py-1 rounded font-mono">{sessionHash}</code>
              <button
                onClick={copySessionHash}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="Copy session hash"
              >
                {hashCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors border-2 border-transparent hover:border-blue-200"
                >
                  <div className="aspect-square bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                    <Package size={20} className="text-gray-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 text-xs mb-1 truncate">{product.name}</h3>
                  <p className="text-blue-600 font-semibold text-sm">${product.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <ShoppingCart size={20} className="mr-2" />
              Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Clear All
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-30" />
              <p>Cart is empty</p>
              <p className="text-xs mt-1">Add products to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
                      <p className="text-gray-600 text-xs">${item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => updateQuantity(item.id, 0)}
                        className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center hover:bg-red-300 ml-1 transition-colors"
                      >
                        <Trash2 size={12} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">${getTotal().toFixed(2)}</span>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => processPayment('Card')}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 flex items-center justify-center space-x-2 transition-colors"
                  >
                    <CreditCard size={20} />
                    <span>Pay with Card</span>
                  </button>
                  <button 
                    onClick={() => processPayment('Cash')}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Banknote size={20} />
                    <span>Pay with Cash</span>
                  </button>
                  <button className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 flex items-center justify-center space-x-2 transition-colors">
                    <Receipt size={16} />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Session Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Close POS Session</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="text-yellow-600 mr-2" size={20} />
                  <p className="text-yellow-800 text-sm">
                    Please count your cash drawer and enter the closing balance.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Opening Balance:</p>
                  <p className="font-semibold">${currentSession.openingBalance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Cash Sales:</p>
                  <p className="font-semibold">${currentSession.totalCash.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Card Sales:</p>
                  <p className="font-semibold">${currentSession.totalCard.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Expected Cash:</p>
                  <p className="font-semibold">${getCurrentCashBalance().toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actual Closing Balance
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              {Math.abs(closingBalance - getCurrentCashBalance()) > 0.01 && (
                <div className={`p-3 rounded-lg ${
                  closingBalance > getCurrentCashBalance() ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm ${
                    closingBalance > getCurrentCashBalance() ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Difference: ${Math.abs(closingBalance - getCurrentCashBalance()).toFixed(2)} 
                    {closingBalance > getCurrentCashBalance() ? ' (Over)' : ' (Short)'}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={closeSession}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Close Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Movement Modal */}
      {showCashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cash Movement</h3>
              <button
                onClick={() => setShowCashModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="in"
                      checked={cashType === 'in'}
                      onChange={(e) => setCashType(e.target.value as 'in' | 'out')}
                      className="mr-2"
                    />
                    <span className="text-green-600">Cash In</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="out"
                      checked={cashType === 'out'}
                      onChange={(e) => setCashType(e.target.value as 'in' | 'out')}
                      className="mr-2"
                    />
                    <span className="text-red-600">Cash Out</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={cashReason}
                  onChange={(e) => setCashReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter reason for cash movement"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Current Cash Balance:</p>
                <p className="text-lg font-bold text-gray-900">${getCurrentCashBalance().toFixed(2)}</p>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowCashModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addCashMovement}
                disabled={!cashAmount || !cashReason.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Movement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}