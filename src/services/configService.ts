export interface ConfigData {
  // Database Configuration
  databaseType: string;
  databaseUrl: string;
  databaseName: string;
  
  // Cache Configuration
  cacheUrl: string;
  cachePassword: string;
  
  // Tax Configuration
  defaultTaxRate: number;
  taxCalculationMethod: string;
  
  // Batch Job Configuration
  batchJobSchedule: string;
  batchJobRetries: number;
  
  // System Configuration
  companyName: string;
  companyLogo: string;
  timezone: string;
  currency: string;
  
  // Security Configuration
  sessionTimeout: number;
  passwordPolicy: string;
  enableTwoFactor: boolean;
  
  // Integration Configuration
  casEnabled: boolean;
  casBaseUrl: string;
  casServiceUrl: string;
  
  // Module Configuration
  modulesDashboard: boolean;
  modulesAccounting: boolean;
  modulesSales: boolean;
  modulesInventory: boolean;
  modulesInvoicing: boolean;
  modulesReports: boolean;
  modulesPOS: boolean;
  modulesHR: boolean;
  modulesManufacturing: boolean;
  modulesPurchasing: boolean;
  modulesCRM: boolean;
  modulesConfiguration: boolean;
  
  // LHDN MyInvois Configuration
  lhdnMyInvoisEnabled: boolean;
  lhdnGatewayUrl: string;
  lhdnClientId: string;
  lhdnClientSecret: string;
  lhdnEnvironment: string;
  lhdnTaxpayerTin: string;
  lhdnIdType: string;
  lhdnIdValue: string;
  lhdnAutoSubmit: boolean;
  lhdnValidationMode: string;
  
  // POS Configuration
  posDeviceCount: number;
  posReceiptPrinter: string;
  posPaymentMethods: string[];
  
  // Indexing Configuration
  searchIndexEnabled: boolean;
  fullTextSearch: boolean;
  indexRefreshInterval: number;
}

class ConfigService {
  private static instance: ConfigService;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = localStorage.getItem('erp-token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`/api/config${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Config API request failed:', error);
      // Fallback to localStorage for offline mode
      return this.getFromLocalStorage(endpoint);
    }
  }

  private getFromLocalStorage(key: string): any {
    try {
      const stored = localStorage.getItem(`config-${key}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  private saveToLocalStorage(key: string, value: any): void {
    try {
      localStorage.setItem(`config-${key}`, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private setCacheValue(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_DURATION);
  }

  async getAllConfigs(): Promise<ConfigData> {
    const cacheKey = 'all-configs';
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await this.makeRequest('');
      const configs = response || this.getDefaultConfig();
      
      // Cache the result
      this.setCacheValue(cacheKey, configs);
      
      // Also save to localStorage as backup
      this.saveToLocalStorage('all', configs);
      
      return configs;
    } catch (error) {
      console.error('Failed to fetch all configs:', error);
      // Return cached or default config
      return this.cache.get(cacheKey) || this.getFromLocalStorage('all') || this.getDefaultConfig();
    }
  }

  async getConfig(key: string): Promise<any> {
    // Check cache first
    if (this.isCacheValid(key)) {
      return this.cache.get(key);
    }

    try {
      const response = await this.makeRequest(`/${key}`);
      const value = response?.value;
      
      // Cache the result
      this.setCacheValue(key, value);
      
      // Also save to localStorage as backup
      this.saveToLocalStorage(key, value);
      
      return value;
    } catch (error) {
      console.error(`Failed to fetch config ${key}:`, error);
      // Return cached or default value
      const cached = this.cache.get(key);
      if (cached !== undefined) return cached;
      
      const stored = this.getFromLocalStorage(key);
      if (stored !== null) return stored;
      
      return this.getDefaultConfig()[key as keyof ConfigData];
    }
  }

  async setConfig(key: string, value: any): Promise<boolean> {
    try {
      await this.makeRequest(`/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });

      // Update cache
      this.setCacheValue(key, value);
      
      // Also save to localStorage as backup
      this.saveToLocalStorage(key, value);
      
      // Invalidate all-configs cache
      this.cache.delete('all-configs');
      this.cacheExpiry.delete('all-configs');
      
      return true;
    } catch (error) {
      console.error(`Failed to set config ${key}:`, error);
      
      // Save to localStorage as fallback
      this.saveToLocalStorage(key, value);
      this.setCacheValue(key, value);
      
      // Show user that changes are saved locally
      console.warn('Configuration saved locally. Changes will sync when connection is restored.');
      return false;
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/validate', {
        method: 'POST',
      });
      return response?.valid || false;
    } catch (error) {
      console.error('Failed to validate config:', error);
      return false;
    }
  }

  async testLhdnConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest('/lhdn/test', {
        method: 'POST',
      });
      return response || { success: false, message: 'No response from server' };
    } catch (error) {
      console.error('Failed to test LHDN connection:', error);
      return { success: false, message: 'Connection test failed' };
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  private getDefaultConfig(): ConfigData {
    return {
      // Database Configuration
      databaseType: 'dynamodb-compatible',
      databaseUrl: 'localhost:8000',
      databaseName: 'mulaerp',
      
      // Cache Configuration
      cacheUrl: 'redis://localhost:6379',
      cachePassword: '',
      
      // Tax Configuration
      defaultTaxRate: 10.00,
      taxCalculationMethod: 'inclusive',
      
      // Batch Job Configuration
      batchJobSchedule: '0 2 * * *',
      batchJobRetries: 3,
      
      // System Configuration
      companyName: 'MulaERP',
      companyLogo: '',
      timezone: 'UTC',
      currency: 'MYR',
      
      // Security Configuration
      sessionTimeout: 30,
      passwordPolicy: 'medium',
      enableTwoFactor: false,
      
      // Integration Configuration
      casEnabled: true,
      casBaseUrl: 'https://app.penril.net/pineapple-backend',
      casServiceUrl: '',
      
      // Module Configuration (Default enabled modules)
      modulesDashboard: true,
      modulesAccounting: true,
      modulesSales: true,
      modulesInventory: true,
      modulesInvoicing: true,
      modulesReports: true,
      modulesPOS: true,
      modulesHR: true,
      modulesConfiguration: true,
      // Default disabled modules
      modulesManufacturing: false,
      modulesPurchasing: false,
      modulesCRM: false,
      
      // LHDN MyInvois Configuration (Default: Disabled)
      lhdnMyInvoisEnabled: false,
      lhdnGatewayUrl: 'http://localhost:3000',
      lhdnClientId: '',
      lhdnClientSecret: '',
      lhdnEnvironment: 'sandbox',
      lhdnTaxpayerTin: '',
      lhdnIdType: 'NRIC',
      lhdnIdValue: '',
      lhdnAutoSubmit: false,
      lhdnValidationMode: 'strict',
      
      // POS Configuration
      posDeviceCount: 2,
      posReceiptPrinter: 'thermal',
      posPaymentMethods: ['cash', 'card', 'digital'],
      
      // Indexing Configuration
      searchIndexEnabled: true,
      fullTextSearch: true,
      indexRefreshInterval: 60
    };
  }

  // Sync local changes with server when connection is restored
  async syncLocalChanges(): Promise<void> {
    const localKeys = Object.keys(localStorage).filter(key => key.startsWith('config-'));
    
    for (const key of localKeys) {
      const configKey = key.replace('config-', '');
      if (configKey === 'all') continue; // Skip the all-configs cache
      
      try {
        const localValue = this.getFromLocalStorage(configKey);
        if (localValue !== null) {
          await this.setConfig(configKey, localValue);
        }
      } catch (error) {
        console.error(`Failed to sync config ${configKey}:`, error);
      }
    }
  }
}

export default ConfigService;