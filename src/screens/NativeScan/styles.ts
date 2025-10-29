import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  stateText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  filterSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  filterHeaderLeft: {
    flex: 1,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  filterSummary: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  filterStatus: {
    fontSize: 11,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 10,
  },
  filterContent: {
    marginTop: 12,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterInfo: {
    flex: 1,
    marginRight: 10,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
  },
  filterDesc: {
    fontSize: 12,
    color: '#666',
  },
  rssiButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rssiButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rssiButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  rssiButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devicesList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  count: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statsInfo: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  deviceId: {
    fontSize: 11,
    color: '#999',
    marginBottom: 3,
  },
  compactDataSection: {
    marginTop: 6,
    marginBottom: 6,
    paddingLeft: 4,
  },
  compactDataLine: {
    fontSize: 11,
    color: '#555',
    lineHeight: 16,
    marginBottom: 1,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#666',
  },
  scanning: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanningText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  deviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  signalIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  signalText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectButton: {
    backgroundColor: '#FF6B6B',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Unlock Controls in Device Item
  unlockStatusContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  unlockStatusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  unlockSuccess: {
    color: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  unlockFailed: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  unlockButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockingButton: {
    backgroundColor: '#FF9800',
    opacity: 0.7,
  },
  unlockButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  onlineUnlockButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineUnlockButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineKeysCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statusBadge: {
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  primaryButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  secondaryButtonText: {
    color: '#495057',
    fontSize: 12,
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#e9ecef',
    shadowOpacity: 0,
    elevation: 0,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    backgroundColor: '#f8d7da',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
});

/**
 * Get signal strength classification based on RSSI
 * Same logic as Home screen for consistency
 */
export function getSignalStrength(rssi: number): { text: string; color: string } {
  if (rssi > -50) return { text: 'Excellent', color: '#4CAF50' }; // Green
  if (rssi > -70) return { text: 'Good', color: '#8BC34A' };      // Light green
  if (rssi > -85) return { text: 'Fair', color: '#FF9800' };      // Orange
  return { text: 'Weak', color: '#F44336' };                      // Red
}

