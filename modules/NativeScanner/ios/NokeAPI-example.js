/**
 * Ejemplos de uso del módulo NokeAPI
 * 
 * Este archivo muestra cómo usar el módulo NokeAPI en tu app React Native
 */

import React, { useState, useEffect } from 'react';
import { View, Button, Text, FlatList, StyleSheet } from 'react-native';
import NokeAPI from './ios/NokeAPI';
import NokeDeviceManager from './ios/example-usage';

// ========================================
// EJEMPLO 1: LOGIN Y OBTENER OFFLINE KEYS
// ========================================

export function LoginAndGetKeysExample() {
  const [status, setStatus] = useState('');
  const [devices, setDevices] = useState([]);

  const handleLogin = async () => {
    try {
      setStatus('Iniciando sesión...');

      // 1. Configurar ambiente (opcional, por defecto es development)
      await NokeAPI.setEnvironment('development');

      // 2. Login
      const loginResult = await NokeAPI.login({
        email: 'ricardo.padilla@janusintl.com',
        password: 'Dr@keNoKe',
        companyUUID: '-1',
        siteUUID: '2223372',
        // deviceId se genera automáticamente si no se provee
      });

      setStatus(`✅ Login exitoso! User: ${loginResult.userUUID}`);

      // 3. Obtener offline keys
      setStatus('Obteniendo offline keys...');
      const offlineKeys = await NokeAPI.getAllOfflineKeys();

      // 4. Listar dispositivos
      const deviceList = await NokeAPI.listDevices();
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
  const manager = new NokeDeviceManager();

  useEffect(() => {
    // Auto-login al iniciar
    initializeSession();

    return () => {
      manager.cleanup();
    };
  }, []);

  const initializeSession = async () => {
    try {
      // Intentar restaurar sesión existente
      const session = await NokeAPI.restoreSession();
      
      if (session) {
        setStatus(`✅ Sesión restaurada: ${session.email}`);
        return;
      }

      // Si no hay sesión, hacer login
      setStatus('Iniciando sesión...');
      await NokeAPI.login({
        email: 'ricardo.padilla@janusintl.com',
        password: 'Dr@keNoKe',
        companyUUID: '-1',
        siteUUID: '2223372',
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

      await manager.startScanning(10);

      setTimeout(() => {
        const found = manager.getDiscoveredDevices();
        setDevices(found);
        setStatus(`Encontrados ${found.length} dispositivos`);
      }, 11000);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
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
      await manager.connectToDevice(bleDevice.id);

      // 2. Esperar a que las características estén listas
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setStatus('Obteniendo offline key...');

      // 3. Obtener offline key del API
      const deviceKeys = await NokeAPI.getOfflineKeyForDevice(deviceMAC);

      if (!deviceKeys) {
        setStatus(`❌ No hay offline key para ${deviceMAC}`);
        await manager.disconnectDevice(bleDevice.id);
        return;
      }

      setStatus('Enviando comando de unlock...');

      // 4. Ejecutar unlock offline
      await manager.unlockDevice(
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
        await manager.disconnectDevice(bleDevice.id);
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

      <Button title="Escanear Dispositivos BLE" onPress={handleScan} />

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
  const manager = new NokeDeviceManager();

  const handleOnlineUnlock = async (bleDevice, sessionData) => {
    try {
      const deviceMAC = bleDevice.advertising?.macAddress;

      if (!deviceMAC) {
        setStatus('❌ No se pudo obtener MAC');
        return;
      }

      setStatus('Conectando...');
      await manager.connectToDevice(bleDevice.id);
      await new Promise((r) => setTimeout(r, 3000));

      setStatus('Obteniendo comandos del servidor...');

      // Obtener comandos online (requiere internet)
      const unlockData = await NokeAPI.getUnlockCommands(deviceMAC, sessionData);

      setStatus('Enviando comandos...');

      // Enviar comandos al dispositivo
      await manager.sendCommands(unlockData.commandString, bleDevice.id);

      setStatus('✅ Unlock online enviado!');

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Online</Text>
      <Text style={styles.status}>{status}</Text>
      {/* ... resto del componente */}
    </View>
  );
}

// ========================================
// EJEMPLO 4: LOCATE (HACER SONAR)
// ========================================

export function LocateExample() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      // Restaurar sesión
      await NokeAPI.restoreSession();

      // Obtener lista de dispositivos
      const deviceList = await NokeAPI.listDevices();
      setDevices(deviceList);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const handleLocate = async (device) => {
    try {
      console.log(`Locating device: ${device.name}`);

      // Enviar comando de locate
      await NokeAPI.locateLock(device.uuid);

      alert(`✅ Comando de locate enviado a ${device.name}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const session = await NokeAPI.restoreSession();
    if (session) {
      setIsLoggedIn(true);
      setUserInfo(session);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await NokeAPI.login({
        email: 'ricardo.padilla@janusintl.com',
        password: 'Dr@keNoKe',
        companyUUID: '-1',
        siteUUID: '2223372',
      });

      setIsLoggedIn(true);
      setUserInfo(result);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await NokeAPI.logout();
    setIsLoggedIn(false);
    setUserInfo(null);
  };

  const handleRefreshKeys = async () => {
    try {
      // Forzar actualización desde el servidor
      await NokeAPI.getAllOfflineKeys(true);
      alert('✅ Offline keys actualizadas');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestión de Sesión</Text>

      {isLoggedIn ? (
        <>
          <Text style={styles.status}>
            ✅ Sesión activa: {userInfo?.email}
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

import { CompleteUnlockExample } from './NokeAPI-example';

function App() {
  return <CompleteUnlockExample />;
}

// O usa cada ejemplo individual según necesites

*/

