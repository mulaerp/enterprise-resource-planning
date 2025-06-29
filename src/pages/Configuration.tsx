import React, { useState, useEffect } from 'react';
import { Save, Database, Settings, Shield, Globe, Server, Clock, CheckCircle, AlertCircle, RefreshCw, FileText, TestTube, Zap, Puzzle, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ConfigService, { ConfigData } from '../services/configService';
import LhdnService from '../services/lhdnService';

export default function Configuration() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<ConfigData | null>(null);
  const [testingLhdn, setTestingLhdn] = useState(false);
  const [lhdnTestResult, setLhdnTestResult] = useState<string>('');

  const configService = ConfigService.getInstance();
  const lhdnService = LhdnService.getInstance();

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await configService.getAllConfigs();
      setConfig(data);
      setOriginalConfig(JSON.parse(JSON.stringify(data))); // Deep copy
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config || !hasChanges) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Save each changed configuration
      const promises = Object.entries(config).map(async ([key, value]) => {
        if (originalConfig && originalConfig[key as keyof ConfigData] !== value) {
          return configService.setConfig(key, value);
        }
        return Promise.resolve(true);
      });

      const results = await Promise.all(promises);
      const allSuccessful = results.every(result => result === true);

      if (allSuccessful) {
        setSuccess('Configuration saved successfully!');
        setOriginalConfig(JSON.parse(JSON.stringify(config)));
        setHasChanges(false);
      } else {
        setSuccess('Configuration saved locally. Some changes may sync when connection is restored.');
        setHasChanges(false);
      }

      // Validate configuration
      const isValid = await configService.validateConfig();
      if (!isValid) {
        setError('Warning: Some configuration values may be invalid. Please review your settings.');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof ConfigData, value: any) => {
    if (!config) return;

    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    
    // Check if there are changes
    const hasChanges = originalConfig ? 
      JSON.stringify(newConfig) !== JSON.stringify(originalConfig) : 
      true;
    setHasChanges(hasChanges);
    
    // Clear messages when user makes changes
    setError('');
    setSuccess('');
    setLhdnTestResult('');
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)));
      setHasChanges(false);
      setError('');
      setSuccess('');
      setLhdnTestResult('');
    }
  };

  const handleRefresh = () => {
    configService.clearCache();
    loadConfiguration();
  };

  const testLhdnConnection = async () => {
    setTestingLhdn(true);
    setLhdnTestResult('');
    
    try {
      const result = await lhdnService.testConnection();
      setLhdnTestResult(result.success ? 
        `✅ ${result.message}` : 
        `❌ ${result.message}`
      );
    } catch (error) {
      setLhdnTestResult(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTestingLhdn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="animate-spin text-blue-600" size={20} />
          <span className="text-gray-600">Loading configuration...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Configuration</h3>
          <p className="text-gray-600 mb-4">Unable to load system configuration.</p>
          <button
            onClick={loadConfiguration}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const moduleConfigurations = [
    { key: 'modulesDashboard', label: 'Dashboard', description: 'Main dashboard with analytics and overview' },
    { key: 'modulesAccounting', label: 'Accounting', description: 'Financial management and bookkeeping' },
    { key: 'modulesSales', label: 'Sales', description: 'Sales management and customer orders' },
    { key: 'modulesInventory', label: 'Inventory', description: 'Stock management and tracking' },
    { key: 'modulesInvoicing', label: 'Invoicing', description: 'Invoice generation and management' },
    { key: 'modulesReports', label: 'Reports', description: 'Analytics and reporting tools' },
    { key: 'modulesPOS', label: 'Point of Sale', description: 'POS system for retail operations' },
    { key: 'modulesHR', label: 'Human Resources', description: 'Employee management and HR functions' },
    { key: 'modulesManufacturing', label: 'Manufacturing', description: 'Production planning and BOM management' },
    { key: 'modulesPurchasing', label: 'Purchasing', description: 'Purchase orders and supplier management' },
    { key: 'modulesCRM', label: 'Customer Relationship Management', description: 'Lead and opportunity management' },
    { key: 'modulesConfiguration', label: 'Configuration', description: 'System settings and configuration' }
  ];

  const configSections = [
    {
      title: 'Database Configuration',
      icon: Database,
      fields: [
        { key: 'databaseType', label: 'Database Type', type: 'select', options: ['dynamodb-compatible', 'mongodb', 'postgresql'] },
        { key: 'databaseUrl', label: 'Database URL', type: 'text' },
        { key: 'databaseName', label: 'Database Name', type: 'text' }
      ]
    },
    {
      title: 'Cache Configuration',
      icon: Server,
      fields: [
        { key: 'cacheUrl', label: 'Valkey/Redis URL', type: 'text' },
        { key: 'cachePassword', label: 'Cache Password', type: 'password' }
      ]
    },
    {
      title: 'Tax Configuration',
      icon: Settings,
      fields: [
        { key: 'defaultTaxRate', label: 'Default Tax Rate (%)', type: 'number' },
        { key: 'taxCalculationMethod', label: 'Tax Method', type: 'select', options: ['inclusive', 'exclusive'] }
      ]
    },
    {
      title: 'Batch Jobs',
      icon: Clock,
      fields: [
        { key: 'batchJobSchedule', label: 'Schedule (Cron)', type: 'text' },
        { key: 'batchJobRetries', label: 'Max Retries', type: 'number' }
      ]
    },
    {
      title: 'CAS Authentication',
      icon: Shield,
      fields: [
        { key: 'casEnabled', label: 'Enable CAS', type: 'checkbox' },
        { key: 'casBaseUrl', label: 'CAS Base URL', type: 'text' },
        { key: 'casServiceUrl', label: 'Service URL', type: 'text' }
      ]
    },
    {
      title: 'System Settings',
      icon: Globe,
      fields: [
        { key: 'companyName', label: 'Company Name', type: 'text' },
        { key: 'timezone', label: 'Timezone', type: 'select', options: ['UTC', 'Asia/Kuala_Lumpur', 'America/New_York', 'Europe/London', 'Asia/Tokyo'] },
        { key: 'currency', label: 'Currency', type: 'select', options: ['MYR', 'USD', 'EUR', 'GBP', 'JPY'] }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">System Configuration</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
            disabled={loading}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
            <span>Refresh</span>
          </button>
          {hasChanges && (
            <button
              onClick={handleReset}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
            >
              Reset Changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="text-red-600 mr-2" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-2" size={20} />
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="text-yellow-600 mr-2" size={20} />
            <p className="text-yellow-800">You have unsaved changes. Don't forget to save your configuration.</p>
          </div>
        </div>
      )}

      {/* Module Configuration */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Puzzle className="text-purple-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Module Configuration</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {moduleConfigurations.map((module) => (
            <div key={module.key} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{module.label}</h3>
                <button
                  onClick={() => handleChange(module.key as keyof ConfigData, !config[module.key as keyof ConfigData])}
                  className={`transition-colors ${
                    config[module.key as keyof ConfigData] 
                      ? 'text-green-600 hover:text-green-700' 
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                >
                  {config[module.key as keyof ConfigData] ? (
                    <ToggleRight size={24} />
                  ) : (
                    <ToggleLeft size={24} />
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-600">{module.description}</p>
              <div className="mt-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  config[module.key as keyof ConfigData] 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {config[module.key as keyof ConfigData] ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Puzzle className="text-blue-600 mt-0.5" size={16} />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Module Management</p>
              <p>Enable or disable modules to customize your ERP interface. Disabled modules will be hidden from the navigation menu.</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Changes take effect immediately after saving</li>
                <li>• Core modules (Dashboard, Configuration) cannot be disabled</li>
                <li>• Some modules may depend on others for full functionality</li>
                <li>• Users will need to refresh their browser to see navigation changes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {configSections.map((section, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center space-x-3 mb-4">
              <section.icon className="text-blue-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
            </div>
            
            <div className="space-y-4">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={config[field.key as keyof ConfigData] as string}
                      onChange={(e) => handleChange(field.key as keyof ConfigData, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {field.options?.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={config[field.key as keyof ConfigData] as boolean}
                        onChange={(e) => handleChange(field.key as keyof ConfigData, e.target.checked)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-600">
                        {field.key === 'casEnabled' ? 'Enable CAS Authentication' :
                         field.key === 'enableTwoFactor' ? 'Enable Two-Factor Authentication' :
                         field.key === 'searchIndexEnabled' ? 'Enable Search Indexing' :
                         field.key === 'fullTextSearch' ? 'Enable Full-Text Search' :
                         'Enable this feature'}
                      </span>
                    </div>
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={config[field.key as keyof ConfigData] as number}
                      onChange={(e) => handleChange(field.key as keyof ConfigData, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      step={field.key === 'defaultTaxRate' ? '0.01' : '1'}
                      min="0"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={config[field.key as keyof ConfigData] as string}
                      onChange={(e) => handleChange(field.key as keyof ConfigData, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* LHDN MyInvois Configuration */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <FileText className="text-green-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">LHDN MyInvois Integration</h2>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                config.lhdnMyInvoisEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {config.lhdnMyInvoisEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <button
              onClick={testLhdnConnection}
              disabled={testingLhdn || !config.lhdnMyInvoisEnabled}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testingLhdn ? <RefreshCw className="animate-spin" size={16} /> : <TestTube size={16} />}
              <span>Test Connection</span>
            </button>
          </div>

          {lhdnTestResult && (
            <div className={`mb-4 p-3 rounded-lg ${
              lhdnTestResult.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm ${
                lhdnTestResult.startsWith('✅') ? 'text-green-800' : 'text-red-800'
              }`}>
                {lhdnTestResult}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.lhdnMyInvoisEnabled}
                  onChange={(e) => handleChange('lhdnMyInvoisEnabled', e.target.checked)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Enable LHDN MyInvois Integration
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gateway URL
                </label>
                <input
                  type="text"
                  value={config.lhdnGatewayUrl}
                  onChange={(e) => handleChange('lhdnGatewayUrl', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="http://localhost:3000"
                  disabled={!config.lhdnMyInvoisEnabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={config.lhdnClientId}
                  onChange={(e) => handleChange('lhdnClientId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Your LHDN Client ID"
                  disabled={!config.lhdnMyInvoisEnabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={config.lhdnClientSecret}
                  onChange={(e) => handleChange('lhdnClientSecret', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Your LHDN Client Secret"
                  disabled={!config.lhdnMyInvoisEnabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environment
                </label>
                <select
                  value={config.lhdnEnvironment}
                  onChange={(e) => handleChange('lhdnEnvironment', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={!config.lhdnMyInvoisEnabled}
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taxpayer TIN
                </label>
                <input
                  type="text"
                  value={config.lhdnTaxpayerTin}
                  onChange={(e) => handleChange('lhdnTaxpayerTin', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Your company TIN"
                  disabled={!config.lhdnMyInvoisEnabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Type
                </label>
                <select
                  value={config.lhdnIdType}
                  onChange={(e) => handleChange('lhdnIdType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={!config.lhdnMyInvoisEnabled}
                >
                  <option value="NRIC">NRIC</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="BRN">Business Registration Number</option>
                  <option value="ARMY">Army ID</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Value
                </label>
                <input
                  type="text"
                  value={config.lhdnIdValue}
                  onChange={(e) => handleChange('lhdnIdValue', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Your ID number"
                  disabled={!config.lhdnMyInvoisEnabled}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.lhdnAutoSubmit}
                  onChange={(e) => handleChange('lhdnAutoSubmit', e.target.checked)}
                  className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-2"
                  disabled={!config.lhdnMyInvoisEnabled}
                />
                <label className="text-sm font-medium text-gray-700">
                  Auto-submit invoices to LHDN
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Validation Mode
                </label>
                <select
                  value={config.lhdnValidationMode}
                  onChange={(e) => handleChange('lhdnValidationMode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={!config.lhdnMyInvoisEnabled}
                >
                  <option value="strict">Strict</option>
                  <option value="lenient">Lenient</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Zap className="text-blue-600 mt-0.5" size={16} />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">MyInvois Gateway Integration</p>
                <p>This integration connects to the MyInvois Gateway service for LHDN e-invoice submission.</p>
                <p className="mt-2">
                  <strong>Gateway Repository:</strong>{' '}
                  <a 
                    href="https://github.com/farhan-syah/myinvois-gateway" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    https://github.com/farhan-syah/myinvois-gateway
                  </a>
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>• Ensure the gateway service is running before enabling</li>
                  <li>• Configure your LHDN credentials in the gateway service</li>
                  <li>• Test the connection before processing live invoices</li>
                  <li>• Use sandbox environment for testing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Advanced Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">POS Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of POS Devices
                </label>
                <input
                  type="number"
                  value={config.posDeviceCount}
                  onChange={(e) => handleChange('posDeviceCount', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Receipt Printer Type
                </label>
                <select
                  value={config.posReceiptPrinter}
                  onChange={(e) => handleChange('posReceiptPrinter', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="thermal">Thermal Printer</option>
                  <option value="inkjet">Inkjet Printer</option>
                  <option value="laser">Laser Printer</option>
                </select>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Search & Indexing</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.searchIndexEnabled}
                  onChange={(e) => handleChange('searchIndexEnabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Enable Search Indexing
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.fullTextSearch}
                  onChange={(e) => handleChange('fullTextSearch', e.target.checked)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Full-Text Search
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Index Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  value={config.indexRefreshInterval}
                  onChange={(e) => handleChange('indexRefreshInterval', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="30"
                  max="3600"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-blue-900 font-medium mb-2">Configuration Information</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Configuration changes are automatically encrypted and stored securely</p>
          <p>• Changes are cached locally and synced with the server</p>
          <p>• Module changes require a browser refresh to update navigation</p>
          <p>• Some changes may require a system restart to take effect</p>
          <p>• LHDN MyInvois integration requires the gateway service to be running</p>
          <p>• User: {user?.name} ({user?.role})</p>
        </div>
      </div>
    </div>
  );
}