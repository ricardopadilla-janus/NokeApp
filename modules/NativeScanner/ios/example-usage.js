/**
 * Ejemplo completo de uso del módulo NativeScanner
 * 
 * Este ejemplo muestra cómo:
 * 1. Escanear dispositivos Noke
 * 2. Conectar a un dispositivo
 * 3. Ejecutar unlock offline
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

const { NativeScanner } = NativeModules;
const scannerEmitter = new NativeEventEmitter(NativeScanner);

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

  // ========== Event Handlers ==========

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
    // Aquí puedes ejecutar el unlock automáticamente si lo deseas
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

  // ========== Public Methods ==========

  async startScanning(durationSeconds = 10) {
    try {
      console.log(`🔍 Iniciando escaneo por ${durationSeconds} segundos...`);
      this.discoveredDevices.clear();
      await NativeScanner.startScan(durationSeconds);
    } catch (error) {
      console.error('Error al iniciar escaneo:', error);
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

// ========== Ejemplos de Uso ==========

export async function exampleScanAndConnect() {
  const manager = new NokeDeviceManager();
  
  // 1. Escanear dispositivos
  await manager.startScanning(10);
  
  // Esperar a que termine el escaneo (10 segundos)
  await new Promise(resolve => setTimeout(resolve, 11000));
  
  // 2. Obtener dispositivos encontrados
  const devices = manager.getDiscoveredDevices();
  if (devices.length === 0) {
    console.log('No se encontraron dispositivos');
    return;
  }
  
  // 3. Conectar al primer dispositivo
  const device = devices[0];
  await manager.connectToDevice(device.id);
  
  // 4. Esperar a que las características estén listas
  // (Se notifica vía evento CharacteristicsReady)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return { manager, device };
}

export async function exampleUnlock() {
  const manager = new NokeDeviceManager();
  
  // 1. Escanear y conectar
  await manager.startScanning(10);
  await new Promise(resolve => setTimeout(resolve, 11000));
  
  const devices = manager.getDiscoveredDevices();
  if (devices.length === 0) {
    console.log('No se encontraron dispositivos');
    return;
  }
  
  const device = devices[0];
  await manager.connectToDevice(device.id);
  
  // 2. Esperar características listas
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3. Ejecutar unlock (estos valores deberían venir de tu servidor)
  const offlineKey = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
  const unlockCommand = "FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210FEDCBA9876543210";
  
  try {
    await manager.unlockDevice(offlineKey, unlockCommand, device.id);
    console.log('Esperando respuesta del dispositivo...');
    
    // Esperar respuesta
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Desconectar
    await manager.disconnectDevice(device.id);
  } catch (error) {
    console.error('Error en proceso de unlock:', error);
  }
  
  manager.cleanup();
}

export async function exampleWithRealCredentials(deviceMac, offlineKey, unlockCommand) {
  const manager = new NokeDeviceManager();
  
  console.log('🚀 Iniciando proceso de unlock...');
  
  // 1. Escanear dispositivos
  console.log('📍 Paso 1: Escaneando dispositivos...');
  await manager.startScanning(15);
  await new Promise(resolve => setTimeout(resolve, 16000));
  
  // 2. Buscar el dispositivo específico
  console.log('📍 Paso 2: Buscando dispositivo...');
  const devices = manager.getDiscoveredDevices();
  const targetDevice = devices.find(d => 
    d.advertising?.macAddress === deviceMac || 
    d.name.includes(deviceMac)
  );
  
  if (!targetDevice) {
    console.error(`❌ Dispositivo con MAC ${deviceMac} no encontrado`);
    return;
  }
  
  console.log(`✅ Dispositivo encontrado: ${targetDevice.name}`);
  
  // 3. Conectar
  console.log('📍 Paso 3: Conectando...');
  await manager.connectToDevice(targetDevice.id);
  
  // 4. Esperar características
  console.log('📍 Paso 4: Esperando características...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 5. Verificar estado
  const state = await manager.getConnectionState(targetDevice.id);
  if (state !== 'connected') {
    console.error(`❌ Estado de conexión inválido: ${state}`);
    return;
  }
  
  // 6. Unlock
  console.log('📍 Paso 5: Ejecutando unlock...');
  try {
    await manager.unlockDevice(offlineKey, unlockCommand, targetDevice.id);
    
    // Esperar respuesta
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error en unlock:', error);
  } finally {
    // Cleanup
    await manager.disconnectDevice(targetDevice.id);
    manager.cleanup();
  }
}

// ========== Export ==========

export default NokeDeviceManager;

// ========== Uso en tu app ==========

/*
// En tu componente React Native:

import NokeDeviceManager from './path/to/example-usage';

function MyComponent() {
  const managerRef = useRef(null);
  
  useEffect(() => {
    managerRef.current = new NokeDeviceManager();
    
    return () => {
      managerRef.current?.cleanup();
    };
  }, []);
  
  const handleScan = async () => {
    await managerRef.current.startScanning(10);
  };
  
  const handleUnlock = async (device, credentials) => {
    await managerRef.current.connectToDevice(device.id);
    // Esperar CharacteristicsReady event
    setTimeout(async () => {
      await managerRef.current.unlockDevice(
        credentials.offlineKey,
        credentials.unlockCommand,
        device.id
      );
    }, 3000);
  };
  
  return (
    <View>
      <Button title="Scan" onPress={handleScan} />
    </View>
  );
}
*/

