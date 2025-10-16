import React from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { BLEDevice } from '../hooks/useBleMock';
import { styles } from '../styles';
import { DeviceListItem } from './DeviceListItem';

interface Props {
  devices: BLEDevice[];
  isScanning: boolean;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export const DeviceList: React.FC<Props> = ({ devices, isScanning, onConnect, onDisconnect }) => {
  if (isScanning && devices.length === 0) {
    return (
      <View style={styles.scanningPlaceholder}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.scanningText}>Scanning for devices...</Text>
      </View>
    );
  }

  if (!isScanning && !devices.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No devices found</Text>
        <Text style={styles.emptySubtext}>Tap "Start Scan" to search for devices</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={devices}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <DeviceListItem
          device={item}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
      )}
      style={styles.devicesList}
      showsVerticalScrollIndicator={false}
    />
  );
};


