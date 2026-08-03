import { useState } from 'react';
import { Search } from 'lucide-react';
import Layout from '../../components/Layout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { traceEventMeta } from '../../lib/oversightTrace';

interface ItemTraceEvent {
  timestamp: string;
  type: string;
  documentNumber: string | null;
  actor: string | null;
  quantity: number | null;
  amount: number | null;
  detail: string | null;
}

interface ItemTraceResponse {
  productId: string;
  sku: string;
  productName: string;
  events: ItemTraceEvent[];
  truncated: boolean;
  note: string | null;
}

export default function ItemTracePage() {
  const { error: showError } = useToast();
  const [sku, setSku] = useState('');
  const [serial, setSerial] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trace, setTrace] = useState<ItemTraceResponse | null>(null);

  const handleSearch = async () => {
    if (!sku.trim() && !serial.trim()) {
      showError('Enter a SKU or serial number to search');
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const params: Record<string, string> = {};
      if (sku.trim()) params.sku = sku.trim();
      if (serial.trim()) params.serial = serial.trim();
      const response = await api.get('/oversight/trace/item', { params });
      setTrace(response.data);
    } catch (err) {
      setTrace(null);
      showError(getErrorMessage(err, 'Item not found'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Item Trace</h1>
          <p className="text-sm text-slate-500 mt-1">Full chronological history for one item</p>
        </div>

        <Card className="p-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Input
                label="SKU"
                placeholder="e.g. TI-2026-000001-1"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Serial Number"
                placeholder="e.g. SN-00123"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} loading={loading} icon={<Search size={16} />}>
              Trace
            </Button>
          </div>
        </Card>

        {loading && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">Loading trace...</p>
          </Card>
        )}

        {!loading && searched && !trace && (
          <Card className="p-12 text-center">
            <p className="text-slate-500">No item found for that SKU or serial number.</p>
          </Card>
        )}

        {!loading && trace && (
          <>
            <Card className="p-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{trace.productName}</h2>
                <p className="text-sm text-slate-500">SKU: {trace.sku}</p>
              </div>
              <Badge variant="info">{trace.events.length} event{trace.events.length === 1 ? '' : 's'}</Badge>
            </Card>

            {trace.truncated && trace.note && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {trace.note}
              </div>
            )}

            <Card padding="none" className="overflow-hidden">
              {trace.events.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No history recorded for this item yet.</p>
              ) : (
                <ol className="divide-y divide-slate-200">
                  {trace.events.map((event, idx) => {
                    const meta = traceEventMeta(event.type);
                    const Icon = meta.icon;
                    return (
                      <li key={idx} className="flex gap-4 px-6 py-4">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center ${meta.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                            <p className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                              {new Date(event.timestamp).toLocaleString('en-MY')}
                            </p>
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">{event.detail}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                            {event.documentNumber && <span>Doc: <span className="font-medium text-slate-700">{event.documentNumber}</span></span>}
                            {event.actor && <span>By: <span className="font-medium text-slate-700">{event.actor}</span></span>}
                            {event.quantity !== null && (
                              <span className="tabular-nums">
                                Qty: <span className={`font-medium ${event.quantity >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {event.quantity >= 0 ? '+' : ''}{event.quantity}
                                </span>
                              </span>
                            )}
                            {event.amount !== null && (
                              <span className="tabular-nums">Amount: <span className="font-medium text-slate-700">{formatMoney(event.amount)}</span></span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
