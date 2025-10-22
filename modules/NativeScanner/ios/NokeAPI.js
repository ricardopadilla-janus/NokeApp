/**
 * NokeAPI - Wrapper para el módulo nativo NokeAPIClient
 * 
 * Este módulo maneja toda la comunicación con la API de Noke:
 * - Login y autenticación
 * - Obtención de offline keys
 * - Comandos de unlock online
 * - Comandos de soporte
 * - Locate
 */

import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { NokeAPIClient } = NativeModules;

// Keys para AsyncStorage
const STORAGE_KEYS = {
  AUTH_TOKEN: '@noke_auth_token',
  USER_DATA: '@noke_user_data',
  OFFLINE_KEYS: '@noke_offline_keys',
  OFFLINE_KEYS_TIMESTAMP: '@noke_offline_keys_timestamp',
};

class NokeAPI {
  constructor() {
    this.userData = null;
    this.offlineKeys = null;
  }

  // ========================================
  // CONFIGURACIÓN
  // ========================================

  /**
   * Configura el ambiente (production o development)
   * @param {'production' | 'development' | string} environment
   */
  async setEnvironment(environment) {
    try {
      const url = await NokeAPIClient.setEnvironment(environment);
      console.log(`[NokeAPI] Environment set to: ${url}`);
      return url;
    } catch (error) {
      console.error('[NokeAPI] Error setting environment:', error);
      throw error;
    }
  }

  // ========================================
  // AUTENTICACIÓN
  // ========================================

  /**
   * Login con credenciales
   * @param {Object} credentials
   * @param {string} credentials.email - Email del usuario
   * @param {string} credentials.password - Password
   * @param {string} credentials.companyUUID - UUID de la compañía
   * @param {string} credentials.siteUUID - UUID del sitio
   * @param {string} [credentials.deviceId] - UUID del dispositivo (se genera automáticamente si no se provee)
   */
  async login({ email, password, companyUUID, siteUUID, deviceId }) {
    try {
      console.log('[NokeAPI] Logging in...');

      // Generar deviceUUID si no se provee
      const finalDeviceUUID = deviceId || await this._getOrCreateDeviceId();

      // Hacer login
      const result = await NokeAPIClient.login(
        email,
        password,
        companyUUID,
        siteUUID,
        finalDeviceUUID
      );

      // Guardar datos
      this.userData = result;
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, result.authToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result));

      // Configurar token en el módulo
      await NokeAPIClient.setAuthToken(result.authToken);

      console.log('[NokeAPI] ✅ Login successful');
      console.log(`[NokeAPI]    User UUID: ${result.userUUID}`);
      console.log(`[NokeAPI]    Site UUID: ${result.siteUUID}`);

      return result;
    } catch (error) {
      console.error('[NokeAPI] ❌ Login failed:', error);
      throw error;
    }
  }

  /**
   * Restaura la sesión desde AsyncStorage
   */
  async restoreSession() {
    try {
      const authToken = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (authToken && userDataString) {
        this.userData = JSON.parse(userDataString);
        await NokeAPIClient.setAuthToken(authToken);
        
        console.log('[NokeAPI] ✅ Session restored');
        return this.userData;
      }

      console.log('[NokeAPI] No session to restore');
      return null;
    } catch (error) {
      console.error('[NokeAPI] Error restoring session:', error);
      return null;
    }
  }

  /**
   * Cierra sesión y limpia datos
   */
  async logout() {
    try {
      await NokeAPIClient.clearAuthToken();
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      
      this.userData = null;
      
      console.log('[NokeAPI] ✅ Logged out');
    } catch (error) {
      console.error('[NokeAPI] Error logging out:', error);
      throw error;
    }
  }

  /**
   * Verifica si hay una sesión activa
   */
  isLoggedIn() {
    return this.userData !== null;
  }

  // ========================================
  // OFFLINE KEYS
  // ========================================

  /**
   * Obtiene todas las offline keys de la API y las cachea
   * @param {boolean} [forceRefresh=false] - Forzar actualización desde el servidor
   */
  async getAllOfflineKeys(forceRefresh = false) {
    try {
      // Verificar sesión
      if (!this.userData) {
        await this.restoreSession();
        if (!this.userData) {
          throw new Error('Not logged in. Call login() first.');
        }
      }

      // Verificar cache si no se fuerza refresh
      if (!forceRefresh) {
        const cached = await this._getCachedOfflineKeys();
        if (cached) {
          console.log('[NokeAPI] ✅ Using cached offline keys');
          this.offlineKeys = cached;
          return cached;
        }
      }

      console.log('[NokeAPI] Fetching offline keys from API...');
      console.log('[NokeAPI] 📤 Calling getAllOfflineKeys with:');
      console.log('[NokeAPI]    userUUID:', this.userData.userUUID);
      console.log('[NokeAPI]    companyUUID:', this.userData.companyUUID);
      console.log('[NokeAPI]    siteUUID:', this.userData.siteUUID);

      // Obtener del servidor
      const keys = await NokeAPIClient.getAllOfflineKeys(
        this.userData.userUUID,
        this.userData.companyUUID,
        this.userData.siteUUID
      );

      // Cachear
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_KEYS, JSON.stringify(keys));
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_KEYS_TIMESTAMP, Date.now().toString());

      this.offlineKeys = keys;

      const count = Object.keys(keys).length;
      console.log(`[NokeAPI] ✅ Offline keys obtained and cached (${count} devices)`);

      return keys;
    } catch (error) {
      console.error('[NokeAPI] ❌ Error getting offline keys:', error);
      throw error;
    }
  }

  /**
   * Obtiene la offline key de un dispositivo específico por MAC
   * @param {string} mac - MAC address del dispositivo
   */
  async getOfflineKeyForDevice(mac) {
    try {
      // Asegurarse de tener las keys
      if (!this.offlineKeys) {
        this.offlineKeys = await this.getAllOfflineKeys();
      }

      const device = this.offlineKeys[mac];

      if (!device) {
        console.log(`[NokeAPI] ⚠️  Device ${mac} not found`);
        console.log('[NokeAPI] Available MACs:', Object.keys(this.offlineKeys));
        return null;
      }

      console.log(`[NokeAPI] ✅ Offline key found for ${device.name} (${mac})`);
      return device;
    } catch (error) {
      console.error('[NokeAPI] Error getting device key:', error);
      throw error;
    }
  }

  /**
   * Lista todos los dispositivos disponibles
   */
  async listDevices() {
    try {
      if (!this.offlineKeys) {
        this.offlineKeys = await this.getAllOfflineKeys();
      }

      const devices = Object.values(this.offlineKeys).map(device => ({
        mac: device.mac,
        name: device.name,
        uuid: device.uuid,
        unitNumber: device.unitNumber,
        battery: device.battery,
        temperature: device.temperature,
        hwType: device.hwType,
        hasOfflineKey: !!device.offlineKey,
        hasUnlockCmd: !!device.unlockCmd,
        offlineExpiration: device.offlineExpiration,
      }));

      return devices;
    } catch (error) {
      console.error('[NokeAPI] Error listing devices:', error);
      throw error;
    }
  }

  // ========================================
  // UNLOCK ONLINE
  // ========================================

  /**
   * Obtiene comandos de unlock en tiempo real (requiere conexión)
   * @param {string} mac - MAC address del dispositivo
   * @param {string} session - Session data del dispositivo BLE
   */
  async getUnlockCommands(mac, session) {
    try {
      // Verificar sesión o restaurar
      if (!this.userData) {
        console.log('[NokeAPI] No userData, attempting to restore session...');
        await this.restoreSession();
        if (!this.userData) {
          throw new Error('Not logged in. Session expired, please restart the app.');
        }
      }

      console.log(`[NokeAPI] Getting unlock commands for ${mac}...`);
      console.log(`[NokeAPI] Session: ${session}`);

      const result = await NokeAPIClient.getUnlockCommands(mac, session);
      
      console.log('[NokeAPI] 📥 Raw result from native:', JSON.stringify(result, null, 2));

      console.log(`[NokeAPI] ✅ Unlock commands received (${result.commands?.length || 0} commands)`);

      return {
        commandString: result.commandString, // Para usar con NativeScanner.sendCommands()
        commands: result.commands,
      };
    } catch (error) {
      console.error('[NokeAPI] Error getting unlock commands:', error);
      
      // Si es un error de token, limpiar la sesión guardada
      if (error.message?.includes('Token error') || error.message?.includes('token_error')) {
        console.log('[NokeAPI] Token expired, clearing session...');
        this.userData = null;
        await NokeAPIClient.clearAuthToken();
        throw new Error('Session expired. Please restart the app to login again.');
      }
      
      throw error;
    }
  }

  // ========================================
  // COMANDOS DE SOPORTE
  // ========================================

  /**
   * Obtiene comandos de soporte (requiere permisos de soporte)
   */
  async getSupportCommands() {
    try {
      console.log('[NokeAPI] Getting support commands...');

      const locks = await NokeAPIClient.getSupportCommands();

      console.log(`[NokeAPI] ✅ Support commands received (${locks.length} locks)`);

      return locks;
    } catch (error) {
      console.error('[NokeAPI] Error getting support commands:', error);
      throw error;
    }
  }

  // ========================================
  // LOCATE
  // ========================================

  /**
   * Envía comando de locate para hacer sonar/iluminar el dispositivo
   * @param {string} lockUUID - UUID del lock
   */
  async locateLock(lockUUID) {
    try {
      console.log(`[NokeAPI] Locating lock ${lockUUID}...`);

      await NokeAPIClient.locateLock(lockUUID);

      console.log('[NokeAPI] ✅ Locate command sent');
      return true;
    } catch (error) {
      console.error('[NokeAPI] Error locating lock:', error);
      throw error;
    }
  }

  // ========================================
  // HELPERS PRIVADOS
  // ========================================

  async _getOrCreateDeviceId() {
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

  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async _getCachedOfflineKeys() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_KEYS);
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_KEYS_TIMESTAMP);

      if (!cached || !timestamp) {
        return null;
      }

      // Verificar si el cache tiene menos de 24 horas
      const cacheAge = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas

      if (cacheAge > maxAge) {
        console.log('[NokeAPI] Cache expired, will fetch fresh data');
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      return null;
    }
  }

  /**
   * Limpia el cache de offline keys
   */
  async clearOfflineKeysCache() {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_KEYS);
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_KEYS_TIMESTAMP);
    this.offlineKeys = null;
    console.log('[NokeAPI] Offline keys cache cleared');
  }
}

// Exportar instancia singleton
export default new NokeAPI();

