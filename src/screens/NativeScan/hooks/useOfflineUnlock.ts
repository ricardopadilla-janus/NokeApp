import { useState, useCallback } from 'react';
import NokeAPIService from '../../../services/NokeAPIService';
import { OfflineKeyDevice } from '../../../services/NokeAPIService';

export interface UseOfflineUnlockReturn {
  offlineKeys: Record<string, OfflineKeyDevice>;
  isLoading: boolean;
  error: string | null;
  getOfflineKeys: () => Promise<void>;
  refreshOfflineKeys: () => Promise<void>;
  refreshKeysForDevices: (macAddresses: string[]) => Promise<void>;
  clearCache: () => Promise<void>;
}

export const useOfflineUnlock = (): UseOfflineUnlockReturn => {
  const [offlineKeys, setOfflineKeys] = useState<Record<string, OfflineKeyDevice>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getOfflineKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[useOfflineUnlock] Fetching offline keys...');
      
      // Always fetch fresh data from API to see CURL logs
      const keys = await NokeAPIService.getAllOfflineKeys(true);
      setOfflineKeys(keys);
      
      console.log('[useOfflineUnlock] ✅ Obtained', Object.keys(keys).length, 'offline keys');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('[useOfflineUnlock] ❌ Error fetching offline keys:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshOfflineKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[useOfflineUnlock] Refreshing offline keys...');
      
      const keys = await NokeAPIService.getAllOfflineKeys(true); // Force refresh
      setOfflineKeys(keys);
      
      console.log('[useOfflineUnlock] ✅ Refreshed', Object.keys(keys).length, 'offline keys');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('[useOfflineUnlock] ❌ Error refreshing offline keys:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshKeysForDevices = useCallback(async (macAddresses: string[]) => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[useOfflineUnlock] Refreshing keys for devices:', macAddresses);
      
      // For now, just refresh all offline keys
      // TODO: Implement specific device refresh when API supports it
      const keys = await NokeAPIService.getAllOfflineKeys(true); // Force refresh
      setOfflineKeys(keys);
      
      console.log('[useOfflineUnlock] ✅ Refreshed all keys');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('[useOfflineUnlock] ❌ Error refreshing keys for devices:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[useOfflineUnlock] Clearing offline keys cache...');
      
      await NokeAPIService.clearOfflineKeysCache();
      setOfflineKeys({});
      
      console.log('[useOfflineUnlock] ✅ Cache cleared');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('[useOfflineUnlock] ❌ Error clearing cache:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    offlineKeys,
    isLoading,
    error,
    getOfflineKeys,
    refreshOfflineKeys,
    refreshKeysForDevices,
    clearCache,
  };
};
