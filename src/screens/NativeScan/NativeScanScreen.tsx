import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { styles, getSignalStrength } from './styles';
import NativeScanner, { BleDevice, FilterSettings } from '../../../modules/NativeScanner/js/index';
import { useNokeAPI } from '../../hooks/useNokeAPI';
import { NOKE_CREDENTIALS } from '../../config/nokeCredentials';
import { useOfflineUnlock } from './hooks/useOfflineUnlock';

export const NativeScanScreen: React.FC = () => {
  // Noke API hook (for online unlock)
  const {
    isLoggedIn,
    userData,
    login: loginToAPI,
    getUnlockCommands,
  } = useNokeAPI();

  // Offline unlock hook
  const offlineUnlock = useOfflineUnlock();

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [bluetoothState, setBluetoothState] = useState<string>('unknown');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    rssiThreshold: -89,
    filterNokeOnly: false,
    useServiceUUIDFilter: true,  // Most important filter - eliminates 99% of BLE devices
  });
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Unlock state
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [characteristicsReady, setCharacteristicsReady] = useState<Record<string, boolean>>({});
  const [unlockStatus, setUnlockStatus] = useState<Record<string, string>>({});
  const [isUnlocking, setIsUnlocking] = useState<Record<string, boolean>>({});
  
  // Device tracking
  const [deviceMacAddresses, setDeviceMacAddresses] = useState<Record<string, string>>({});
  const [deviceSessions, setDeviceSessions] = useState<Record<string, string>>({});
  
  const listenersRef = useRef<any[]>([]);
  const sessionInitialized = useRef(false);
  const offlineKeysFetched = useRef(false);

  useEffect(() => {
    // Login when entering this tab if not already logged in
    if (!sessionInitialized.current && !isLoggedIn) {
      initNokeSession();
      sessionInitialized.current = true;
    }
    
    // Fetch offline keys when logged in
    if (isLoggedIn && !offlineKeysFetched.current) {
      console.log('🐛 Logged in, fetching offline keys...');
      offlineUnlock.getOfflineKeys().catch((error) => {
        console.error('🐛 Error fetching offline keys:', error);
      });
      offlineKeysFetched.current = true;
    }
    
    // Load current filter settings
    loadFilterSettings();

    // Setup event listeners
    const deviceListener = NativeScanner.onDeviceDiscovered((device: BleDevice) => {
      console.log('🐛 Device discovered:', device.name, device.id);
      
      // Store MAC address if available (from advertising or device name)
      let macAddress = device.advertising?.macAddress;
      
      // If no MAC in advertising (iOS), extract from device name
      if (!macAddress) {
        const name = device.name || '';
        const match = name.match(/([A-F0-9]{12})$/i);
        if (match) {
          const macWithoutColons = match[1];
          macAddress = macWithoutColons.match(/.{1,2}/g)?.join(':').toUpperCase() || undefined;
        }
      }
      
      if (macAddress) {
        setDeviceMacAddresses((prev) => ({ ...prev, [device.id]: macAddress! }));
        console.log(`🐛 MAC stored: ${macAddress} for ${device.id} (${device.name})`);
      }
      
      setDevices((prev) => {
        const exists = prev.find((d) => d.id === device.id);
        if (exists) {
          // Update existing device but preserve connection state
          return prev.map((d) => (d.id === device.id ? { ...device, isConnected: d.isConnected, isConnecting: d.isConnecting } : d));
        }
        return [...prev, { ...device, isConnected: false, isConnecting: false }];
      });
    });

    const stopListener = NativeScanner.onScanStopped(() => {
      console.log('🐛 Scan stopped');
      setIsScanning(false);
    });

    const stateListener = NativeScanner.onBluetoothStateChanged((state: { state: string }) => {
      console.log('🐛 Bluetooth state:', state.state);
      setBluetoothState(state.state);
    });

    const connectedListener = NativeScanner.onDeviceConnected((device) => {
      console.log('🐛 Device connected:', device.name);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isConnected: true, isConnecting: false } : d))
      );
    });

    const disconnectedListener = NativeScanner.onDeviceDisconnected((device) => {
      console.log('🐛 Device disconnected:', device.name);
      if (device.error) {
        console.warn('🐛 Disconnection error:', device.error);
      }
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isConnected: false, isConnecting: false } : d))
      );
    });

    const connectionErrorListener = NativeScanner.onDeviceConnectionError((device) => {
      console.error('🐛 Connection error:', device.error);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isConnected: false, isConnecting: false } : d))
      );
    });

    // Unlock event listeners
    const servicesDiscoveredListener = NativeScanner.onServicesDiscovered((event) => {
      console.log('🐛 Services discovered:', event.servicesCount);
      setUnlockStatus((prev) => ({ ...prev, [event.id]: '🔍 Services discovered...' }));
    });

    const characteristicsReadyListener = NativeScanner.onCharacteristicsReady((event) => {
      console.log('🐛 ✅ Characteristics ready for device:', event.id);
      setCharacteristicsReady((prev) => ({ ...prev, [event.id]: true }));
      setUnlockStatus((prev) => ({ ...prev, [event.id]: '✅ Ready to unlock' }));
    });

    const sessionReadyListener = NativeScanner.onSessionReady((event) => {
      console.log('🐛 🔑 Session ready for device:', event.id);
      console.log('🐛    Session:', event.session);
      setDeviceSessions((prev) => ({ ...prev, [event.id]: event.session }));
      setUnlockStatus((prev) => ({ ...prev, [event.id]: '🔑 Session ready - Can unlock' }));
    });

    const commandResponseListener = NativeScanner.onCommandResponse((event) => {
      console.log('🐛 Command response:', event.response, event.responseType);
    });

    const unlockSuccessListener = NativeScanner.onUnlockSuccess((event) => {
      console.log('🐛 🎉 UNLOCK SUCCESS!', event);
      setUnlockStatus((prev) => ({ ...prev, [selectedDeviceId || '']: '🎉 Unlock Successful!' }));
      setIsUnlocking((prev) => ({ ...prev, [selectedDeviceId || '']: false }));
    });

    const unlockFailedListener = NativeScanner.onUnlockFailed((event) => {
      console.error('🐛 ❌ UNLOCK FAILED:', event.error);
      setUnlockStatus((prev) => ({ ...prev, [selectedDeviceId || '']: `❌ Failed: ${event.error}` }));
      setIsUnlocking((prev) => ({ ...prev, [selectedDeviceId || '']: false }));
    });

    listenersRef.current = [
      deviceListener, 
      stopListener, 
      stateListener,
      connectedListener,
      disconnectedListener,
      connectionErrorListener,
      servicesDiscoveredListener,
      characteristicsReadyListener,
      sessionReadyListener,
      commandResponseListener,
      unlockSuccessListener,
      unlockFailedListener
    ];

    return () => {
      listenersRef.current.forEach((listener) => listener.remove());
    };
  }, [deviceMacAddresses]);

  const loadFilterSettings = async () => {
    try {
      const settings = await NativeScanner.getFilterSettings();
      setFilterSettings(settings);
      console.log('🐛 Current filter settings:', settings);
    } catch (error) {
      console.error('🐛 Error loading filter settings:', error);
    }
  };

  const handleStartScan = async () => {
    try {
      setDevices([]);
      setIsScanning(true);
      await NativeScanner.startScan(10); // 10 second scan
      console.log('🐛 Scan started');
    } catch (error) {
      console.error('🐛 Error starting scan:', error);
      setIsScanning(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await NativeScanner.stopScan();
      setIsScanning(false);
      console.log('🐛 Scan stopped manually');
    } catch (error) {
      console.error('🐛 Error stopping scan:', error);
    }
  };

  const toggleServiceUUIDFilter = async () => {
    try {
      const newValue = !filterSettings.useServiceUUIDFilter;
      await NativeScanner.setServiceUUIDFilter(newValue);
      setFilterSettings((prev) => ({ ...prev, useServiceUUIDFilter: newValue }));
      console.log('🐛 Service UUID filter:', newValue ? 'ON (Only Noke)' : 'OFF (All BLE)');
    } catch (error) {
      console.error('🐛 Error toggling Service UUID filter:', error);
    }
  };

  const toggleNokeFilter = async () => {
    try {
      const newValue = !filterSettings.filterNokeOnly;
      await NativeScanner.setFilterNokeOnly(newValue);
      setFilterSettings((prev) => ({ ...prev, filterNokeOnly: newValue }));
      console.log('🐛 Noke name filter:', newValue ? 'ON' : 'OFF');
    } catch (error) {
      console.error('🐛 Error toggling Noke filter:', error);
    }
  };

  const changeRSSIThreshold = async (direction: 'stronger' | 'weaker') => {
    try {
      // Adjust RSSI by 10 dBm
      const adjustment = direction === 'stronger' ? 10 : -10;
      const newThreshold = filterSettings.rssiThreshold + adjustment;
      
      // Keep within reasonable bounds (-100 to -30)
      const boundedThreshold = Math.max(-100, Math.min(-30, newThreshold));
      
      await NativeScanner.setRSSIThreshold(boundedThreshold);
      setFilterSettings((prev) => ({ ...prev, rssiThreshold: boundedThreshold }));
      console.log('🐛 RSSI threshold set to:', boundedThreshold, 'dBm');
    } catch (error) {
      console.error('🐛 Error changing RSSI threshold:', error);
    }
  };

  const handleConnect = async (deviceId: string) => {
    try {
      console.log('🐛 Connecting to device:', deviceId);
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, isConnecting: true } : d))
      );
      await NativeScanner.connect(deviceId);
    } catch (error) {
      console.error('🐛 Connection failed:', error);
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, isConnecting: false } : d))
      );
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    try {
      console.log('🐛 Disconnecting from device:', deviceId);
      await NativeScanner.disconnect(deviceId);
      // Clear unlock state for this device
      setCharacteristicsReady((prev) => {
        const newState = { ...prev };
        delete newState[deviceId];
        return newState;
      });
      setUnlockStatus((prev) => {
        const newState = { ...prev };
        delete newState[deviceId];
        return newState;
      });
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
      }
    } catch (error) {
      console.error('🐛 Disconnection failed:', error);
    }
  };

  const handleOnlineUnlock = async (deviceId: string) => {
    try {
      console.log('🐛 Starting unlock for device:', deviceId);
      setIsUnlocking((prev) => ({ ...prev, [deviceId]: true }));
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '🔓 Unlocking...' }));
      
      // Get device and extract MAC address
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }
      
      const macAddress = getMacAddress(device);
      console.log(`🐛 Extracted MAC: ${macAddress} from device: ${device.name}`);
      
      if (!macAddress) {
        throw new Error('No MAC address found for device');
      }
      
      // Get session from device
      const session = deviceSessions[deviceId] || '';
      
      if (!session) {
        throw new Error('No session available. Wait for session to be read from device.');
      }
      
      console.log('🐛 Getting unlock commands for MAC:', macAddress);
      console.log('🐛 Using session:', session.substring(0, 16) + '...');
      
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '📡 Getting unlock commands...' }));
      const unlockData = await getUnlockCommands(macAddress, session);
      
      console.log('🐛 Got unlock commands:', unlockData.commands?.length || 0);
      console.log('🐛 🌐 ONLINE UNLOCK - Command from API:');
      console.log('   Full command string:', unlockData.commandString);
      console.log('   Individual commands:', unlockData.commands);
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '🔐 Sending unlock...' }));
      
      // Send commands to device
      await NativeScanner.sendCommands(unlockData.commandString, deviceId);
      
      console.log('🐛 Unlock command sent, waiting for response...');
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '⏳ Waiting for response...' }));
      
      // Auto-reset after 5 seconds
      setTimeout(() => {
        setIsUnlocking((prev) => ({ ...prev, [deviceId]: false }));
        setUnlockStatus((prev) => ({ 
          ...prev, 
          [deviceId]: prev[deviceId]?.includes('Success') || prev[deviceId]?.includes('Failed') 
            ? prev[deviceId] 
            : '✅ Unlocked successfully' 
        }));
      }, 5000);
      
    } catch (error: any) {
      console.error('🐛 Unlock failed:', error);
      
      // If token expired, try to re-login automatically
      if (error.message?.includes('Session expired')) {
        console.log('🐛 Token expired, attempting automatic re-login...');
        setUnlockStatus((prev) => ({ ...prev, [deviceId]: '🔄 Re-logging in...' }));
        
        try {
          // Force a fresh login (not just restore)
          await initNokeSession(true);
          setUnlockStatus((prev) => ({ ...prev, [deviceId]: '✅ Re-logged in. Please try unlock again.' }));
          setIsUnlocking((prev) => ({ ...prev, [deviceId]: false }));
        } catch (reloginError: any) {
          setUnlockStatus((prev) => ({ ...prev, [deviceId]: `❌ Re-login failed: ${reloginError.message}` }));
          setIsUnlocking((prev) => ({ ...prev, [deviceId]: false }));
        }
      } else {
        setUnlockStatus((prev) => ({ ...prev, [deviceId]: `❌ Error: ${error.message}` }));
        setIsUnlocking((prev) => ({ ...prev, [deviceId]: false }));
      }
    }
  };

  const handleOfflineUnlock = async (deviceId: string, macAddress: string) => {
    try {
      console.log('🐛 Starting offline unlock for device:', deviceId, 'MAC:', macAddress);
      setIsUnlocking((prev) => ({ ...prev, [deviceId]: true }));
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '📴 Offline unlocking...' }));
      
      // Get offline key for this device
      const offlineKeyData = offlineUnlock.offlineKeys[macAddress];
      
      if (!offlineKeyData) {
        throw new Error('No offline key available. Please refresh offline keys.');
      }
      
      console.log('🐛 Found offline key for:', offlineKeyData.name);
      console.log('🐛 OfflineKey:', offlineKeyData.offlineKey);
      console.log('🐛 UnlockCmd:', offlineKeyData.unlockCmd);
      console.log('🐛 OfflineKey Expiration:', offlineKeyData.offlineExpiration);
      console.log('🐛 Scheduled UnlockCmd:', offlineKeyData.scheduledUnlockCmd);
      
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '📴 Sending offline unlock...' }));
      
      // Device must be connected for offline unlock
      if (!devices.find(d => d.id === deviceId)?.isConnected) {
        throw new Error('Device must be connected for offline unlock');
      }
      
      // Use scheduledUnlockCmd for offline unlock
      let unlockCommand = offlineKeyData.scheduledUnlockCmd || offlineKeyData.unlockCmd;
      
      if (!unlockCommand) {
        throw new Error('No unlock command available (neither scheduledUnlockCmd nor unlockCmd is present)');
      }
      
      console.log('🐛 Using offline unlock command:', unlockCommand);
      
      // Use offlineUnlock to encrypt with offlineKey + session
      console.log('🐛 🔄 Calling offlineUnlock to encrypt');
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '📴 Encrypting and sending...' }));
      
      await NativeScanner.offlineUnlock(offlineKeyData.offlineKey, unlockCommand, deviceId);
      
      console.log('🐛 ✅ Offline unlock command sent');
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '✅ Offline unlock sent' }));
      
      setIsUnlocking((prev) => ({ ...prev, [deviceId]: false }));
    } catch (error: any) {
      console.error('🐛 Offline unlock failed:', error);
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: `❌ ${error.message}` }));
      setIsUnlocking((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  // Helper function to extract MAC address from device name or advertising
  const getMacAddress = (device: BleDevice): string | null => {
    // Try to get from advertising first (Android)
    if (device.advertising?.macAddress) {
      return device.advertising.macAddress;
    }
    
    // Extract from device name (iOS) - format: NOKE3E_D01FA644B36F -> D0:1F:A6:44:B3:6F
    const name = device.name || '';
    const match = name.match(/([A-F0-9]{12})$/i);
    if (match) {
      const macWithoutColons = match[1];
      // Convert D01FA644B36F to D0:1F:A6:44:B3:6F
      const mac = macWithoutColons.match(/.{1,2}/g)?.join(':').toUpperCase();
      return mac || null;
    }
    
    return null;
  };

  const handleSendCommand = async (deviceId: string, command: string) => {
    try {
      console.log('🐛 Sending custom command:', command);
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '📤 Sending command...' }));
      
      await NativeScanner.sendCommands(command, deviceId);
      console.log('🐛 Command sent');
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: '✅ Command sent' }));
    } catch (error: any) {
      console.error('🐛 Send command failed:', error);
      setUnlockStatus((prev) => ({ ...prev, [deviceId]: `❌ Error: ${error.message}` }));
    }
  };

  // ========== Noke API Functions ==========

  const initNokeSession = async (forceLogin = false) => {
    try {
      console.log('🐛 Initializing Noke session...');
      
      // If already logged in and not forcing, return
      if (isLoggedIn && !forceLogin) {
        console.log('🐛 Already logged in');
        return;
      }
      
      // Perform login
      console.log('🐛 Performing login...');
      
      const loginResult = await loginToAPI({
        email: NOKE_CREDENTIALS.email,
        password: NOKE_CREDENTIALS.password,
        companyUUID: NOKE_CREDENTIALS.companyUUID,
        siteUUID: NOKE_CREDENTIALS.siteUUID,
        deviceId: NOKE_CREDENTIALS.deviceId || undefined,
      });
      
      console.log('🐛 ✅ Logged in:', loginResult.userUUID);
      
    } catch (error: any) {
      console.error('🐛 ❌ Failed to initialize session:', error);
      Alert.alert('Login Failed', `Could not login to Noke API: ${error.message}`);
    }
  };

  // Filter and sort devices based on search query
  const filteredAndSortedDevices = useMemo(() => {
    let filtered = devices;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = devices.filter(d => {
        const macFromHelper = deviceMacAddresses[d.id]?.toLowerCase() || '';
        return d.name.toLowerCase().includes(query) || 
               d.id.toLowerCase().includes(query) ||
               d.advertising?.macAddress?.toLowerCase().includes(query) ||
               macFromHelper.includes(query);
      });
    }
    
    // Sort by best signal (highest RSSI first)
    return [...filtered].sort((a, b) => b.rssi - a.rssi);
  }, [devices, searchQuery, deviceMacAddresses]);

  const renderDevice = ({ item }: { item: BleDevice }) => {
    const signal = getSignalStrength(item.rssi);
    const macAddress = deviceMacAddresses[item.id]; // MAC from our helper
    const sessionData = deviceSessions[item.id]; // Session if connected
    const hasDetails = macAddress || item.advertising?.version || item.advertising?.battery !== undefined;
    const isReady = characteristicsReady[item.id];
    const status = unlockStatus[item.id];
    const isDeviceUnlocking = isUnlocking[item.id];
    
    // Check if device has offline key available
    const hasOfflineKey = macAddress && offlineUnlock.offlineKeys[macAddress] !== undefined;
    
    return (
      <View style={styles.deviceItem}>
        <View style={styles.deviceInfo}>
          {/* Device Name */}
          <Text style={styles.deviceName}>{item.name}</Text>
          
          {/* Device Details - Show if we have MAC or other data */}
          {hasDetails && (
            <View style={styles.compactDataSection}>
              {macAddress && (
                <Text style={styles.compactDataLine}>📍 MAC: {macAddress}</Text>
              )}
              {sessionData && (
                <Text style={styles.compactDataLine}>🔑 Session: {sessionData.substring(0, 16)}...</Text>
              )}
              {item.advertising?.version && (
                <Text style={styles.compactDataLine}>🔧 Version: {item.advertising.version}</Text>
              )}
              {item.advertising?.battery !== undefined && (
                <Text style={styles.compactDataLine}>🔋 Battery: {item.advertising.battery}%</Text>
              )}
              {item.advertising?.manufacturerDataLength && (
                <Text style={styles.compactDataLine}>📦 Data: {item.advertising.manufacturerDataLength} bytes</Text>
              )}
            </View>
          )}
          
          {/* RSSI with Signal Strength Indicator */}
          <View style={styles.deviceDetails}>
            <Text style={styles.deviceRssi}>RSSI: {item.rssi} dBm</Text>
            <View style={[styles.signalIndicator, { backgroundColor: signal.color }]}>
              <Text style={styles.signalText}>{signal.text}</Text>
            </View>
          </View>

          {/* Unlock Status */}
          {item.isConnected && status && (
            <View style={styles.unlockStatusContainer}>
              <Text style={[
                styles.unlockStatusText,
                status.includes('Success') && styles.unlockSuccess,
                status.includes('Failed') && styles.unlockFailed,
              ]}>
                {status}
              </Text>
            </View>
          )}

          {/* Online Unlock Control - Show when connected */}
          {item.isConnected && isReady && (
            <TouchableOpacity
              style={[styles.onlineUnlockButton, isDeviceUnlocking && styles.unlockingButton]}
              onPress={() => handleOnlineUnlock(item.id)}
              disabled={isDeviceUnlocking}
            >
              {isDeviceUnlocking ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.unlockButtonText}>
                  🌐 Online Unlock
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Offline Unlock Control - Show when device has offline key */}
          {hasOfflineKey && (
            <TouchableOpacity
              style={[styles.offlineUnlockButton, isDeviceUnlocking && styles.unlockingButton]}
              onPress={() => handleOfflineUnlock(item.id, macAddress)}
              disabled={isDeviceUnlocking}
            >
              <Text style={styles.unlockButtonText}>
                📴 Offline Unlock
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Connect/Disconnect Button */}
        <TouchableOpacity
          style={[
            styles.connectButton,
            item.isConnected && styles.disconnectButton
          ]}
          onPress={() => (item.isConnected ? handleDisconnect(item.id) : handleConnect(item.id))}
          disabled={item.isConnecting}
        >
          {item.isConnecting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.connectButtonText}>
              {item.isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stateText}>Bluetooth: {bluetoothState}</Text>
      </View>

      {/* Offline Keys Status Card */}
      <View style={styles.offlineKeysCard}>
        <View style={styles.cardHeader}>
          <View style={styles.statusRow}>
            <Text style={styles.cardTitle}>🔑 Offline Keys</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {offlineUnlock.isLoading ? '⏳ Loading...' : `${Object.keys(offlineUnlock.offlineKeys).length} keys`}
              </Text>
            </View>
          </View>
          {offlineUnlock.error && (
            <Text style={styles.errorText}>❌ {offlineUnlock.error}</Text>
          )}
        </View>
        
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.primaryButton, offlineUnlock.isLoading && styles.buttonDisabled]}
            onPress={offlineUnlock.getOfflineKeys}
            disabled={offlineUnlock.isLoading}
          >
            <Text style={styles.primaryButtonText}>📥 Get Keys</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.secondaryButton, offlineUnlock.isLoading && styles.buttonDisabled]}
            onPress={offlineUnlock.refreshOfflineKeys}
            disabled={offlineUnlock.isLoading}
          >
            <Text style={styles.secondaryButtonText}>🔄 Refresh All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.secondaryButton, offlineUnlock.isLoading && styles.buttonDisabled]}
            onPress={() => {
              const macs = Object.values(deviceMacAddresses);
              if (macs.length > 0) {
                offlineUnlock.refreshKeysForDevices(macs);
              } else {
                Alert.alert('No Devices', 'Connect to devices first to refresh their keys');
              }
            }}
            disabled={offlineUnlock.isLoading}
          >
            <Text style={styles.secondaryButtonText}>📱 Connected</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Controls - Collapsible */}
      <View style={styles.filterSection}>
        <TouchableOpacity 
          style={styles.filterHeader}
          onPress={() => setFiltersExpanded(!filtersExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.filterHeaderLeft}>
            <Text style={styles.filterTitle}>
              {filtersExpanded ? '▼' : '▶'} Filters
            </Text>
            <Text style={styles.filterSummary}>
              {filterSettings.useServiceUUIDFilter ? '⭐ UUID' : ''}
              {filterSettings.filterNokeOnly ? ' 🎯 Name' : ''}
              {' 📡 ' + filterSettings.rssiThreshold + ' dBm'}
            </Text>
          </View>
          {isScanning && (
            <Text style={styles.filterStatus}>
              {filterSettings.useServiceUUIDFilter
                ? '🔍 Filtering'
                : '⚠️ All BLE'}
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Expanded Filter Controls */}
        {filtersExpanded && (
          <View style={styles.filterContent}>
            {/* Service UUID Filter - MOST IMPORTANT */}
            <View style={styles.filterRow}>
          <View style={styles.filterInfo}>
            <Text style={styles.filterLabel}>
              ⭐ Noke Service UUID Filter
            </Text>
            <Text style={[
              styles.filterDesc,
              { color: filterSettings.useServiceUUIDFilter ? '#4CAF50' : '#FF5722' }
            ]}>
              {filterSettings.useServiceUUIDFilter 
                ? '✅ ENABLED - CoreBluetooth filters 99% of devices' 
                : '🚨 DISABLED - Will see ALL BLE devices (debugging only)'}
            </Text>
          </View>
          <Switch
            value={filterSettings.useServiceUUIDFilter}
            onValueChange={toggleServiceUUIDFilter}
            disabled={isScanning}
            trackColor={{ false: '#FF5722', true: '#4CAF50' }}
          />
        </View>
        
        {/* Noke Name Filter - Secondary (mostly redundant with Service UUID) */}
        <View style={styles.filterRow}>
          <View style={styles.filterInfo}>
            <Text style={styles.filterLabel}>
              🎯 Noke Name Filter (Secondary)
            </Text>
            <Text style={[
              styles.filterDesc,
              { color: filterSettings.filterNokeOnly ? '#4CAF50' : '#999' }
            ]}>
              {filterSettings.filterNokeOnly 
                ? '✅ ENABLED - Additional name validation' 
                : '⚪ DISABLED - Redundant with Service UUID filter'}
            </Text>
          </View>
          <Switch
            value={filterSettings.filterNokeOnly}
            onValueChange={toggleNokeFilter}
            disabled={isScanning}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
          />
        </View>

        {/* RSSI Threshold */}
        <View style={styles.filterRow}>
          <View style={styles.filterInfo}>
            <Text style={styles.filterLabel}>
              📡 Signal Strength: {filterSettings.rssiThreshold} dBm
            </Text>
            <Text style={styles.filterDesc}>
              {filterSettings.rssiThreshold === -89 
                ? '✅ Default - Filtering weak signals' 
                : filterSettings.rssiThreshold > -89 
                  ? '🔥 Strict - Only strong signals'
                  : '⚠️ Permissive - Allowing weak signals'}
            </Text>
          </View>
          <View style={styles.rssiButtons}>
            <TouchableOpacity
              style={[styles.rssiButton, isScanning && styles.rssiButtonDisabled]}
              onPress={() => changeRSSIThreshold('weaker')}
              disabled={isScanning}
            >
              <Text style={styles.rssiButtonText}>➖</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rssiButton, isScanning && styles.rssiButtonDisabled]}
              onPress={() => changeRSSIThreshold('stronger')}
              disabled={isScanning}
            >
              <Text style={styles.rssiButtonText}>➕</Text>
            </TouchableOpacity>
          </View>
        </View>
          </View>
        )}
      </View>

      {/* Search and Scan Controls */}
      <View style={styles.controls}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search devices by name, ID, or MAC..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanningButton]}
          onPress={isScanning ? handleStopScan : handleStartScan}
        >
          {isScanning ? (
            <View style={styles.scanningContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.buttonText}>Stop Scan</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Start Native Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.devicesList}>
        <View style={styles.statsRow}>
          <Text style={styles.count}>
            {searchQuery.trim() 
              ? `Showing ${filteredAndSortedDevices.length} of ${devices.length}` 
              : `Devices Found: ${devices.length}`}
          </Text>
          <Text style={styles.statsInfo}>
            {devices.filter(d => d.advertising?.macAddress).length} with full data
          </Text>
        </View>
        {isScanning && devices.length === 0 ? (
          <View style={styles.scanning}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning with native code...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredAndSortedDevices}
            keyExtractor={(item) => item.id}
            renderItem={renderDevice}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {searchQuery.trim() ? 'No devices match search' : 'No devices found'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery.trim() ? 'Try a different search term' : 'Tap \'Start Native Scan\''}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default NativeScanScreen;

