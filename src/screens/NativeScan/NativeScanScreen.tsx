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
} from 'react-native';
import { styles, getSignalStrength } from './styles';
import NativeScanner, { BleDevice, FilterSettings } from '../../../modules/NativeScanner/js/index';

export const NativeScanScreen: React.FC = () => {
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
  const listenersRef = useRef<any[]>([]);

  useEffect(() => {
    // Load current filter settings
    loadFilterSettings();

    // Setup event listeners
    const deviceListener = NativeScanner.onDeviceDiscovered((device: BleDevice) => {
      console.log('[NativeScan] Device discovered:', device.name, device.id);
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
      console.log('[NativeScan] Scan stopped');
      setIsScanning(false);
    });

    const stateListener = NativeScanner.onBluetoothStateChanged((state: { state: string }) => {
      console.log('[NativeScan] Bluetooth state:', state.state);
      setBluetoothState(state.state);
    });

    const connectedListener = NativeScanner.onDeviceConnected((device) => {
      console.log('[NativeScan] Device connected:', device.name);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isConnected: true, isConnecting: false } : d))
      );
    });

    const disconnectedListener = NativeScanner.onDeviceDisconnected((device) => {
      console.log('[NativeScan] Device disconnected:', device.name);
      if (device.error) {
        console.warn('[NativeScan] Disconnection error:', device.error);
      }
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isConnected: false, isConnecting: false } : d))
      );
    });

    const connectionErrorListener = NativeScanner.onDeviceConnectionError((device) => {
      console.error('[NativeScan] Connection error:', device.error);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, isConnected: false, isConnecting: false } : d))
      );
    });

    listenersRef.current = [
      deviceListener, 
      stopListener, 
      stateListener,
      connectedListener,
      disconnectedListener,
      connectionErrorListener
    ];

    return () => {
      listenersRef.current.forEach((listener) => listener.remove());
    };
  }, []);

  const loadFilterSettings = async () => {
    try {
      const settings = await NativeScanner.getFilterSettings();
      setFilterSettings(settings);
      console.log('[NativeScan] Current filter settings:', settings);
    } catch (error) {
      console.error('[NativeScan] Error loading filter settings:', error);
    }
  };

  const handleStartScan = async () => {
    try {
      setDevices([]);
      setIsScanning(true);
      await NativeScanner.startScan(10); // 10 second scan
      console.log('[NativeScan] Scan started');
    } catch (error) {
      console.error('[NativeScan] Error starting scan:', error);
      setIsScanning(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await NativeScanner.stopScan();
      setIsScanning(false);
      console.log('[NativeScan] Scan stopped manually');
    } catch (error) {
      console.error('[NativeScan] Error stopping scan:', error);
    }
  };

  const toggleServiceUUIDFilter = async () => {
    try {
      const newValue = !filterSettings.useServiceUUIDFilter;
      await NativeScanner.setServiceUUIDFilter(newValue);
      setFilterSettings((prev) => ({ ...prev, useServiceUUIDFilter: newValue }));
      console.log('[NativeScan] Service UUID filter:', newValue ? 'ON (Only Noke)' : 'OFF (All BLE)');
    } catch (error) {
      console.error('[NativeScan] Error toggling Service UUID filter:', error);
    }
  };

  const toggleNokeFilter = async () => {
    try {
      const newValue = !filterSettings.filterNokeOnly;
      await NativeScanner.setFilterNokeOnly(newValue);
      setFilterSettings((prev) => ({ ...prev, filterNokeOnly: newValue }));
      console.log('[NativeScan] Noke name filter:', newValue ? 'ON' : 'OFF');
    } catch (error) {
      console.error('[NativeScan] Error toggling Noke filter:', error);
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
      console.log('[NativeScan] RSSI threshold set to:', boundedThreshold, 'dBm');
    } catch (error) {
      console.error('[NativeScan] Error changing RSSI threshold:', error);
    }
  };

  const handleConnect = async (deviceId: string) => {
    try {
      console.log('[NativeScan] Connecting to device:', deviceId);
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, isConnecting: true } : d))
      );
      await NativeScanner.connect(deviceId);
    } catch (error) {
      console.error('[NativeScan] Connection failed:', error);
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, isConnecting: false } : d))
      );
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    try {
      console.log('[NativeScan] Disconnecting from device:', deviceId);
      await NativeScanner.disconnect(deviceId);
    } catch (error) {
      console.error('[NativeScan] Disconnection failed:', error);
    }
  };

  // Filter and sort devices based on search query
  const filteredAndSortedDevices = useMemo(() => {
    let filtered = devices;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = devices.filter(d => 
        d.name.toLowerCase().includes(query) || 
        d.id.toLowerCase().includes(query) ||
        d.advertising?.macAddress?.toLowerCase().includes(query)
      );
    }
    
    // Sort by best signal (highest RSSI first)
    return [...filtered].sort((a, b) => b.rssi - a.rssi);
  }, [devices, searchQuery]);

  const renderDevice = ({ item }: { item: BleDevice }) => {
    const signal = getSignalStrength(item.rssi);
    const hasManufacturerData = item.advertising?.macAddress !== undefined;
    
    return (
      <View style={styles.deviceItem}>
        <View style={styles.deviceInfo}>
          {/* Device Name */}
          <Text style={styles.deviceName}>{item.name}</Text>
          
          {/* Manufacturer Data - Only if available */}
          {hasManufacturerData && (
            <View style={styles.compactDataSection}>
              {item.advertising?.macAddress && (
                <Text style={styles.compactDataLine}>📍 MAC: {item.advertising.macAddress}</Text>
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
        <Text style={styles.title}>Native Scanner</Text>
        <Text style={styles.subtitle}>Pure iOS CoreBluetooth</Text>
        <Text style={styles.stateText}>Bluetooth: {bluetoothState}</Text>
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

