import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Upload } from 'lucide-react';
import api from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import {
  DataTable,
  SearchInput,
  Button,
  Badge,
  Modal,
  ModalFooter,
  useToast,
  type Column,
} from '../../components/ui';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  status: string;
}

interface ImportRowError {
  row: number;
  message: string;
}

interface CustomerImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: ImportRowError[];
}

export default function CustomerListPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    customerId: string | null;
    customerName: string | null;
  }>({
    isOpen: false,
    customerId: null,
    customerName: null,
  });

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, [page, search, sortBy, sortDir]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        size: '10',
        sortBy,
        sortDir,
      });
      if (search) params.append('search', search);

      const response = await api.get(`/customers?${params}`);
      setCustomers(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      showError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.customerId) return;

    try {
      await api.delete(`/customers/${deleteModal.customerId}`);
      success(`Customer "${deleteModal.customerName}" deleted successfully`);
      closeDeleteModal();
      fetchCustomers();
    } catch (err) {
      console.error('Failed to delete customer:', err);
      showError('Failed to delete customer');
    }
  };

  const openDeleteModal = (customer: Customer) => {
    setDeleteModal({
      isOpen: true,
      customerId: customer.id,
      customerName: customer.name,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      customerId: null,
      customerName: null,
    });
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
    if (importFileInputRef.current) importFileInputRef.current.value = '';
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      showError('Choose a CSV file first');
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      const response = await api.post<CustomerImportResult>('/customers/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(response.data);
      success(`Imported ${response.data.imported} customer(s)`);
      fetchCustomers();
    } catch (err) {
      console.error('Failed to import customers:', err);
      showError('Failed to import customers');
    } finally {
      setImporting(false);
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (customer) => <span className="font-medium text-slate-900">{customer.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (customer) => (
        <span className="text-slate-500">{customer.email || '-'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (customer) => (
        <span className="text-slate-500">{customer.phone || '-'}</span>
      ),
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      sortable: true,
      render: (customer) => formatMoney(customer.creditLimit),
    },
    {
      key: 'status',
      header: 'Status',
      render: (customer) => (
        <Badge variant={customer.status === 'ACTIVE' ? 'success' : 'default'}>
          {customer.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (customer) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/customers/${customer.id}/edit`);
            }}
            className="text-brand-600 hover:text-brand-900 p-1"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal(customer);
            }}
            className="text-red-600 hover:text-red-900 p-1"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
              <p className="text-sm text-slate-500 mt-1">Manage your customer relationships</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={openImportModal}
                icon={<Upload className="w-5 h-5" />}
                data-testid="import-customers-csv-button"
              >
                Import CSV
              </Button>
              <Button onClick={() => navigate('/customers/new')} icon={<Plus className="w-5 h-5" />}>
                Add Customer
              </Button>
            </div>
        </div>

        <div className="space-y-4">
          <SearchInput
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />

          <DataTable
            data={customers}
            columns={columns}
            keyExtractor={(customer) => customer.id}
            loading={loading}
            emptyMessage="No customers found. Create your first customer!"
            pagination={{
              currentPage: page,
              totalPages,
              onPageChange: setPage,
            }}
            sorting={{
              sortBy,
              sortDir,
              onSortChange: (newSortBy, newSortDir) => {
                setSortBy(newSortBy);
                setSortDir(newSortDir);
              },
            }}
          />
        </div>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={deleteModal.isOpen} onClose={closeDeleteModal} title="Delete Customer" size="sm">
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{deleteModal.customerName}</strong>? This action
            cannot be undone.
          </p>
          <ModalFooter>
            <Button variant="ghost" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </ModalFooter>
        </Modal>

        {/* Import CSV Modal */}
        <Modal isOpen={importModalOpen} onClose={closeImportModal} title="Import Customers CSV" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Columns: <code>name, email, phone</code>, plus optional <code>address</code>. The first
              row must be a header.
            </p>
            <div>
              <label htmlFor="customer-import-file" className="block text-sm font-medium text-slate-700 mb-1">
                CSV file
              </label>
              <input
                id="customer-import-file"
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                data-testid="import-customers-csv-file-input"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-700"
              />
            </div>

            {importResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="text-slate-700">
                  Imported <strong>{importResult.imported}</strong>, skipped{' '}
                  <strong>{importResult.skipped}</strong>, duplicates{' '}
                  <strong>{importResult.duplicates}</strong>.
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc list-inside text-red-600 space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={closeImportModal}>
              Close
            </Button>
            <Button
              onClick={handleImportSubmit}
              loading={importing}
              icon={<Upload className="w-4 h-4" />}
              data-testid="import-customers-csv-submit"
            >
              Import
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </Layout>
  );
}
