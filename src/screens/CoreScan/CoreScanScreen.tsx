import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { styles as homeStyles } from '../Home/styles';
import { startScan as coreStartScan, stopScan as coreStopScan, getDevices as coreGetDevices } from '@noke-inc/react-native-core';

export const CoreScanScreen: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      coreStopScan().catch(() => {});
    };
  }, []);

  const start = async () => {
    try {
      setDevices([]);
      setIsScanning(true);
      await coreStartScan();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const list = await coreGetDevices();
          setDevices(list || []);
        } catch {}
      }, 1000);
    } catch (e) {
      setIsScanning(false);
    }
  };

  const stop = async () => {
    try {
      await coreStopScan();
    } finally {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setIsScanning(false);
    }
  };

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter((d) => d.toLowerCase().includes(q));
  }, [devices, searchQuery]);

  const renderItem = ({ item }: { item: string }) => (
    <View style={homeStyles.deviceItem}>
      <View style={homeStyles.deviceInfo}>
        <Text style={homeStyles.deviceName}>{item}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={homeStyles.container}>
      <View style={homeStyles.scanSection}>
        <TextInput
          style={homeStyles.searchInput}
          placeholder="Search devices..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[homeStyles.scanButton, isScanning && homeStyles.scanningButton]}
          onPress={isScanning ? stop : start}
        >
          {isScanning ? (
            <View style={homeStyles.scanningContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={homeStyles.scanButtonText}>Stop Scan</Text>
            </View>
          ) : (
            <Text style={homeStyles.scanButtonText}>Start Core Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={homeStyles.devicesSection}>
        <Text style={homeStyles.sectionTitle}>Discovered ({filteredDevices.length})</Text>
        {isScanning && filteredDevices.length === 0 ? (
          <View style={homeStyles.scanning}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={homeStyles.scanningText}>Scanning with Core module...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredDevices}
            keyExtractor={(item) => item}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={homeStyles.empty}>
                <Text style={homeStyles.emptyText}>
                  {searchQuery.trim() ? 'No devices match search' : 'No devices found'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default CoreScanScreen;


