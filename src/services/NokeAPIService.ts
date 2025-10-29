/**
 * NokeAPIService - Pure TypeScript HTTP client for Noke API
 * 
 * This service handles all HTTP communication with the Noke API:
 * - Login and authentication
 * - Offline keys retrieval
 * - Online unlock commands
 * - Support commands
 * - Locate
 * 
 * Uses native fetch() API - no native module dependencies
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: '@noke_auth_token',
  USER_DATA: '@noke_user_data',
  OFFLINE_KEYS: '@noke_offline_keys',
  OFFLINE_KEYS_TIMESTAMP: '@noke_offline_keys_timestamp',
} as const;

// Type definitions
export interface LoginCredentials {
  email: string;
  password: string;
  companyUUID: string;
  siteUUID: string;
  deviceId?: string;
}

export interface LoginResponse {
  authToken: string;
  userUUID: string;
  siteUUID: string;
  companyUUID: string;
  email: string;
}

export interface OfflineKeyDevice {
  mac: string;
  name: string;
  uuid: string;
  offlineKey: string;
  unlockCmd: string;
  unitNumber?: string;
  unitUUID?: string;
  offlineExpiration?: string;
  battery?: number;
  temperature?: number;
  hwType?: string;
  scheduledUnlockCmd?: string;
}

export interface OfflineKeysCache {
  [mac: string]: OfflineKeyDevice;
}

export interface UnlockCommandsResponse {
  commandString: string;
  commands: string[];
}

class NokeAPIService {
  private baseURL: string = 'https://router.smartentry.noke.dev/';
  private authToken: string | null = null;
  private userData: LoginResponse | null = null;

  // ========================================
  // CONFIGURATION
  // ========================================

  /**
   * Set the API environment
   */
  setEnvironment(environment: string): void {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        this.baseURL = 'https://router.smartentry.noke.com/';
        break;
      case 'development':
      case 'dev':
      default:
        this.baseURL = 'https://router.smartentry.noke.dev/';
        break;
    }
    console.log(`[NokeAPIService] Environment set to: ${this.baseURL}`);
  }

  // ========================================
  // HTTP CLIENT
  // ========================================

  /**
   * Perform HTTP request
   */
  private async performRequest(
    endpoint: string,
    method: string = 'POST',
    body?: any,
    authorized: boolean = true
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Log curl command
    this.logCurlCommand(url, method, body);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authorized && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(`[NokeAPIService] 📥 HTTP ${response.status}`);

    // Parse response
    const data = await response.json();
    
    // Log key response info
    console.log(`[NokeAPIService] 📥 Response: ${data.result || 'unknown'} - ${data.message || 'no message'}`);
    
    // Log full response body
    console.log('\n[NokeAPIService] 📦 Response Body:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n');

    // Check for errors
    if (!response.ok) {
      const errorMessage = data.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  }

  /**
   * Log curl command for debugging
   */
  private logCurlCommand(url: string, method: string, body?: any): void {
    let curlCommand = `curl -X ${method} '${url}'`;
    
    curlCommand += ` \\\n  -H 'Content-Type: application/json'`;
    curlCommand += ` \\\n  -H 'Accept: application/json'`;

    if (this.authToken) {
      curlCommand += ` \\\n  -H 'Authorization: Bearer ${this.authToken.substring(0, 50)}...'`; // Truncate token for readability
    }

    if (body) {
      curlCommand += ` \\\n  -d '${JSON.stringify(body)}'`;
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`[NokeAPIService] 🔧 ${method} ${url}`);
    console.log('═'.repeat(80));
    console.log(curlCommand);
    console.log('═'.repeat(80) + '\n');
  }

  // ========================================
  // AUTHENTICATION
  // ========================================

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log('[NokeAPIService] Logging in...');

      // Generate device UUID if not provided
      const finalDeviceId = credentials.deviceId || await this._getOrCreateDeviceId();

      const result = await this.performRequest(
        'login/',
        'POST',
        {
          email: credentials.email,
          password: credentials.password,
          companyUUID: credentials.companyUUID,
          siteUUID: credentials.siteUUID,
          deviceUUID: finalDeviceId,
        },
        false
      );

      // Extract token and user data
      const token = result.token;
      if (!token) {
        throw new Error('No token in login response');
      }

      this.authToken = token;

      // Extract userUUID from data object
      let extractedUserUUID = '';
      if (result.data) {
        extractedUserUUID = result.data.userUUID || result.data.id?.toString() || '';
      }

      const loginResponse: LoginResponse = {
        authToken: token,
        userUUID: extractedUserUUID,
        siteUUID: result.data?.defaultSiteUUID || credentials.siteUUID,
        companyUUID: credentials.companyUUID,
        email: credentials.email,
      };

      // Save to async storage
      this.userData = loginResponse;
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(loginResponse));

      console.log('[NokeAPIService] ✅ Login successful');
      console.log(`[NokeAPIService]    User UUID: ${loginResponse.userUUID}`);
      console.log(`[NokeAPIService]    Site UUID: ${loginResponse.siteUUID}`);

      return loginResponse;
    } catch (error) {
      console.error('[NokeAPIService] ❌ Login failed:', error);
      throw error;
    }
  }

  /**
   * Restore session from AsyncStorage
   */
  async restoreSession(): Promise<LoginResponse | null> {
    try {
      const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (authToken && userDataString) {
        this.authToken = authToken;
        this.userData = JSON.parse(userDataString);
        
        console.log('[NokeAPIService] ✅ Session restored');
        return this.userData;
      }

      console.log('[NokeAPIService] No session to restore');
      return null;
    } catch (error) {
      console.error('[NokeAPIService] Error restoring session:', error);
      return null;
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      this.authToken = null;
      this.userData = null;
      
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      
      console.log('[NokeAPIService] ✅ Logged out');
    } catch (error) {
      console.error('[NokeAPIService] Error logging out:', error);
      throw error;
    }
  }

  /**
   * Check if logged in
   */
  isLoggedIn(): boolean {
    return this.userData !== null && this.authToken !== null;
  }

  /**
   * Get current user data
   */
  getUserData(): LoginResponse | null {
    return this.userData;
  }

  // ========================================
  // OFFLINE KEYS
  // ========================================

  /**
   * Get all offline keys from API
   */
  async getAllOfflineKeys(forceRefresh: boolean = false): Promise<OfflineKeysCache> {
    try {
      // Verify session
      if (!this.userData) {
        await this.restoreSession();
        if (!this.userData) {
          throw new Error('Not logged in. Call login() first.');
        }
      }

      // Check cache if not forcing refresh
      if (!forceRefresh) {
        const cached = await this._getCachedOfflineKeys();
        if (cached) {
          console.log('[NokeAPIService] ✅ Using cached offline keys');
          return cached;
        }
      }

      console.log('[NokeAPIService] 🔑 Fetching offline keys from API...');

      const result = await this.performRequest('user/locks/', 'POST', {}, true);

      // Parse response
      const offlineKeys: OfflineKeysCache = {};
      let totalDevices = 0;
      let devicesWithKeys = 0;

      if (result.data?.units) {
        console.log(`[NokeAPIService] 📊 Processing ${result.data.units.length} units from API response`);
        
        for (const unit of result.data.units) {
          const unitNumber = unit.name || '';
          const unitUUID = unit.uuid || '';

          if (unit.locks) {
            for (const device of unit.locks) {
              totalDevices++;
              
              const mac = device.mac;
              if (!mac) continue;

              // Get offline key
              let offlineKey = device.offlineKey;
              if (!offlineKey && device.offlineKeyObj?.offlineKey) {
                offlineKey = device.offlineKeyObj.offlineKey;
              }

              // Get unlock command - prefer unlockCmd, fallback to scheduledUnlockCmd
              let unlockCmd = device.unlockCmd;
              if (!unlockCmd && device.scheduledUnlockCmd) {
                unlockCmd = device.scheduledUnlockCmd;
              }
              
              // Log raw values from API
              console.log(`[API RAW] Device: ${device.name}`);
              console.log(`[API RAW] offlineKey: ${device.offlineKey}`);
              console.log(`[API RAW] offlineKeyObj.offlineKey: ${device.offlineKeyObj?.offlineKey}`);
              console.log(`[API RAW] unlockCmd: ${device.unlockCmd}`);
              console.log(`[API RAW] scheduledUnlockCmd: ${device.scheduledUnlockCmd}`);
              
              if (offlineKey) {
                devicesWithKeys++;
                
                offlineKeys[mac] = {
                  mac,
                  name: device.name || 'Unknown',
                  uuid: device.uuid || '',
                  offlineKey,
                  unlockCmd: unlockCmd || '', // Can be empty, we'll use the offlineKey to generate commands
                  unitNumber,
                  unitUUID,
                  scheduledUnlockCmd: device.scheduledUnlockCmd,
                  offlineExpiration: device.offlineKeyObj?.offlineExpiration,
                  battery: device.battery,
                  temperature: device.temperature,
                  hwType: device.hwType,
                };
                
                console.log(`[NokeAPIService] ✅ Added device ${device.name} (${mac}) with offlineKey`);
              } else {
                console.log(`[NokeAPIService] ⚠️  Device ${device.name} (${mac}): no offlineKey`);
              }
            }
          }
        }
      }

      console.log('\n' + '═'.repeat(80));
      console.log(`[NokeAPIService] ✅ RESULT: ${devicesWithKeys}/${totalDevices} devices have offline keys`);
      console.log('═'.repeat(80) + '\n');

      // Cache the result
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_KEYS, JSON.stringify(offlineKeys));
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_KEYS_TIMESTAMP, Date.now().toString());

      return offlineKeys;
    } catch (error) {
      console.error('[NokeAPIService] ❌ Error getting offline keys:', error);
      throw error;
    }
  }

  /**
   * Get offline key for specific device by MAC
   */
  async getOfflineKeyForDevice(mac: string): Promise<OfflineKeyDevice | null> {
    try {
      const offlineKeys = await this.getAllOfflineKeys();
      const device = offlineKeys[mac];

      if (!device) {
        console.log(`[NokeAPIService] ⚠️  Device ${mac} not found`);
        return null;
      }

      console.log(`[NokeAPIService] ✅ Offline key found for ${device.name} (${mac})`);
      return device;
    } catch (error) {
      console.error('[NokeAPIService] Error getting device key:', error);
      throw error;
    }
  }

  // ========================================
  // ONLINE UNLOCK
  // ========================================

  /**
   * Get unlock commands for online unlock
   */
  async getUnlockCommands(mac: string, session: string): Promise<UnlockCommandsResponse> {
    try {
      // Verify session
      if (!this.userData) {
        await this.restoreSession();
        if (!this.userData) {
          throw new Error('Not logged in. Session expired, please restart the app.');
        }
      }

      console.log(`[NokeAPIService] Getting unlock commands for ${mac}...`);

      const result = await this.performRequest(
        'lock/unlock/',
        'POST',
        { session, mac },
        true
      );

      // Check for errors
      if (result.result === 'failure') {
        const errorMessage = result.message || 'Unknown error';
        throw new Error(errorMessage);
      }

      // Extract commands
      let commands: string[] | null = null;

      if (result.commands) {
        commands = result.commands;
      } else if (result.data?.commands) {
        commands = result.data.commands;
      }

      if (!commands || commands.length === 0) {
        throw new Error('No commands found in response');
      }

      const commandString = commands.join('+');

      console.log(`[NokeAPIService] ✅ Unlock commands received (${commands.length} commands)`);

      return {
        commandString,
        commands,
      };
    } catch (error) {
      console.error('[NokeAPIService] Error getting unlock commands:', error);
      
      // Clear session on token errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Token') || errorMessage.includes('token')) {
        console.log('[NokeAPIService] Token expired, clearing session...');
        this.userData = null;
        this.authToken = null;
      }
      
      throw error;
    }
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Get or create device ID
   */
  private async _getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('@noke_device_id');
      
      if (!deviceId) {
        deviceId = this._generateUUID();
        await AsyncStorage.setItem('@noke_device_id', deviceId);
      }

      return deviceId;
    } catch (error) {
      return this._generateUUID();
    }
  }

  /**
   * Generate UUID
   */
  private _generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get cached offline keys
   */
  private async _getCachedOfflineKeys(): Promise<OfflineKeysCache | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_KEYS);
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_KEYS_TIMESTAMP);

      if (!cached || !timestamp) {
        return null;
      }

      // Check if cache is less than 24 hours old
      const cacheAge = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxAge) {
        console.log('[NokeAPIService] Cache expired, will fetch fresh data');
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear offline keys cache
   */
  async clearOfflineKeysCache(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_KEYS);
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_KEYS_TIMESTAMP);
    console.log('[NokeAPIService] Offline keys cache cleared');
  }
}

// Export singleton instance
export default new NokeAPIService();

