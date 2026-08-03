import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Layout from '../../components/Layout';
import { Button, Input, useToast } from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

type ValueType = 'STRING' | 'INT' | 'DECIMAL' | 'BOOLEAN';

interface AppSetting {
  id: string;
  key: string;
  value: string;
  valueType: ValueType;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

/**
 * Commercial Terms (V44, {@code GET/PUT /api/v1/settings}) - branch-manager-editable runtime
 * settings (RoleRules.MANAGER_UP on the backend), deliberately separate from the ADMIN-only
 * Company Settings page: commercial terms (e.g. warranty base-days) are manager territory, ADMIN
 * is IT. Layout hides the nav entry from anyone but MANAGER/ADMIN; this page also guards itself
 * (the same {@code canEdit}-style pattern CompanySettingsPage uses for exchange rates) so a
 * direct-navigated CASHIER/ACCOUNTANT/INVENTORY sees a clear message instead of a raw 403 from a
 * failed fetch.
 */
export default function CommercialTermsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const canManage = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get<AppSetting[]>('/settings');
      setSettings(response.data);
      setDrafts(Object.fromEntries(response.data.map((s) => [s.key, s.value])));
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load commercial settings'));
    } finally {
      setLoading(false);
    }
  };

  const humanizeKey = (key: string) =>
    key
      .split(/[.-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const validateDraft = (setting: AppSetting, draft: string): string | null => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      return 'Value is required';
    }
    if (setting.valueType === 'INT') {
      if (!/^-?\d+$/.test(trimmed)) {
        return 'Must be a whole number';
      }
      if (Number(trimmed) < 0) {
        return 'Must be zero or greater';
      }
    }
    if (setting.valueType === 'DECIMAL') {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return 'Must be a number';
      }
      if (parsed < 0) {
        return 'Must be zero or greater';
      }
    }
    if (setting.valueType === 'BOOLEAN' && !['true', 'false'].includes(trimmed.toLowerCase())) {
      return "Must be 'true' or 'false'";
    }
    return null;
  };

  const handleSave = async (setting: AppSetting) => {
    const draft = drafts[setting.key] ?? '';
    const validationError = validateDraft(setting, draft);
    if (validationError) {
      setFieldErrors((prev) => ({ ...prev, [setting.key]: validationError }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, [setting.key]: '' }));

    try {
      setSavingKey(setting.key);
      const response = await api.put<AppSetting>(`/settings/${encodeURIComponent(setting.key)}`, {
        value: draft.trim(),
      });
      setSettings((prev) => prev.map((s) => (s.key === setting.key ? response.data : s)));
      setDrafts((prev) => ({ ...prev, [setting.key]: response.data.value }));
      success(`${humanizeKey(setting.key)} updated to ${response.data.value}`);
    } catch (err) {
      showError(getErrorMessage(err, `Failed to update ${humanizeKey(setting.key)}`));
    } finally {
      setSavingKey(null);
    }
  };

  if (!canManage) {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-xl">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Commercial Terms</h1>
            <p className="text-sm text-slate-600">
              Only branch managers and admins can view or change commercial terms.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <button
            onClick={() => navigate('/oversight')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Oversight
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">Commercial Terms</h1>
          <p className="text-sm text-slate-500 mt-1">
            Runtime-editable commercial settings - changes apply immediately, no redeploy required,
            and every change is recorded in the audit log.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : settings.length === 0 ? (
          <p className="text-sm text-slate-500">No commercial settings found.</p>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 divide-y divide-slate-200">
            {settings.map((setting) => (
              <div key={setting.key} className="p-6 space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{humanizeKey(setting.key)}</h2>
                  {setting.description && (
                    <p className="text-sm text-slate-500 mt-1">{setting.description}</p>
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-40">
                    <label htmlFor={`setting-${setting.key}`} className="sr-only">
                      {humanizeKey(setting.key)} value
                    </label>
                    <Input
                      id={`setting-${setting.key}`}
                      type={setting.valueType === 'INT' || setting.valueType === 'DECIMAL' ? 'number' : 'text'}
                      min={setting.valueType === 'INT' || setting.valueType === 'DECIMAL' ? 0 : undefined}
                      step={setting.valueType === 'DECIMAL' ? '0.01' : undefined}
                      value={drafts[setting.key] ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))
                      }
                    />
                    {fieldErrors[setting.key] && (
                      <p className="text-red-600 text-xs mt-1">{fieldErrors[setting.key]}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={savingKey === setting.key}
                    disabled={savingKey === setting.key || drafts[setting.key] === setting.value}
                    onClick={() => handleSave(setting)}
                  >
                    Save
                  </Button>
                  <span className="text-xs text-slate-400 self-center">
                    {setting.valueType === 'INT' && 'whole number'}
                    {setting.valueType === 'DECIMAL' && 'decimal number'}
                    {setting.valueType === 'BOOLEAN' && 'true / false'}
                  </span>
                </div>
                {setting.updatedBy && (
                  <p className="text-xs text-slate-400">
                    Last updated by {setting.updatedBy} at {new Date(setting.updatedAt).toLocaleString('en-MY')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
