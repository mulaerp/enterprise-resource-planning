import { useState, useEffect } from 'react';
import ConfigService, { ConfigData } from '../services/configService';

export function useConfig() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configService = ConfigService.getInstance();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await configService.getAllConfigs();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: string, value: any): Promise<boolean> => {
    try {
      const success = await configService.setConfig(key, value);
      if (success && config) {
        setConfig({ ...config, [key]: value });
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
      return false;
    }
  };

  const getConfigValue = async (key: string): Promise<any> => {
    try {
      return await configService.getConfig(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get configuration value');
      return null;
    }
  };

  const validateConfig = async (): Promise<boolean> => {
    try {
      return await configService.validateConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate configuration');
      return false;
    }
  };

  const refreshConfig = () => {
    configService.clearCache();
    loadConfig();
  };

  return {
    config,
    loading,
    error,
    updateConfig,
    getConfigValue,
    validateConfig,
    refreshConfig
  };
}