import React, { useState, useEffect } from 'react';
import { ShoppingCart, CreditCard, AlertCircle, Wifi, WifiOff, Package } from 'lucide-react';
import { useConfig } from '../hooks/useConfig';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface SessionData {
  hash: string;
  cart: CartItem[];
  timestamp: number;
}

export default function CustomerDisplay() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sessionHash, setSessionHash] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const { config } = useConfig();
  const companyName = config?.companyName || 'MulaERP';
  const currency = config?.currency || 'USD';
  const currencySymbol = currency === 'MYR' ? 'RM' : '$';

  useEffect(() => {
    // Get session hash from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      setError('No session hash provided. Please access this page from the POS terminal.');
      return;
    }

    setSessionHash(hash);
    setError('');

    const updateCart = () => {
      try {
        // Try to get session data from localStorage
        const sessionData = localStorage.getItem(`pos-session-${hash}`);
        
        if (sessionData) {
          const data: SessionData = JSON.parse(sessionData);
          
          // Verify the hash matches and data is recent (within last 30 seconds)
          const now = Date.now();
          const dataAge = now - data.timestamp;
          
          if (data.hash === hash && dataAge < 30000) {
            setCart(data.cart || []);
            const newTotal = (data.cart || []).reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
            setTotal(newTotal);
            setLastUpdate(data.timestamp);
            setIsConnected(true);
            setError('');
          } else if (dataAge >= 30000) {
            setError('Session expired. Please refresh the POS terminal.');
            setIsConnected(false);
          } else {
            setError('Invalid session hash');
            setIsConnected(false);
          }
        } else {
          // Check if this is the first load or if session doesn't exist yet
          if (lastUpdate === 0) {
            setError('Waiting for POS terminal connection...');
            setIsConnected(false);
          } else {
            // Session was active but now missing
            const now = Date.now();
            if ((now - lastUpdate) > 30000) {
              setError('Session expired or POS terminal disconnected');
              setIsConnected(false);
            }
          }
        }
      } catch (err) {
        console.error('Error loading session data:', err);
        setError('Failed to load session data');
        setIsConnected(false);
      }
    };

    // Initial load
    updateCart();

    // Listen for storage changes (when POS terminal updates the cart)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `pos-session-${hash}` || e.key === null) {
        updateCart();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Poll for updates every 2 seconds
    const interval = setInterval(updateCart, 2000);

    // Connection timeout check every 5 seconds
    const connectionCheck = setInterval(() => {
      const now = Date.now();
      if (lastUpdate > 0 && (now - lastUpdate) > 30000) {
        setIsConnected(false);
        setError('Connection lost. Please check POS terminal.');
      }
    }, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      clearInterval(connectionCheck);
    };
  }, [sessionHash, lastUpdate]);

  // Auto-refresh page if disconnected for too long
  useEffect(() => {
    if (!isConnected && lastUpdate > 0) {
      const timeout = setTimeout(() => {
        window.location.reload();
      }, 60000); // Refresh after 1 minute of disconnection

      return () => clearTimeout(timeout);
    }
  }, [isConnected, lastUpdate]);

  if (error && !sessionHash) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-4">Connection Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="bg-gray-900 p-4 rounded-lg">
            <p className="text-sm text-gray-500">To access the customer display:</p>
            <ol className="text-sm text-gray-400 mt-2 text-left">
              <li>1. Open the POS terminal</li>
              <li>2. Start a POS session</li>
              <li>3. Click "Display" button</li>
              <li>4. Or use the session hash provided</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 p-6 text-center border-b border-gray-700">
        <div className="flex justify-center items-center space-x-3 mb-2">
          <ShoppingCart className="text-blue-400" size={32} />
          <h1 className="text-3xl font-bold">{companyName} POS</h1>
        </div>
        <div className="flex items-center justify-center space-x-4">
          <p className="text-gray-400">Customer Display</p>
          <div className="flex items-center space-x-1">
            {isConnected ? (
              <>
                <Wifi size={16} className="text-green-400" />
                <span className="text-xs text-green-400">Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-400" />
                <span className="text-xs text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>
        {sessionHash && (
          <p className="text-xs text-gray-500 mt-2">
            Session: {sessionHash}
          </p>
        )}
      </div>

      {/* Connection Status Banner */}
      {error && isConnected === false && (
        <div className="bg-red-900 border-b border-red-700 p-3 text-center">
          <div className="flex items-center justify-center space-x-2">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-red-200 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center p-8">
        {cart.length === 0 ? (
          <div className="text-center">
            <ShoppingCart size={120} className="mx-auto mb-6 text-gray-600" />
            <h2 className="text-4xl font-light mb-4">Welcome</h2>
            <p className="text-xl text-gray-400">Your items will appear here</p>
            {!isConnected && (
              <div className="mt-6">
                <div className="inline-flex items-center space-x-2 bg-yellow-900 border border-yellow-700 rounded-lg px-4 py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                  <span className="text-yellow-200 text-sm">
                    {error || 'Connecting to POS terminal...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto w-full">
            {/* Cart Items */}
            <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
              {cart.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex justify-between items-center p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                      <Package size={20} className="text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-medium">{item.name}</h3>
                      <p className="text-gray-400">{currencySymbol}{item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg">Qty: {item.quantity}</div>
                    <div className="text-xl font-semibold text-blue-400">
                      {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t border-gray-700 pt-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-2xl font-light">Total:</span>
                <span className="text-5xl font-bold text-green-400">{currencySymbol}{total.toFixed(2)}</span>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-900 border border-green-700 rounded-lg p-4 text-center">
                  <CreditCard size={32} className="mx-auto mb-2 text-green-400" />
                  <p className="text-green-300">Card Payment</p>
                  <p className="text-sm text-green-500">Tap, Insert, or Swipe</p>
                </div>
                <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 text-center">
                  <div className="w-8 h-8 mx-auto mb-2 bg-blue-400 rounded flex items-center justify-center">
                    <span className="text-blue-900 font-bold text-sm">{currencySymbol}</span>
                  </div>
                  <p className="text-blue-300">Cash Payment</p>
                  <p className="text-sm text-blue-500">Pay with Cash</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-900 p-4 text-center border-t border-gray-700">
        <p className="text-gray-500 text-sm">Thank you for shopping with us!</p>
        {lastUpdate > 0 && (
          <p className="text-xs text-gray-600 mt-1">
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </p>
        )}
        {isConnected && (
          <div className="flex items-center justify-center space-x-2 mt-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Live connection active</span>
          </div>
        )}
      </div>
    </div>
  );
}