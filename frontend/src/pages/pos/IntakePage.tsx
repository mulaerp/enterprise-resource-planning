import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import Layout from '../../components/Layout';
import { Button, Input, Select, Textarea, Badge, useToast } from '../../components/ui';
import type { ThriftCondition } from '../../lib/pos-offline';

interface IntakeForm {
  name: string;
  sku: string;
  acquisitionCost: string;
  price: string;
  condition: ThriftCondition;
  accessories: string;
  hasBox: boolean;
  quantity: string;
}

const CONDITION_OPTIONS: Array<{ value: ThriftCondition; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];

function suggestSku(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `TH-${stamp}-${rand}`;
}

function emptyForm(): IntakeForm {
  return {
    name: '',
    sku: suggestSku(),
    acquisitionCost: '',
    price: '',
    condition: 'GOOD',
    accessories: '',
    hasBox: false,
    quantity: '1',
  };
}

export default function IntakePage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ name: string; sku: string } | null>(null);
  // WP: product images - optional photo, uploaded via a second request once the item has an id.
  const [imageFile, setImageFile] = useState<File | null>(null);

  const acquisitionCost = parseFloat(form.acquisitionCost) || 0;
  const price = parseFloat(form.price) || 0;
  const margin = price - acquisitionCost;
  const marginPercent = acquisitionCost > 0 ? (margin / acquisitionCost) * 100 : price > 0 ? 100 : 0;

  const update = (patch: Partial<IntakeForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const commitTags = (raw: string) => {
    const parts = raw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (parts.length === 0) return;
    setTags((prev) => Array.from(new Set([...prev, ...parts])));
  };

  const handleTagInputChange = (value: string) => {
    if (value.includes(',')) {
      const lastComma = value.lastIndexOf(',');
      commitTags(value.slice(0, lastComma));
      setTagInput(value.slice(lastComma + 1));
    } else {
      setTagInput(value);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTags(tagInput);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setTags([]);
    setTagInput('');
    setLastSaved(null);
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (tagInput.trim()) {
      commitTags(tagInput);
      setTagInput('');
    }

    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        unitPrice: price,
        costPrice: acquisitionCost,
        acquisitionCost,
        stockQuantity: parseInt(form.quantity, 10) || 1,
        reorderLevel: 0,
        status: 'ACTIVE',
        condition: form.condition,
        tags,
        accessories: form.accessories.trim() || undefined,
        hasBox: form.hasBox,
      };

      const created = await api.post('/products', payload);

      if (imageFile) {
        try {
          const imageFormData = new FormData();
          imageFormData.append('file', imageFile);
          await api.post(`/products/${created.data.id}/image`, imageFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (imageError) {
          // Non-blocking: the item itself saved fine, only the photo upload failed.
          console.error('Failed to upload product photo:', imageError);
          showError(getErrorMessage(imageError, 'Item saved, but the photo upload failed'));
        }
      }

      success(`Item "${form.name}" saved`);
      setLastSaved({ name: form.name.trim(), sku: form.sku.trim() });
    } catch (err) {
      console.error('Failed to save item:', err);
      showError(getErrorMessage(err, 'Failed to save item'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <button
            onClick={() => navigate('/pos')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Point of Sale
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">Item Intake</h1>
          <p className="text-sm text-slate-500 mt-1">Log a second-hand item into the catalogue.</p>
        </div>

        {lastSaved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm text-green-800">
              Saved <strong>{lastSaved.name}</strong> ({lastSaved.sku})
            </p>
            <Button size="sm" onClick={resetForm}>
              Add Another
            </Button>
          </div>
        )}

        {!lastSaved && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Input
                  label="Item Name"
                  required
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. Levi's 501 Denim Jacket"
                />
              </div>

              <Input
                label="SKU"
                required
                value={form.sku}
                onChange={(e) => update({ sku: e.target.value })}
                helperText="Auto-suggested - edit if needed"
              />

              <Select
                label="Condition"
                required
                value={form.condition}
                onChange={(e) => update({ condition: e.target.value as ThriftCondition })}
                options={CONDITION_OPTIONS}
              />

              <Input
                label="Buy Price"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.acquisitionCost}
                onChange={(e) => update({ acquisitionCost: e.target.value })}
              />

              <Input
                label="Sell Price"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.price}
                onChange={(e) => update({ price: e.target.value })}
              />

              <div className="md:col-span-2">
                <p className="text-sm font-medium text-slate-700 mb-1">Margin</p>
                <p className={`text-lg font-semibold tabular-nums ${margin > 0 ? 'text-green-600' : 'text-slate-500'}`}>
                  {formatMoney(margin)} ({marginPercent.toFixed(1)}%)
                </p>
              </div>

              <Input
                label="Quantity"
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={(e) => update({ quantity: e.target.value })}
              />

              <div>
                <label htmlFor="tags-input" className="block text-sm font-medium text-slate-700 mb-1">
                  Tags
                </label>
                <input
                  id="tags-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="vintage, denim, y2k (comma separated)"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-brand-600"
                />
                {tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} className="gap-1">
                        {tag}
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => removeTag(tag)}
                          className="hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Accessories"
                  value={form.accessories}
                  onChange={(e) => update({ accessories: e.target.value })}
                  rows={2}
                  placeholder="e.g. spare buttons, original strap"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="has-box"
                  type="checkbox"
                  checked={form.hasBox}
                  onChange={(e) => update({ hasBox: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                />
                <label htmlFor="has-box" className="text-sm font-medium text-slate-700">
                  Includes original box
                </label>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="product-photo" className="block text-sm font-medium text-slate-700 mb-1">
                  Product photo
                </label>
                <input
                  id="product-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-700"
                />
                <p className="text-xs text-slate-500 mt-1">Optional. JPG, PNG or WEBP, up to 5MB.</p>
              </div>
            </div>

            <div className="flex gap-4 pt-2 border-t border-slate-200">
              <Button type="submit" loading={saving}>
                Save Item
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/pos')}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
