import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card, DataTable, Select, Input, Button, useToast, type Column } from '../../components/ui';
import api from '../../lib/api';

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  username: string;
  changeSummary?: string;
  createdAt: string;
}

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];

export default function AuditLogsPage() {
  const { error: showError } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [entityType, setEntityType] = useState('');
  const [username, setUsername] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, size: 20 };
      if (entityType) params.entityType = entityType;
      if (username) params.username = username;
      if (action) params.action = action;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/audit-logs', { params });
      const content: AuditLogEntry[] = response.data.content || [];
      setLogs(content);
      setTotalPages(response.data.totalPages ?? 0);
      setEntityTypes((prev) => {
        const seen = new Set(prev);
        content.forEach((log) => seen.add(log.entityType));
        return Array.from(seen).sort();
      });
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      showError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(0);
    fetchLogs();
  };

  const handleReset = () => {
    setEntityType('');
    setUsername('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (log) => new Date(log.createdAt).toLocaleString(),
    },
    { key: 'action', header: 'Action' },
    { key: 'entityType', header: 'Entity Type' },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (log) => <span className="font-mono text-xs">{log.entityId}</span>,
    },
    { key: 'username', header: 'Username' },
    {
      key: 'changeSummary',
      header: 'Changes',
      render: (log) => (
        <span className="text-xs text-slate-600 whitespace-normal break-words max-w-md block">
          {log.changeSummary || '—'}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <History className="text-brand-600" size={28} />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
            <p className="text-sm text-slate-500 mt-1">Site-wide trail of create, update, and delete actions</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select
              label="Entity Type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="">All</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>

            <Input
              label="Username"
              placeholder="e.g. admin@mulaerp.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <Select
              label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">All</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>

            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={handleFilter} loading={loading}>Apply Filters</Button>
            <Button variant="ghost" onClick={handleReset}>Reset</Button>
          </div>
        </Card>

        <DataTable
          data={logs}
          columns={columns}
          keyExtractor={(log) => log.id}
          loading={loading}
          emptyMessage="No audit log entries found"
          pagination={{
            currentPage: page,
            totalPages,
            onPageChange: setPage,
          }}
        />
      </div>
    </Layout>
  );
}
