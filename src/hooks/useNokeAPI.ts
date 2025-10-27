/**
 * useNokeAPI - React hook for Noke API operations
 * 
 * Provides a convenient interface for interacting with the Noke API
 * from React components. Handles authentication state, session management,
 * and provides methods for unlock operations.
 */

import { useState, useEffect, useCallback } from 'react';
import NokeAPIService, {
  LoginCredentials,
  LoginResponse,
  UnlockCommandsResponse,
  OfflineKeysCache,
  OfflineKeyDevice,
} from '../services/NokeAPIService';

export interface UseNokeAPIReturn {
  // State
  isLoggedIn: boolean;
  userData: LoginResponse | null;
  isLoading: boolean;
  
  // Methods
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  getUnlockCommands: (mac: string, session: string) => Promise<UnlockCommandsResponse>;
  getAllOfflineKeys: (forceRefresh?: boolean) => Promise<OfflineKeysCache>;
  getOfflineKeyForDevice: (mac: string) => Promise<OfflineKeyDevice | null>;
  clearOfflineKeysCache: () => Promise<void>;
}

/**
 * Custom hook for Noke API operations
 */
export function useNokeAPI(): UseNokeAPIReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const restored = await NokeAPIService.restoreSession();
        if (restored) {
          setIsLoggedIn(true);
          setUserData(restored);
          console.log('[useNokeAPI] Session restored');
        }
      } catch (error) {
        console.error('[useNokeAPI] Error restoring session:', error);
      }
    };

    initialize();
  }, []);

  /**
   * Login with credentials
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const response = await NokeAPIService.login(credentials);
      setIsLoggedIn(true);
      setUserData(response);
      return response;
    } catch (error) {
      console.error('[useNokeAPI] Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await NokeAPIService.logout();
      setIsLoggedIn(false);
      setUserData(null);
    } catch (error) {
      console.error('[useNokeAPI] Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get unlock commands for online unlock
   */
  const getUnlockCommands = useCallback(async (mac: string, session: string): Promise<UnlockCommandsResponse> => {
    return await NokeAPIService.getUnlockCommands(mac, session);
  }, []);

  /**
   * Get all offline keys
   */
  const getAllOfflineKeys = useCallback(async (forceRefresh: boolean = false): Promise<OfflineKeysCache> => {
    return await NokeAPIService.getAllOfflineKeys(forceRefresh);
  }, []);

  /**
   * Get offline key for specific device
   */
  const getOfflineKeyForDevice = useCallback(async (mac: string): Promise<OfflineKeyDevice | null> => {
    return await NokeAPIService.getOfflineKeyForDevice(mac);
  }, []);

  /**
   * Clear offline keys cache
   */
  const clearOfflineKeysCache = useCallback(async (): Promise<void> => {
    return await NokeAPIService.clearOfflineKeysCache();
  }, []);

  return {
    isLoggedIn,
    userData,
    isLoading,
    login,
    logout,
    getUnlockCommands,
    getAllOfflineKeys,
    getOfflineKeyForDevice,
    clearOfflineKeysCache,
  };
}

