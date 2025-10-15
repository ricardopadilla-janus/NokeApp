import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  scanSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningButton: {
    backgroundColor: '#FF6B6B',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devicesSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  devicesList: {
    flex: 1,
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
    marginBottom: 5,
  },
  deviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceRSSI: {
    fontSize: 12,
    color: '#666',
    marginRight: 10,
  },
  signalIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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
    minWidth: 80,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scanningPlaceholder: {
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
  emptyState: {
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
});

export function getSignalStrength(rssi: number) {
  if (rssi > -50) return { text: 'Excellent', color: '#4CAF50' };
  if (rssi > -70) return { text: 'Good', color: '#8BC34A' };
  if (rssi > -85) return { text: 'Fair', color: '#FF9800' };
  return { text: 'Weak', color: '#F44336' };
}


