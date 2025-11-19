import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import api from '../../lib/api';

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
}

interface ProductSelectorProps {
  value: string;
  onChange: (productId: string, product?: Product) => void;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export default function ProductSelector({
  value,
  onChange,
  label = 'Product',
  required = false,
  error,
  disabled = false,
}: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products?size=1000&sortBy=name&sortDir=ASC');
      setProducts(response.data.content);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const product = products.find((p) => p.id === productId);
    onChange(productId, product);
  };

  if (loading) {
    return (
      <Select label={label} disabled>
        <option>Loading products...</option>
      </Select>
    );
  }

  return (
    <Select
      label={label}
      value={value}
      onChange={handleChange}
      required={required}
      error={error}
      disabled={disabled}
    >
      <option value="">Select a product</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.sku} - {product.name} (${product.unitPrice.toFixed(2)})
        </option>
      ))}
    </Select>
  );
}
