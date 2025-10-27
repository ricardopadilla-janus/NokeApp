/**
 * Template de ejemplos para NokeAPI
 * 
 * INSTRUCCIONES:
 * 1. Copia este archivo como 'NokeAPIExamples.tsx'
 * 2. Reemplaza las credenciales de ejemplo con las tuyas reales
 * 3. NUNCA commitees NokeAPIExamples.tsx al repositorio
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useNokeAPI } from '../hooks/useNokeAPI';
import { NativeScanner } from '../../modules/NativeScanner/js/NativeScanner';
import { NativeEventEmitter } from 'react-native';

const scannerEmitter = new NativeEventEmitter(NativeScanner);

// ========================================
// EJEMPLO 1: LOGIN Y OBTENER OFFLINE KEYS
// ========================================

export function LoginAndGetKeysExample() {
  const [status, setStatus] = useState('');
  const [devices, setDevices] = useState([]);
  const { login, getAllOfflineKeys, listDevices, isLoggedIn } = useNokeAPI();

  const handleLogin = async () => {
    try {
      setStatus('Iniciando sesión...');

      // 🔐 REEMPLAZA ESTAS CREDENCIALES CON LAS TUYAS
      const loginResult = await login({
        email: 'tu-email@ejemplo.com',        // ← Cambia por tu email
        password: 'tu-password',               // ← Cambia por tu password
        companyUUID: 'tu-company-uuid',       // ← Cambia por tu company UUID
        siteUUID: 'tu-site-uuid',            // ← Cambia por tu site UUID
        // deviceId se genera automáticamente si no se provee
      });

      setStatus(`✅ Login exitoso! User: ${loginResult.userUUID}`);

      // 2. Obtener offline keys
      setStatus('Obteniendo offline keys...');
      await getAllOfflineKeys();

      // 3. Listar dispositivos
      const deviceList = await listDevices();
      setDevices(deviceList);

      setStatus(`✅ ${deviceList.length} dispositivos encontrados`);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login y Obtener Keys</Text>
      
      <Button title="Login y Obtener Keys" onPress={handleLogin} />
      
      <Text style={styles.status}>{status}</Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.mac}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceDetails}>
              MAC: {item.mac} | Unidad: #{item.unitNumber}
            </Text>
            <Text style={styles.deviceDetails}>
              Batería: {item.battery || 'N/A'}% | Temp: {item.temperature || 'N/A'}°C
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// ========================================
// EJEMPLO 2: UNLOCK OFFLINE COMPLETO
// ========================================

export function CompleteUnlockExample() {
  const [status, setStatus] = useState('Listo');
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const { login, getOfflineUnlockData, isLoggedIn, userData } = useNokeAPI();
  const managerRef = useRef(null);

  useEffect(() => {
    // Auto-login al iniciar
    initializeSession();
    setupBLEManager();

    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup();
      }
    };
  }, []);

  const setupBLEManager = () => {
    managerRef.current = new NokeDeviceManager();
  };

  const initializeSession = async () => {
    try {
      if (isLoggedIn) {
        setStatus(`✅ Sesión activa: ${userData?.email}`);
        return;
      }

      // 🔐 REEMPLAZA ESTAS CREDENCIALES CON LAS TUYAS
      setStatus('Iniciando sesión...');
      await login({
        email: 'tu-email@ejemplo.com',        // ← Cambia por tu email
        password: 'tu-password',               // ← Cambia por tu password
        companyUUID: 'tu-company-uuid',       // ← Cambia por tu company UUID
        siteUUID: 'tu-site-uuid',            // ← Cambia por tu site UUID
      });

      setStatus('✅ Sesión iniciada');
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const handleScan = async () => {
    try {
      setStatus('Escaneando dispositivos BLE...');
      setDevices([]);
      setIsScanning(true);

      await managerRef.current.startScanning(10);

      setTimeout(() => {
        const found = managerRef.current.getDiscoveredDevices();
        setDevices(found);
        setStatus(`Encontrados ${found.length} dispositivos`);
        setIsScanning(false);
      }, 11000);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
      setIsScanning(false);
    }
  };

  const handleUnlock = async (bleDevice) => {
    try {
      const deviceMAC = bleDevice.advertising?.macAddress;
      
      if (!deviceMAC) {
        setStatus('❌ No se pudo obtener MAC del dispositivo');
        return;
      }

      setStatus(`Conectando a ${bleDevice.name}...`);

      // 1. Conectar al dispositivo BLE
      await managerRef.current.connectToDevice(bleDevice.id);

      // 2. Esperar a que las características estén listas
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setStatus('Obteniendo offline key...');

      // 3. Obtener offline key del API usando el hook
      const deviceKeys = await getOfflineUnlockData(deviceMAC);

      if (!deviceKeys) {
        setStatus(`❌ No hay offline key para ${deviceMAC}`);
        await managerRef.current.disconnectDevice(bleDevice.id);
        return;
      }

      setStatus('Enviando comando de unlock...');

      // 4. Ejecutar unlock offline
      await managerRef.current.unlockDevice(
        deviceKeys.offlineKey,
        deviceKeys.unlockCmd,
        bleDevice.id
      );

      setStatus('⏳ Esperando respuesta del dispositivo...');

      // 5. Esperar respuesta
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setStatus('✅ Proceso completado!');

      // 6. Desconectar
      setTimeout(async () => {
        await managerRef.current.disconnectDevice(bleDevice.id);
        setStatus('Listo');
      }, 2000);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Offline Completo</Text>

      <Text style={styles.status}>{status}</Text>

      <Button 
        title={isScanning ? "Escaneando..." : "Escanear Dispositivos BLE"} 
        onPress={handleScan}
        disabled={isScanning}
      />

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceDetails}>
              MAC: {item.advertising?.macAddress || 'N/A'}
            </Text>
            <Text style={styles.deviceDetails}>
              RSSI: {item.rssi} | ID: {item.id.substring(0, 8)}...
            </Text>
            <Button title="Desbloquear" onPress={() => handleUnlock(item)} />
          </View>
        )}
      />
    </View>
  );
}

// ========================================
// EJEMPLO 3: UNLOCK ONLINE (CON CONEXIÓN)
// ========================================

export function OnlineUnlockExample() {
  const [status, setStatus] = useState('Listo');
  const [devices, setDevices] = useState([]);
  const { getUnlockCommands, isLoggedIn, userData } = useNokeAPI();
  const managerRef = useRef(null);

  useEffect(() => {
    setupBLEManager();
    return () => {
      if (managerRef.current) {
        managerRef.current.cleanup();
      }
    };
  }, []);

  const setupBLEManager = () => {
    managerRef.current = new NokeDeviceManager();
  };

  const handleScan = async () => {
    try {
      setStatus('Escaneando dispositivos BLE...');
      setDevices([]);

      await managerRef.current.startScanning(10);

      setTimeout(() => {
        const found = managerRef.current.getDiscoveredDevices();
        setDevices(found);
        setStatus(`Encontrados ${found.length} dispositivos`);
      }, 11000);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const handleOnlineUnlock = async (bleDevice) => {
    try {
      const deviceMAC = bleDevice.advertising?.macAddress;

      if (!deviceMAC) {
        setStatus('❌ No se pudo obtener MAC');
        return;
      }

      if (!isLoggedIn || !userData) {
        setStatus('❌ No hay sesión activa');
        return;
      }

      setStatus('Conectando...');
      await managerRef.current.connectToDevice(bleDevice.id);
      await new Promise((r) => setTimeout(r, 3000));

      setStatus('Obteniendo comandos del servidor...');

      // Obtener comandos online usando el hook
      const unlockData = await getUnlockCommands(deviceMAC, userData);

      setStatus('Enviando comandos...');

      // Enviar comandos al dispositivo
      await managerRef.current.sendCommands(unlockData.commandString, bleDevice.id);

      setStatus('✅ Unlock online enviado!');

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Online</Text>
      <Text style={styles.status}>{status}</Text>

      <Button title="Escanear Dispositivos" onPress={handleScan} />

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceDetails}>
              MAC: {item.advertising?.macAddress || 'N/A'}
            </Text>
            <Button title="Unlock Online" onPress={() => handleOnlineUnlock(item)} />
          </View>
        )}
      />
    </View>
  );
}

// ========================================
// EJEMPLO 4: LOCATE (HACER SONAR)
// ========================================

export function LocateExample() {
  const [devices, setDevices] = useState([]);
  const { listDevices, locateLock, isLoggedIn } = useNokeAPI();

  useEffect(() => {
    if (isLoggedIn) {
      loadDevices();
    }
  }, [isLoggedIn]);

  const loadDevices = async () => {
    try {
      // Obtener lista de dispositivos usando el hook
      const deviceList = await listDevices();
      setDevices(deviceList);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const handleLocate = async (device) => {
    try {
      console.log(`Locating device: ${device.name}`);

      // Enviar comando de locate usando el hook
      await locateLock(device.uuid);

      Alert.alert('Éxito', `✅ Comando de locate enviado a ${device.name}`);
    } catch (error) {
      Alert.alert('Error', `❌ Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Locate Dispositivos</Text>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.mac}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceDetails}>Unidad: #{item.unitNumber}</Text>
            <Button title="🔊 Locate" onPress={() => handleLocate(item)} />
          </View>
        )}
      />
    </View>
  );
}

// ========================================
// EJEMPLO 5: GESTIÓN DE SESIÓN
// ========================================

export function SessionManagementExample() {
  const { 
    isLoggedIn, 
    userData, 
    login, 
    logout, 
    getAllOfflineKeys 
  } = useNokeAPI();

  const handleLogin = async () => {
    try {
      // 🔐 REEMPLAZA ESTAS CREDENCIALES CON LAS TUYAS
      await login({
        email: 'tu-email@ejemplo.com',        // ← Cambia por tu email
        password: 'tu-password',               // ← Cambia por tu password
        companyUUID: 'tu-company-uuid',       // ← Cambia por tu company UUID
        siteUUID: 'tu-site-uuid',            // ← Cambia por tu site UUID
      });
    } catch (error) {
      Alert.alert('Error', `Error: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleRefreshKeys = async () => {
    try {
      // Forzar actualización desde el servidor
      await getAllOfflineKeys(true);
      Alert.alert('Éxito', '✅ Offline keys actualizadas');
    } catch (error) {
      Alert.alert('Error', `Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestión de Sesión</Text>

      {isLoggedIn ? (
        <>
          <Text style={styles.status}>
            ✅ Sesión activa: {userData?.email}
          </Text>
          <Button title="Actualizar Offline Keys" onPress={handleRefreshKeys} />
          <Button title="Cerrar Sesión" onPress={handleLogout} />
        </>
      ) : (
        <>
          <Text style={styles.status}>⚠️  No hay sesión activa</Text>
          <Button title="Iniciar Sesión" onPress={handleLogin} />
        </>
      )}
    </View>
  );
}

// ========================================
// HELPER CLASS: NokeDeviceManager
// ========================================

class NokeDeviceManager {
  constructor() {
    this.discoveredDevices = new Map();
    this.connectedDeviceId = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Eventos de escaneo
    scannerEmitter.addListener('DeviceDiscovered', this.onDeviceDiscovered.bind(this));
    scannerEmitter.addListener('ScanStopped', this.onScanStopped.bind(this));
    
    // Eventos de conexión
    scannerEmitter.addListener('DeviceConnected', this.onDeviceConnected.bind(this));
    scannerEmitter.addListener('DeviceDisconnected', this.onDeviceDisconnected.bind(this));
    scannerEmitter.addListener('DeviceConnectionError', this.onConnectionError.bind(this));
    
    // Eventos de servicios
    scannerEmitter.addListener('ServicesDiscovered', this.onServicesDiscovered.bind(this));
    scannerEmitter.addListener('CharacteristicsReady', this.onCharacteristicsReady.bind(this));
    
    // Eventos de comandos
    scannerEmitter.addListener('CommandResponse', this.onCommandResponse.bind(this));
    scannerEmitter.addListener('UnlockSuccess', this.onUnlockSuccess.bind(this));
    scannerEmitter.addListener('UnlockFailed', this.onUnlockFailed.bind(this));
    
    // Estado de Bluetooth
    scannerEmitter.addListener('BluetoothStateChanged', this.onBluetoothStateChanged.bind(this));
  }

  // Event Handlers
  onDeviceDiscovered(device) {
    console.log('📱 Dispositivo descubierto:', {
      name: device.name,
      id: device.id,
      rssi: device.rssi,
      macAddress: device.advertising?.macAddress
    });
    
    this.discoveredDevices.set(device.id, device);
  }

  onScanStopped() {
    console.log('🛑 Escaneo detenido');
    console.log(`Total de dispositivos encontrados: ${this.discoveredDevices.size}`);
  }

  onDeviceConnected(device) {
    console.log('✅ Conectado a dispositivo:', device.name);
    this.connectedDeviceId = device.id;
  }

  onDeviceDisconnected(device) {
    console.log('🔌 Desconectado de dispositivo:', device.name);
    if (device.error) {
      console.error('Error de desconexión:', device.error);
    }
    this.connectedDeviceId = null;
  }

  onConnectionError(device) {
    console.error('❌ Error de conexión:', device.error);
  }

  onServicesDiscovered(event) {
    console.log('🔍 Servicios descubiertos:', event.servicesCount);
  }

  onCharacteristicsReady(event) {
    console.log('🎯 Características listas - Puedes enviar comandos ahora');
  }

  onCommandResponse(event) {
    console.log('📨 Respuesta del dispositivo:', event.response);
    console.log('   Tipo:', event.responseType);
  }

  onUnlockSuccess(event) {
    console.log('🎉 ¡UNLOCK EXITOSO!');
    console.log('   Respuesta:', event.response);
  }

  onUnlockFailed(event) {
    console.error('❌ UNLOCK FALLÓ');
    console.error('   Error:', event.error);
    console.error('   Respuesta:', event.response);
  }

  onBluetoothStateChanged(event) {
    console.log('📡 Estado de Bluetooth:', event.state);
  }

  // Public Methods
  async startScanning(durationSeconds = 10) {
    try {
      console.log(`🔍 Iniciando escaneo por ${durationSeconds} segundos...`);
      this.discoveredDevices.clear();
      await NativeScanner.startScan(durationSeconds);
    } catch (error) {
      console.error('Error al iniciar escaneo:', error);
      throw error;
    }
  }

  async stopScanning() {
    try {
      console.log('⏹️ Deteniendo escaneo...');
      await NativeScanner.stopScan();
    } catch (error) {
      console.error('Error al detener escaneo:', error);
    }
  }

  async connectToDevice(deviceId) {
    try {
      console.log(`🔗 Conectando a dispositivo: ${deviceId}`);
      await NativeScanner.connect(deviceId);
    } catch (error) {
      console.error('Error al conectar:', error);
      throw error;
    }
  }

  async disconnectDevice(deviceId) {
    try {
      console.log(`🔌 Desconectando dispositivo: ${deviceId}`);
      await NativeScanner.disconnect(deviceId);
    } catch (error) {
      console.error('Error al desconectar:', error);
    }
  }

  async sendCommands(commandString, deviceId) {
    try {
      console.log('📤 Enviando comandos...');
      await NativeScanner.sendCommands(commandString, deviceId);
    } catch (error) {
      console.error('Error al enviar comandos:', error);
      throw error;
    }
  }

  async unlockDevice(offlineKey, unlockCommand, deviceId) {
    try {
      console.log('🔓 Ejecutando unlock offline...');
      console.log(`   Key length: ${offlineKey.length}`);
      console.log(`   Command length: ${unlockCommand.length}`);
      
      await NativeScanner.offlineUnlock(offlineKey, unlockCommand, deviceId);
      console.log('   Comando enviado, esperando respuesta...');
    } catch (error) {
      console.error('Error en unlock:', error);
      throw error;
    }
  }

  async getConnectionState(deviceId) {
    try {
      const state = await NativeScanner.getConnectionState(deviceId);
      console.log(`Estado de conexión: ${state}`);
      return state;
    } catch (error) {
      console.error('Error al obtener estado:', error);
      return 'unknown';
    }
  }

  getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }

  cleanup() {
    scannerEmitter.removeAllListeners();
  }
}

// ========================================
// ESTILOS
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  deviceItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  deviceDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
});

// ========================================
// USO EN TU APP
// ========================================

/*
// En tu App.js o componente principal:

import { CompleteUnlockExample } from './src/examples/NokeAPIExamples';

function App() {
  return <CompleteUnlockExample />;
}

// O usa cada ejemplo individual según necesites

*/
