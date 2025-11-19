import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import api from '../../lib/api';

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface CustomerSelectorProps {
  value: string;
  onChange: (customerId: string, customer?: Customer) => void;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

export default function CustomerSelector({
  value,
  onChange,
  label = 'Customer',
  required = false,
  error,
  disabled = false,
}: CustomerSelectorProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers?size=1000&sortBy=name&sortDir=ASC');
      setCustomers(response.data.content);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    const customer = customers.find((c) => c.id === customerId);
    onChange(customerId, customer);
  };

  if (loading) {
    return (
      <Select label={label} disabled>
        <option>Loading customers...</option>
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
      <option value="">Select a customer</option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name} ({customer.email})
        </option>
      ))}
    </Select>
  );
}
