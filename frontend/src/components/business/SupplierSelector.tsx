import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import api from '../../lib/api';

interface Supplier {
  id: string;
  name: string;
  email: string;
}

interface SupplierSelectorProps {
  value: string;
  onChange: (supplierId: string, supplier?: Supplier) => void;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export default function SupplierSelector({
  value,
  onChange,
  label = 'Supplier',
  required = false,
  error,
  disabled = false,
}: SupplierSelectorProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers?size=1000&sortBy=name&sortDir=ASC');
      setSuppliers(response.data.content);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supplierId = e.target.value;
    const supplier = suppliers.find((s) => s.id === supplierId);
    onChange(supplierId, supplier);
  };

  if (loading) {
    return (
      <Select label={label} disabled>
        <option>Loading suppliers...</option>
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
      <option value="">Select a supplier</option>
      {suppliers.map((supplier) => (
        <option key={supplier.id} value={supplier.id}>
          {supplier.name} ({supplier.email})
        </option>
      ))}
    </Select>
  );
}
