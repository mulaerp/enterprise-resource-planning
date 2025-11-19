import { useState, useEffect, useRef } from 'react';
import { Search, Package, Users, ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface SearchResult {
  type: 'product' | 'customer' | 'supplier' | 'order';
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [products, customers, suppliers, orders] = await Promise.all([
          api.get(`/products?search=${query}&page=0&size=5`),
          api.get(`/customers?search=${query}&page=0&size=5`),
          api.get(`/suppliers?search=${query}&page=0&size=5`),
          api.get(`/sales-orders?search=${query}&page=0&size=5`),
        ]);

        const searchResults: SearchResult[] = [
          ...products.data.content.map((p: any) => ({
            type: 'product' as const,
            id: p.id,
            title: p.name,
            subtitle: `SKU: ${p.sku} - $${p.unitPrice}`,
            path: `/products/${p.id}/edit`,
          })),
          ...customers.data.content.map((c: any) => ({
            type: 'customer' as const,
            id: c.id,
            title: c.name,
            subtitle: c.email,
            path: `/customers/${c.id}/edit`,
          })),
          ...suppliers.data.content.map((s: any) => ({
            type: 'supplier' as const,
            id: s.id,
            title: s.name,
            subtitle: s.email,
            path: `/suppliers/${s.id}/edit`,
          })),
          ...orders.data.content.map((o: any) => ({
            type: 'order' as const,
            id: o.id,
            title: o.orderNumber,
            subtitle: `${o.customer.name} - $${o.total}`,
            path: `/sales-orders/${o.id}`,
          })),
        ];

        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'product':
        return <Package size={16} className="text-blue-600" />;
      case 'customer':
        return <Users size={16} className="text-green-600" />;
      case 'supplier':
        return <Users size={16} className="text-purple-600" />;
      case 'order':
        return <ShoppingCart size={16} className="text-pink-600" />;
      default:
        return <Search size={16} />;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/70 hover:text-white"
      >
        <Search size={16} />
        <span className="text-sm">Search...</span>
        <kbd className="px-2 py-0.5 text-xs bg-white/10 rounded">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Search Modal */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Search size={20} className="text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, customers, orders..."
              className="flex-1 outline-none text-lg"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="p-8 text-center text-gray-500">Searching...</div>
            )}

            {!loading && query.length >= 2 && results.length === 0 && (
              <div className="p-8 text-center text-gray-500">No results found</div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0">{getIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {result.title}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {result.subtitle}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {result.type}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.length < 2 && (
              <div className="p-8 text-center text-gray-500">
                Type at least 2 characters to search
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500 flex items-center justify-between">
            <div>Press ESC to close</div>
            <div>⌘K to open</div>
          </div>
        </div>
      </div>
    </>
  );
}
