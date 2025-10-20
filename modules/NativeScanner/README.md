# NativeScanner - React Native BLE Module for Noke Devices

Módulo nativo para escaneo, conexión y control de dispositivos Noke vía Bluetooth Low Energy.

---

## ✨ Características

### ✅ Escaneo BLE Optimizado
- Filtro de Service UUID (elimina 99% de dispositivos no-Noke)
- Filtro RSSI por distancia
- Extracción de MAC address
- Detección automática de dispositivos Noke

### ✅ Conexión a Dispositivos
- Conectar/desconectar devices
- Tracking de estados de conexión
- Manejo de errores

### 🔜 Próximamente (Paso 2)
- Unlock offline
- Unlock online
- Comandos de lock/unlock

---

## 🎯 Configuración Óptima (Defaults)

```typescript
{
  useServiceUUIDFilter: true,   // ✅ Filtro crítico (nivel iOS)
  rssiThreshold: -89,            // ✅ Solo devices cercanos
  filterNokeOnly: false          // ❌ Redundante (desactivado)
}
```

**Resultado**: Solo verás **2-5 dispositivos Noke cercanos** (vs 100+ BLE devices)

---

## 🚀 Instalación

```bash
# 1. Instalar dependencias
cd ios && pod install

# 2. Rebuild app
npm run ios
```

**Dependencia requerida**: NokeMobileLibrary (ya en Podfile)

---

## 📱 Uso Rápido

```typescript
import NativeScanner from 'native-scanner';

// 1. Escanear (10 segundos)
await NativeScanner.startScan(10);

// 2. Escuchar dispositivos descubiertos
NativeScanner.onDeviceDiscovered((device) => {
  console.log('Noke found:', device.name, device.rssi);
});

// 3. Conectar a un dispositivo
await NativeScanner.connect(device.id);

// 4. Escuchar conexión exitosa
NativeScanner.onDeviceConnected((device) => {
  console.log('Connected to:', device.name);
});

// 5. Desconectar
await NativeScanner.disconnect(device.id);
```

---

## 📚 Documentación

- **STEP1_CONNECTION_GUIDE.md** - Guía paso a paso con ejemplos completos
- **USAGE_EXAMPLES.md** - 7 ejemplos de uso
- **SERVICE_UUID_FILTER.md** - Explicación del filtro crítico
- **FILTER_OPTIMIZATION.md** - Análisis de optimización
- **CHANGELOG.md** - Historial de cambios

---

## 🎯 Filtros Implementados

### 1️⃣ Service UUID Filter (CRÍTICO)
```
UUID: 1bc50001-0200-d29e-e511-446c609db825
```
- Filtro a nivel de iOS (Core Bluetooth)
- Elimina 99% de dispositivos BLE
- Solo permite devices con Service UUID de Noke

### 2️⃣ RSSI Threshold
```
Default: -89 dBm
```
- Filtra por distancia/señal
- Configurable en runtime
- Elimina locks muy lejanos

### 3️⃣ Noke Name Filter (Opcional)
```
Default: Desactivado
```
- Redundante con Service UUID
- Disponible para debug mode
- Validación por nombre + manufacturer data

---

## 🔧 API Reference

### Scanning
```typescript
await NativeScanner.startScan(durationSeconds: number)
await NativeScanner.stopScan()
await NativeScanner.isScanning(): Promise<boolean>
```

### Connection
```typescript
await NativeScanner.connect(deviceId: string)
await NativeScanner.disconnect(deviceId: string)
await NativeScanner.getConnectionState(deviceId: string): Promise<string>
```

### Filters
```typescript
await NativeScanner.setRSSIThreshold(threshold: number)
await NativeScanner.setServiceUUIDFilter(enabled: boolean)
await NativeScanner.setFilterNokeOnly(enabled: boolean)
await NativeScanner.getFilterSettings(): Promise<FilterSettings>
```

### Events
```typescript
NativeScanner.onDeviceDiscovered(callback)
NativeScanner.onDeviceConnected(callback)
NativeScanner.onDeviceDisconnected(callback)
NativeScanner.onDeviceConnectionError(callback)
NativeScanner.onScanStopped(callback)
NativeScanner.onBluetoothStateChanged(callback)
```

---

## 📊 Performance

| Configuración | Devices/10s | CPU | Batería |
|---------------|-------------|-----|---------|
| Sin filtros | 100+ | 🔴 Alto | 🔴 Alto |
| Solo Service UUID | 50 | 🟡 Medio | 🟡 Medio |
| **Service UUID + RSSI** ⭐ | **5-10** | **🟢 Bajo** | **🟢 Bajo** |

---

## 🐛 Troubleshooting

### No encuentro dispositivos
```typescript
// Verificar configuración
const settings = await NativeScanner.getFilterSettings();
console.log(settings);

// Si useServiceUUIDFilter = false, tus locks deben anunciar Service UUID
// Si RSSI muy alto, locks pueden estar muy lejos
```

### Veo demasiados dispositivos
```typescript
// Activar Service UUID filter
await NativeScanner.setServiceUUIDFilter(true);
```

---

## 📖 Version

**Current**: v1.2.1  
**Status**: ✅ Production Ready (Paso 1 completo)

---

## 🔜 Roadmap

- [x] Escaneo BLE con filtros
- [x] Conexión/desconexión
- [ ] Unlock offline (Paso 2)
- [ ] Unlock online (Paso 3)
- [ ] Lock device (Paso 4)
- [ ] Inactivity timer
- [ ] User locks cache

---

## 📄 License

Copyright © 2025 Noke Inc.

---

## 👨‍💻 Author

Ricardo Padilla - Storage Smart Entry iOS Team
