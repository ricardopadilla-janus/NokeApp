import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ActivityIndicator, TextInput, FlatList, Alert } from 'react-native';
import { styles as homeStyles } from '../NativeScan/styles';
import { startScan as coreStartScan, stopScan as coreStopScan, getDiscoveredDevices as coreGetDiscovered, connect as coreConnect, getSession as coreGetSession, sendCommands as coreSendCommands } from '@noke-inc/react-native-core';
import { useNokeAPI } from '../../hooks/useNokeAPI';
import { NOKE_CREDENTIALS } from '../../config/nokeCredentials';

export const CoreScanScreen: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceUUID, setServiceUUID] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [deviceSessions, setDeviceSessions] = useState<Record<string, string>>({});
  const [unlockStatus, setUnlockStatus] = useState<Record<string, string>>({});

  const { isLoggedIn, login: loginToAPI, logout, getUnlockCommands } = useNokeAPI();
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      try { coreStopScan(); } catch {}
    };
  }, []);

  const start = async () => {
    try {
      setDevices([]);
      setIsScanning(true);
      // Library expects an array of service UUIDs (or none)
      if (serviceUUID.trim()) {
        await coreStartScan([serviceUUID.trim()]);
      } else {
        await coreStartScan();
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const list = await coreGetDiscovered();
          setDevices(Array.isArray(list) ? list : []);
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

  const getDisplay = (item: any): { label: string; uuid: string } => {
    if (typeof item === 'string') return { label: item, uuid: item };
    const uuid = item?.uuid || item?.id || '';
    const name = item?.name || uuid || 'Unknown';
    return { label: name + (uuid ? `\n${uuid}` : ''), uuid };
  };

  const getMacAddress = (item: any): string | null => {
    const mac = item?.advertising?.macAddress;
    if (mac && typeof mac === 'string') return mac;
    const name: string = item?.name || '';
    const match = name.match(/([A-F0-9]{12})$/i);
    if (match) {
      const macNoColons = match[1];
      const withColons = macNoColons.match(/.{1,2}/g)?.join(':').toUpperCase();
      return withColons || null;
    }
    return null;
  };

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter((d) => {
      const { label, uuid } = getDisplay(d);
      return label.toLowerCase().includes(q) || uuid.toLowerCase().includes(q);
    });
  }, [devices, searchQuery]);

  const renderItem = ({ item }: { item: any }) => {
    const { label, uuid } = getDisplay(item);
    return (
    <View style={homeStyles.deviceItem}>
      <View style={homeStyles.deviceInfo}>
        <Text style={homeStyles.deviceName}>{label}</Text>
      </View>
      <TouchableOpacity
        style={[homeStyles.connectButton, connected[uuid] && homeStyles.disconnectButton]}
        disabled={connectingId === uuid}
        onPress={async () => {
          try {
            console.log('[CoreScan] Connecting to', uuid);
            if (!uuid) throw new Error('No UUID available for this device');
            setConnectingId(uuid);
            await coreConnect(uuid);
            setConnected(prev => ({ ...prev, [uuid]: true }));
            console.log('[CoreScan] Connected to', uuid);
            // Fetch session after connect
            try {
              const session = await coreGetSession(uuid);
              if (session) setDeviceSessions(prev => ({ ...prev, [uuid]: session }));
            } catch {}
          } catch (e) {
            console.error('[CoreScan] Connect failed', e);
            Alert.alert('Connect failed', String((e as any)?.message || e));
          } finally {
            setConnectingId(null);
          }
        }}
      >
        {connectingId === uuid ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={homeStyles.connectButtonText}>
            {connected[uuid] ? 'Connected' : 'Connect'}
          </Text>
        )}
      </TouchableOpacity>
      {connected[uuid] && (
        <TouchableOpacity
          style={[homeStyles.unlockButton]}
          onPress={async () => {
            try {
              // Ensure login
              if (!isLoggedIn) {
                await loginToAPI({
                  email: NOKE_CREDENTIALS.email,
                  password: NOKE_CREDENTIALS.password,
                  companyUUID: NOKE_CREDENTIALS.companyUUID,
                  siteUUID: NOKE_CREDENTIALS.siteUUID,
                  deviceId: NOKE_CREDENTIALS.deviceId,
                });
              }
              setUnlockStatus(prev => ({ ...prev, [uuid]: '🔓 Unlocking...' }));
              const session = deviceSessions[uuid] || (await coreGetSession(uuid));
              if (!session) throw new Error('No session available');
              const mac = getMacAddress(item);
              if (!mac) throw new Error('No MAC address available');
              const doUnlock = async () => {
                const unlockData = await getUnlockCommands(mac, session);
                await coreSendCommands(unlockData.commandString, uuid);
              };
              try {
                await doUnlock();
                setUnlockStatus(prev => ({ ...prev, [uuid]: '🎉 Unlock Success' }));
              } catch (e: any) {
                const msg = String(e?.message || e || '').toLowerCase();
                if (msg.includes('token')) {
                  // Refresh token and retry once
                  try {
                    await logout();
                  } catch {}
                  await loginToAPI({
                    email: NOKE_CREDENTIALS.email,
                    password: NOKE_CREDENTIALS.password,
                    companyUUID: NOKE_CREDENTIALS.companyUUID,
                    siteUUID: NOKE_CREDENTIALS.siteUUID,
                    deviceId: NOKE_CREDENTIALS.deviceId,
                  });
                  await doUnlock();
                  setUnlockStatus(prev => ({ ...prev, [uuid]: '🎉 Unlock Success' }));
                } else {
                  throw e;
                }
              }
            } catch (err: any) {
              setUnlockStatus(prev => ({ ...prev, [uuid]: `❌ ${err?.message || err}` }));
            }
          }}
        >
          <Text style={homeStyles.unlockButtonText}>{unlockStatus[uuid] || 'Unlock'}</Text>
        </TouchableOpacity>
      )}
    </View>
  ); };

  return (
    <SafeAreaView style={homeStyles.container}>
      <View style={homeStyles.controls}>
        <TextInput
          style={homeStyles.searchInput}
          placeholder="Search devices..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        <TextInput
          style={homeStyles.searchInput}
          placeholder="Service UUID filter (optional)"
          value={serviceUUID}
          onChangeText={setServiceUUID}
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[homeStyles.scanButton, isScanning && homeStyles.scanningButton]}
          onPress={isScanning ? stop : start}
        >
          {isScanning ? (
            <View style={homeStyles.scanningContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={homeStyles.buttonText}>Stop Scan</Text>
            </View>
          ) : (
            <Text style={homeStyles.buttonText}>Start Core Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={homeStyles.devicesList}>
        <Text style={homeStyles.count}>Discovered ({filteredDevices.length})</Text>
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


