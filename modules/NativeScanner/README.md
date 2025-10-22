# NativeScanner & NokeAPI - Módulo BLE Nativo

Módulo nativo de React Native para escaneo BLE y comunicación con candados Noke.

**Nota:** Este módulo solo implementa **Unlock Online**. El candado se cierra automáticamente por firmware.

**Features destacados:**
- ✅ Auto re-login cuando el token expira
- ✅ Logging completo con cURL commands para debugging
- ✅ Manejo robusto de errores de red y API

## 📂 Estructura

```
modules/NativeScanner/
├── android/
│   ├── src/main/java/com/nativescanner/
│   │   ├── NativeScannerModule.kt      # Módulo BLE (Android Bluetooth)
│   │   ├── NativeScannerPackage.kt     # Package registration
│   │   ├── NokeAPIClient.kt            # Cliente HTTP Noke API
│   │   └── NokeAPIClientPackage.kt     # Package registration
│   └── build.gradle                     # Configuración Gradle
├── ios/
│   ├── NativeScanner.swift          # Módulo BLE (CoreBluetooth)
│   ├── NativeScannerModule.m        # Bridge Objective-C
│   ├── NokeAPIClient.swift          # Cliente HTTP Noke API
│   ├── NokeAPIClientModule.m        # Bridge Objective-C
│   └── NokeAPI.js                   # Wrapper JavaScript
└── js/
    └── index.ts                     # TypeScript definitions
```

## 🔧 Componentes

### 1. NativeScanner (BLE Module)

Módulo Swift para comunicación Bluetooth Low Energy.

**Métodos:**

```typescript
// Escanear dispositivos BLE
NativeScanner.startScan(durationSeconds: number): Promise<void>

// Detener escaneo
NativeScanner.stopScan(): Promise<void>

// Conectar a dispositivo
NativeScanner.connect(deviceId: string): Promise<void>

// Desconectar
NativeScanner.disconnect(deviceId: string): Promise<void>

// Enviar comandos al candado
NativeScanner.sendCommands(commandString: string, deviceId: string): Promise<void>
```

**Eventos:**

```typescript
// Dispositivo descubierto
NativeScanner.addListener('DeviceDiscovered', (event) => {
  // event.id, event.name, event.rssi, event.advertising
});

// Dispositivo conectado
NativeScanner.addListener('DeviceConnected', (event) => {
  // event.deviceId
});

// Session data lista (después de conectar)
NativeScanner.addListener('SessionReady', (event) => {
  // event.deviceId, event.sessionData (hex string)
});

// Respuesta de comando
NativeScanner.addListener('CommandResponse', (event) => {
  // event.deviceId, event.response (hex string)
});
```

### 2. NokeAPIClient (HTTP Client)

Cliente HTTP Swift para Noke REST API.

**Métodos:**

```typescript
// Login
NokeAPIClient.login(
  email: string,
  password: string,
  companyUUID: string,
  siteUUID: string,
  deviceId: string
): Promise<LoginResult>

// Get unlock commands
NokeAPIClient.getUnlockCommands(
  mac: string,
  session: string
): Promise<{ commandString: string, commands: string[] }>

// Get all offline keys
NokeAPIClient.getAllOfflineKeys(
  userUUID: string,
  companyUUID: string,
  siteUUID: string
): Promise<OfflineKey[]>
```

### 3. NokeAPI.js (Wrapper)

Singleton wrapper JavaScript que facilita el uso del cliente HTTP.

**Ejemplo de uso:**

```javascript
import NokeAPI from '../modules/NativeScanner/ios/NokeAPI';

// Singleton instance
const api = NokeAPI.getInstance();

// Login
await api.login(email, password, companyUUID, siteUUID, deviceUUID);

// Auto-restore session
await api.restoreSession();

// Get unlock commands (online)
const { commandString } = await api.getUnlockCommands(macAddress, session);

// Send to lock via BLE
await NativeScanner.sendCommands(commandString, deviceId);
```

## 🚀 Uso Rápido

### 1. Escanear y Conectar

```typescript
import NativeScanner from './modules/NativeScanner';

// Escuchar dispositivos
NativeScanner.addListener('DeviceDiscovered', (device) => {
  console.log('Found:', device.name, device.id);
});

// Escuchar session
NativeScanner.addListener('SessionReady', (event) => {
  console.log('Session:', event.sessionData);
  setSession(event.deviceId, event.sessionData);
});

// Iniciar escaneo
await NativeScanner.startScan(10); // 10 segundos

// Conectar
await NativeScanner.connect(deviceId);
```

### 2. Unlock Online

```typescript
import NokeAPI from './modules/NativeScanner/ios/NokeAPI';

// Get MAC from device name
const mac = extractMacFromName(device.name); // "D0:1F:A6:44:B3:6F"

// Get session from BLE
const session = deviceSessions[deviceId]; // "E7030000FA51E3D5..."

// Get unlock command from server
const { commandString } = await NokeAPI.getUnlockCommands(mac, session);

// Send to lock
await NativeScanner.sendCommands(commandString, deviceId);

// The lock will automatically close after a few seconds (firmware timer)
```

## 📋 Filtros de Escaneo

El módulo incluye filtros configurables:

```typescript
// Configuración por defecto
{
  filterNokeOnly: false,           // Filtrar solo dispositivos Noke
  useServiceUUIDFilter: true,      // Filtrar por Service UUID (recomendado)
  rssiThreshold: -89               // RSSI mínimo (-89 dBm)
}
```

**Service UUID de Noke:** `1BC50001-0200-D29E-E511-446C609DB825`

## 🔍 MAC Address en iOS

iOS no permite leer MAC directamente. Solución implementada:

```typescript
// Noke incluye MAC en el nombre del dispositivo
// Formato: NOKE3E_D01FA644B36F
//                 ^^^^^^^^^ MAC sin dos puntos

function extractMac(deviceName: string): string {
  const match = deviceName.match(/NOKE\w+_([0-9A-F]{12})$/i);
  if (!match) return null;
  
  const mac = match[1];
  return mac.match(/.{2}/g).join(':').toUpperCase();
  // Result: "D0:1F:A6:44:B3:6F"
}
```

## 📝 TypeScript Definitions

Ver `js/index.ts` para definiciones completas:

```typescript
interface BleDevice {
  id: string;
  name: string;
  rssi: number;
  advertising?: {
    localName?: string;
    manufacturerData?: string;
    serviceUUIDs?: string[];
  };
}

interface LoginResult {
  success: boolean;
  token: string;
  userData: {
    userUUID: string;
    email: string;
    companyUUID: string;
  };
}
```

## 🐛 Debugging

### Habilitar logs detallados

Los logs están habilitados por defecto:

```
// Swift logs (Xcode Console)
[NativeScanner] ✅ Connected to: NOKE3E_D01FA644B36F
[NokeAPIClient] 📥 Response: 200
[NokeAPIClient] ✅ Unlock commands received: 1 commands

// JavaScript logs (Metro)
[NokeAPI] Getting unlock commands for D0:1F:A6:44:B3:6F...
[NokeAPI] ✅ Unlock commands received (1 commands)
```

### Ver cURL commands

El módulo imprime el cURL exacto de cada request:

```
[NokeAPIClient] 🔧 CURL COMMAND:
─────────────────────────────────────────────────────────
curl -X POST 'https://router.smartentry.noke.dev/lock/unlock/' \
  -H 'Authorization: Bearer eyJ...' \
  -H 'Content-Type: application/json' \
  -d '{"session":"E703...","mac":"D0:1F:A6:44:B3:6F"}'
─────────────────────────────────────────────────────────
```

## ⚠️ Notas Importantes

1. **Dispositivo físico recomendado** - BLE funciona mejor en dispositivos reales

2. **Permisos iOS** (ya configurados en `Info.plist`):
   - `NSBluetoothAlwaysUsageDescription`
   - `NSBluetoothPeripheralUsageDescription`

3. **Permisos Android** (ya configurados en `AndroidManifest.xml`):
   - `BLUETOOTH_SCAN` y `BLUETOOTH_CONNECT` (Android 12+)
   - `ACCESS_FINE_LOCATION` (Android <= 11)

4. **Session debe ser fresca**: Si el candado se reinicia, la session cambia. Reconectar para obtener nueva session.

5. **Internet requerido**: Para unlock online se necesita conexión a internet.

6. **Auto-cierre**: El candado se cierra automáticamente después del unlock (temporizador del firmware).

## 🤖 Diferencias iOS vs Android

| Aspecto | iOS | Android |
|---------|-----|---------|
| **Lenguaje** | Swift | Kotlin |
| **API BLE** | CoreBluetooth | Android Bluetooth API |
| **MAC Address** | Extraída del nombre | Disponible en advertising |
| **Permisos** | Solo Bluetooth | Bluetooth + Location (API ≤ 31) |
| **Threading** | Dispatch Queues | Callbacks en GATT thread |
| **Operation Queue** | Automático | Manual (callbacks estrictos) |
| **Write Characteristic** | RX (`1bc50002`) | RX (`1bc50002`) ✅ |
| **Read Characteristic** | TX (`1bc50003`) | TX (`1bc50003`) ✅ |
| **Sequencing** | Flexible | Estricto (read → notify → write) |
| **Estado** | ✅ Completo | ✅ Completo |

### ⚠️ Aprendizaje Crítico: RX vs TX

**Convención de Noke** (perspectiva del candado):
- **RX** (`1bc50002`) = Donde el lock **RECIBE** → Nosotros **ESCRIBIMOS** comandos
- **TX** (`1bc50003`) = Donde el lock **TRANSMITE** → Nosotros **LEEMOS** respuestas

**Propiedades:**
- RX: `WRITE` + `WRITE_NO_RESPONSE` (permite escritura)
- TX: `NOTIFY` + `READ` (solo lectura/notificaciones)

Ver [`IOS_VS_ANDROID_BLE.md`](../../IOS_VS_ANDROID_BLE.md) y [`ANDROID_BLE_SOLUTION.md`](../../ANDROID_BLE_SOLUTION.md) para detalles técnicos completos.

## 📚 Documentación Completa

Ver: [`NOKE_ONLINE_UNLOCK.md`](../../NOKE_ONLINE_UNLOCK.md)

## 🔗 Enlaces

- **Noke API Docs**: https://router.smartentry.noke.dev
- **Portal Web**: https://manage.noke.com
- **CoreBluetooth**: https://developer.apple.com/documentation/corebluetooth

---

**Versión:** 1.0.0  
**Branch:** feature/lock-unlock  
**Última actualización:** Octubre 2024
