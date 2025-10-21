# Noke Online Unlock - Documentación Completa

**Branch:** `feature/lock-unlock`  
**Fecha:** Octubre 2024  
**Autor:** Ricardo Padilla  

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Implementados](#componentes-implementados)
4. [Flujo de Unlock](#flujo-de-unlock)
5. [Guía de Uso](#guía-de-uso)
6. [Configuración de Credenciales](#configuración-de-credenciales)
7. [Build e Instalación](#build-e-instalación)
8. [Debugging y Logs](#debugging-y-logs)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Resumen Ejecutivo

Esta rama implementa el **sistema completo de Unlock Online** para candados Noke mediante BLE (Bluetooth Low Energy) y la API REST de Noke. El sistema permite:

- ✅ **Escaneo de dispositivos BLE** Noke (NOKE3E, NOKE3K, NOKE4E, NOKE4K)
- ✅ **Conexión BLE** con lectura de características (Session, TX, RX)
- ✅ **Auto-login al entrar al tab** (no al inicio de la app)
- ✅ **Auto re-login** cuando el token expira (sin intervención del usuario)
- ✅ **Obtención de comandos** de unlock desde el servidor en tiempo real
- ✅ **Ejecución de comandos** enviados al candado vía BLE
- ✅ **Feedback visual** en tiempo real (estados, logs, MAC, session)
- ✅ **Extracción de MAC** desde nombre del dispositivo (workaround iOS)
- ✅ **Manejo robusto de errores** con recuperación automática

**Importante:**
- El login se ejecuta **al entrar al tab NativeScan**, no al inicio de la app
- Si el token expira, la app **automáticamente hace re-login** sin pedir al usuario que reinicie
- El candado se cierra automáticamente después del unlock (temporizador del firmware)
- No existe comando de "Lock" en la API de Noke
- Esta implementación es **solo Online Unlock** (requiere internet)

### Tecnologías

- **React Native** 0.76.6
- **Swift** (módulos nativos iOS)
- **CoreBluetooth** (BLE en iOS)
- **Noke API REST** (https://router.smartentry.noke.dev)

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native (JavaScript)                 │
│                                                              │
│  ┌────────────────┐         ┌──────────────────┐            │
│  │ NativeScanScreen│────────▶│    NokeAPI.js    │            │
│  │   (UI Layer)   │         │  (API Wrapper)   │            │
│  └────────┬───────┘         └────────┬─────────┘            │
│           │                          │                       │
│           ▼                          ▼                       │
│  ┌────────────────┐         ┌──────────────────┐            │
│  │ NativeScanner  │         │ NokeAPIClient    │            │
│  │  (BLE Module)  │         │  (HTTP Client)   │            │
│  └────────┬───────┘         └────────┬─────────┘            │
└───────────┼────────────────────────────┼────────────────────┘
            │                            │
            │                            │
   ┌────────▼────────┐          ┌───────▼──────────┐
   │  CoreBluetooth  │          │   Noke API REST  │
   │   (iOS BLE)     │          │   (HTTPS Server) │
   └────────┬────────┘          └───────┬──────────┘
            │                           │
            ▼                           │
   ┌─────────────────┐                 │
   │  Noke Lock (BLE)│◀────────────────┘
   │  • Session      │   (Comando encriptado)
   │  • TX/RX chars  │
   └─────────────────┘
```

### Capas de la Arquitectura

1. **UI Layer** (`NativeScanScreen.tsx`)
   - Interfaz de usuario
   - Manejo de estado (scanning, connecting, unlocking)
   - Visualización de dispositivos y feedback

2. **API Layer** (`NokeAPI.js`)
   - Wrapper JavaScript para comunicación con API
   - Manejo de login y autenticación
   - Obtención de comandos de unlock

3. **Native Layer** (Swift)
   - `NativeScanner.swift`: Módulo BLE
   - `NokeAPIClient.swift`: Cliente HTTP nativo
   - Comunicación directa con CoreBluetooth

4. **Backend** (Noke API)
   - Servidor REST de Noke
   - Generación de comandos encriptados
   - Validación de permisos

---

## 🔧 Componentes Implementados

### 1. NokeAPIClient.swift

**Ubicación:** `modules/NativeScanner/ios/NokeAPIClient.swift`

Cliente HTTP nativo en Swift para comunicación con Noke API.

**Métodos principales:**

```swift
// Autenticación
@objc func login(email, password, companyUUID, siteUUID, deviceId, ...)

// Obtener comandos de Unlock
@objc func getUnlockCommands(mac, session, ...)

// Obtener offline keys (futuro)
@objc func getAllOfflineKeys(userUUID, companyUUID, siteUUID, ...)
```

**Features:**
- ✅ Logging detallado con cURL commands
- ✅ Manejo de errores robusto
- ✅ Parse flexible de respuestas JSON
- ✅ Gestión automática de auth tokens

**Ejemplo de log:**

```
[NokeAPIClient] 🔧 CURL COMMAND:
─────────────────────────────────────────────────────────
curl -X POST 'https://router.smartentry.noke.dev/lock/unlock/' \
  -H 'Authorization: Bearer eyJhbGciOiJOT0t...' \
  -H 'Content-Type: application/json' \
  -d '{"session":"E7030000FA51E3D5...","mac":"D0:1F:A6:44:B3:6F"}'
─────────────────────────────────────────────────────────
```

### 2. NokeAPI.js

**Ubicación:** `modules/NativeScanner/ios/NokeAPI.js`

Wrapper JavaScript que expone funcionalidad del cliente Swift a React Native.

**Métodos principales:**

```javascript
// Singleton instance
const NokeAPI = NokeAPIManager.getInstance();

// Login
await NokeAPI.login(email, password, companyUUID, siteUUID, deviceUUID);

// Restore session (auto-login)
await NokeAPI.restoreSession();

// Get unlock commands
const result = await NokeAPI.getUnlockCommands(macAddress, session);
// Returns: { commandString: "0000c200...", commands: ["0000c200..."] }
```

**Features:**
- ✅ Singleton pattern para una sola instancia
- ✅ Auto-restauración de sesión al inicio
- ✅ Auto re-login cuando el token expira
- ✅ Caché de userData en AsyncStorage
- ✅ Logging detallado en consola
- ✅ Manejo de errores con recuperación automática

### 3. NativeScanner.swift

**Ubicación:** `modules/NativeScanner/ios/NativeScanner.swift`

Módulo nativo para escaneo y conexión BLE con candados Noke.

**Funcionalidades:**

```swift
// Escaneo de dispositivos
@objc func startScan(duration, ...)

// Conexión a dispositivo
@objc func connect(deviceId, ...)

// Envío de comandos
@objc func sendCommands(commandString, deviceId, ...)

// Desconexión
@objc func disconnect(deviceId, ...)
```

**Características BLE:**
- ✅ Filtrado por Service UUID (elimina no-Noke)
- ✅ Filtrado por RSSI (señal débil)
- ✅ Lectura automática de Session characteristic
- ✅ Escritura/lectura de comandos via TX/RX
- ✅ Eventos: `DeviceDiscovered`, `DeviceConnected`, `SessionReady`, `CommandResponse`

### 4. NativeScanScreen.tsx

**Ubicación:** `src/screens/NativeScan/NativeScanScreen.tsx`

Interfaz principal de la aplicación.

**Features implementados:**

- ✅ Lista de dispositivos con filtros (RSSI, nombre, MAC)
- ✅ Indicadores de señal (Excellent, Good, Fair, Poor)
- ✅ Botones Connect/Disconnect
- ✅ Botón Unlock (con loading state)
- ✅ Visualización de MAC address
- ✅ Visualización de Session data
- ✅ Estados de conexión en tiempo real
- ✅ Auto-reset de botones (timeout 5s)

**Estados de UI:**

```typescript
const [devices, setDevices] = useState<BleDevice[]>([]);
const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
const [deviceSessions, setDeviceSessions] = useState<Record<string, string>>({});
const [deviceMacAddresses, setDeviceMacAddresses] = useState<Record<string, string>>({});
const [isUnlocking, setIsUnlocking] = useState<Record<string, boolean>>({});
const [unlockStatus, setUnlockStatus] = useState<Record<string, string>>({});
```

### 5. nokeCredentials.ts

**Ubicación:** `src/config/nokeCredentials.ts`

Archivo de configuración con credenciales de Noke API.

```typescript
export const nokeCredentials = {
  email: 'ricardo.padilla@janusintl.com',
  password: 'Dr@keNoKe',
  companyUUID: '-1',
  siteUUID: '2223372',
  deviceUUID: 'cmgzk8wp300013b6xm7vnz8mb',
};
```

**⚠️ Importante:** Este archivo está en `.gitignore` para no exponer credenciales.

---

## 🔄 Flujo de Unlock

### Flujo Completo de Unlock Online

```
1. [UI] Usuario presiona "Scan"
   └──▶ NativeScanner.startScan()
        └──▶ CoreBluetooth escanea dispositivos BLE
             └──▶ Filtra por Service UUID Noke
                  └──▶ Evento: DeviceDiscovered
                       └──▶ [UI] Muestra dispositivo en lista

2. [UI] Usuario presiona "Connect" en un dispositivo
   └──▶ NativeScanner.connect(deviceId)
        └──▶ CoreBluetooth conecta al dispositivo
             └──▶ Descubre servicios
                  └──▶ Descubre características (TX, RX, Session)
                       └──▶ Lee Session characteristic
                            └──▶ Evento: SessionReady(sessionData)
                                 └──▶ [UI] Muestra "🔑 Session ready"

3. [UI] Usuario presiona "Unlock"
   └──▶ Extrae MAC del nombre del dispositivo
        └──▶ NokeAPI.getUnlockCommands(mac, session)
             └──▶ NokeAPIClient.getUnlockCommands()
                  └──▶ POST https://router.smartentry.noke.dev/lock/unlock/
                       Body: { "mac": "D0:1F:A6:44:B3:6F", "session": "E7030000..." }
                       └──▶ Servidor valida permisos
                            └──▶ Genera comando encriptado
                                 └──▶ Response: { "commands": ["0000c200..."] }

4. [JS] Recibe comando del servidor
   └──▶ NativeScanner.sendCommands(commandString, deviceId)
        └──▶ Escribe comando a TX characteristic
             └──▶ Candado recibe y valida comando
                  └──▶ Candado responde vía RX characteristic
                       └──▶ Evento: CommandResponse
                            └──▶ [UI] Muestra "✅ Unlocked successfully"
                                 └──▶ Candado se abre 🔓
```

### Componentes de Seguridad

1. **Session Data (del candado)**
   - Valor único de 20 bytes (hex)
   - Cambia cada vez que el candado se reinicia
   - Ejemplo: `E7030000FA51E3D524651DB6A965985B3FA6CE81`

2. **MAC Address (del candado)**
   - Dirección física del Bluetooth del dispositivo
   - Formato: `D0:1F:A6:44:B3:6F`
   - En iOS se extrae del nombre: `NOKE3E_D01FA644B36F` → `D0:1F:A6:44:B3:6F`

3. **Comando Encriptado (del servidor)**
   - Generado por Noke API basado en:
     - MAC del dispositivo
     - Session actual
     - Permisos del usuario
     - Firma criptográfica
   - Ejemplo: `0000c20081e628151d34af9c8878e4efbb84311d`

4. **Auth Token (del servidor)**
   - JWT generado en login
   - Válido por tiempo limitado
   - Se envía en header `Authorization: Bearer <token>`

---

## 📱 Guía de Uso

### Inicio de la Aplicación

1. **Abrir la app** en dispositivo iOS físico
2. **Permitir Bluetooth** cuando se solicite
3. **Ir al tab "Native"** (NativeScan)
4. El login se ejecuta automáticamente al entrar al tab
5. Si ya existe sesión guardada, se restaura automáticamente

### Escaneo de Candados

1. Presionar **"Start Scan"**
2. Esperar 10 segundos (o presionar "Stop Scan")
3. Ver lista de dispositivos detectados con:
   - Nombre (ej: `NOKE3E_D01FA644B36F`)
   - MAC address (ej: `D0:1F:A6:44:B3:6F`)
   - RSSI signal strength (ej: `-45 dBm [Excellent]`)

### Conexión a un Candado

1. Presionar **"Connect"** en el dispositivo deseado
2. Esperar conexión (1-3 segundos)
3. Cuando aparezca **"🔑 Session ready"** → el candado está listo

### Desbloquear (Unlock)

1. Asegurar que el dispositivo está conectado
2. Presionar **"🔓 Unlock"**
3. Ver progreso:
   - `🔓 Unlocking...`
   - `📡 Getting unlock commands...`
   - `🔐 Sending unlock...`
   - `⏳ Waiting for response...`
   - `✅ Unlocked successfully` ← Candado abierto

**Si el token expiró:**
- La app detecta automáticamente el error
- Muestra: `🔄 Re-logging in...`
- Hace login fresco con tus credenciales
- Muestra: `✅ Re-logged in. Please try unlock again`
- Presionar Unlock de nuevo → ✅ Funciona

**Nota:** El candado se cierra automáticamente después de un tiempo (función del firmware del candado). No hay comando de "Lock" en la API.

### Desconexión

1. Presionar **"Disconnect"**
2. El dispositivo vuelve al estado "Not connected"

---

## 🔑 Configuración de Credenciales

### Archivo: `src/config/nokeCredentials.ts`

```typescript
export const nokeCredentials = {
  // Email registrado en el sistema Noke
  email: 'tu-email@ejemplo.com',
  
  // Contraseña del usuario
  password: 'TuContraseña123',
  
  // UUID de la compañía (usar "-1" si no tienes)
  companyUUID: '-1',
  
  // UUID del sitio (location/facility)
  siteUUID: '2223372',
  
  // UUID único del dispositivo móvil
  deviceUUID: 'cmgzk8wp300013b6xm7vnz8mb',
};
```

### Obtener Credenciales

Las credenciales se obtienen del **Portal Web de Noke** (https://manage.noke.com):
- **email/password**: Tu cuenta de usuario
- **siteUUID**: ID de tu sitio/locación
- **deviceUUID**: Generado al registrar la app móvil

### Seguridad

⚠️ **El archivo `nokeCredentials.ts` está en `.gitignore`** para evitar exponer credenciales en Git.

---

## 🏗️ Build e Instalación

### Pre-requisitos

- **Xcode** 15+ instalado
- **CocoaPods** instalado (`sudo gem install cocoapods`)
- **Node.js** 18+ y npm
- **Dispositivo iOS físico** (BLE no funciona bien en simulador)

### Instalación de Dependencias

```bash
cd /Users/ricardo.padilla/Documents/Noke/NokeApp

# Instalar dependencias de Node
npm install

# Instalar pods de iOS
cd ios && pod install && cd ..
```

### Build y Deploy en iPhone

```bash
# Opción 1: Desde terminal
npm run ios

# Opción 2: Build manual con Xcode
cd ios
xcodebuild -workspace NokeApp.xcworkspace \
  -scheme NokeApp \
  -configuration Debug \
  -destination "id=00008130-00023D5C2643001C" \
  build install
```

### Troubleshooting de Build

#### Error: "Unable to attach DB: database is locked"

```bash
# Limpiar build cache
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/NokeApp-*

# Reintentar build
npm run ios
```

#### Error: "CocoaPods encoding"

```bash
# Agregar en ~/.zshrc o ~/.bash_profile
export LANG=en_US.UTF-8

# Recargar terminal
source ~/.zshrc

# Reinstalar pods
cd ios && pod install && cd ..
```

---

## 🐛 Debugging y Logs

### Ver Logs en Tiempo Real

Los logs se muestran en la **consola de Metro** y en **Xcode Console**.

#### Logs de JavaScript

```javascript
// Login
[NokeAPI] Logging in as: ricardo.padilla@janusintl.com
[NokeAPI] ✅ Login successful
[NokeAPI] User: ricardo.padilla@janusintl.com

// Session restoration
[NativeScan] Initializing Noke session...
[NokeAPI] ✅ Session restored: ricardo.padilla@janusintl.com

// Device discovery
[NativeScan] Device discovered: NOKE3E_D01FA644B36F
[NativeScan] MAC stored: D0:1F:A6:44:B3:6F for 6C2735B7...

// Session ready
[NativeScan] 🔑 Session ready for device: 6C2735B7...
[NativeScan]    Session: E7030000FA51E3D524651DB6A965985B3FA6CE81

// Unlock
[NativeScan] Starting unlock for device: 6C2735B7...
[NokeAPI] Getting unlock commands for D0:1F:A6:44:B3:6F...
[NokeAPI] ✅ Unlock commands received (1 commands)
[NativeScan] Unlock command sent, waiting for response...
```

#### Logs de Swift (Native)

```
// API Client
[NokeAPIClient] 🔧 CURL COMMAND:
curl -X POST 'https://router.smartentry.noke.dev/lock/unlock/' \
  -H 'Authorization: Bearer eyJ...' \
  -d '{"session":"E7030000...","mac":"D0:1F:A6:44:B3:6F"}'

[NokeAPIClient] 📥 Response: 200
[NokeAPIClient] ✅ Unlock commands received: 1 commands

// BLE Scanner
[NativeScanner] ✅ Connected to: NOKE3E_D01FA644B36F
[NativeScanner] ✓ RX Characteristic found (Read/Notify)
[NativeScanner] ✓ TX Characteristic found (Write)
[NativeScanner] ✓ Session Characteristic found
[NativeScanner] Session data received (20 bytes)
[NativeScanner] 📤 Writing command: 0000C20081E628...
[NativeScanner] 📨 Response from lock: 5060000...
[NativeScanner] Response type: 0x50
```

### Niveles de Log

| Nivel | Símbolo | Descripción |
|-------|---------|-------------|
| Info | `ℹ️` | Información general |
| Success | `✅` | Operación exitosa |
| Error | `❌` | Error crítico |
| Warning | `⚠️` | Advertencia |
| Debug | `🔧` | Información de debug (cURL, etc) |
| Network | `📡` | Petición HTTP |
| Response | `📥` | Respuesta HTTP |
| BLE Write | `📤` | Escritura BLE |
| BLE Read | `📨` | Lectura BLE |

---

## 🔧 Troubleshooting

### Problema: No se detectan dispositivos

**Posibles causas:**

1. **Bluetooth desactivado**
   - Verificar: Settings → Bluetooth → ON

2. **Permisos no otorgados**
   - Verificar: Settings → NokeApp → Bluetooth → ✓

3. **Candados fuera de rango**
   - Acercarse al candado (< 10 metros)
   - RSSI debe ser > -89 dBm

4. **Filtro de Service UUID muy restrictivo**
   ```typescript
   // Temporalmente desactivar filtro
   useServiceUUIDFilter: false
   ```

### Problema: Conexión falla

**Posibles causas:**

1. **Dispositivo ya conectado a otra app**
   - Cerrar otras apps BLE
   - Reiniciar Bluetooth

2. **Session expiró**
   - Desconectar y reconectar
   - El candado genera nueva session

3. **Batería baja del candado**
   - Reemplazar batería

### Problema: Unlock no funciona

**Posibles causas:**

1. **No hay session disponible**
   - Mensaje: `No session available`
   - Solución: Desconectar y reconectar para leer session

2. **MAC address incorrecta**
   - Verificar que el nombre del dispositivo contiene MAC
   - Formato: `NOKE3E_D01FA644B36F` (últimos 12 chars)

3. **Sin permisos en el servidor**
   - Verificar que tu usuario tiene acceso al candado en el portal Noke
   - Mensaje: `Access denied` o `Unauthorized`

4. **Session desactualizada**
   - El candado se reinició después de leer la session
   - Solución: Desconectar y reconectar

### Problema: "Token error" o "Session expired"

**Causa:** El auth token expiró (tokens de Noke tienen tiempo de vida limitado)

**Solución Automática:**
1. La app detecta el error automáticamente
2. Hace **re-login fresco** con tus credenciales
3. Muestra: `✅ Re-logged in. Please try unlock again`
4. Presionar Unlock de nuevo → Funciona

**No requiere reiniciar la app** - todo es automático.

### Problema: "Not logged in"

**Causa:** No hay auth token válido (primera vez o después de limpiar caché)

**Solución:**
1. Salir y volver a entrar al tab "Native" (trigger auto-login)
2. Verificar credenciales en `nokeCredentials.ts`
3. Verificar conexión a internet

### Problema: Build falla

**Error común:** `'NSLog' is unavailable: Variadic function is unavailable`

**Solución:** Ya está solucionado en el código (se usa `print` en vez de `NSLog`)

**Error común:** `Build database locked`

**Solución:**
```bash
killall Xcode
rm -rf ~/Library/Developer/Xcode/DerivedData/NokeApp-*
```

---

## 📊 Endpoints de Noke API

### Base URL

```
https://router.smartentry.noke.dev
```

### Autenticación

#### POST `/user/login/`

**Request:**
```json
{
  "email": "ricardo.padilla@janusintl.com",
  "password": "Dr@keNoKe",
  "deviceId": "cmgzk8wp300013b6xm7vnz8mb",
  "companyUUID": "-1",
  "siteUUID": "2223372"
}
```

**Response:**
```json
{
  "result": "success",
  "token": "eyJhbGciOiJOT0tFIi...",
  "data": {
    "user": {
      "userUUID": "1034838",
      "email": "ricardo.padilla@janusintl.com",
      "companyUUID": "1000239"
    }
  }
}
```

### Unlock

#### POST `/lock/unlock/`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "mac": "D0:1F:A6:44:B3:6F",
  "session": "E7030000FA51E3D524651DB6A965985B3FA6CE81"
}
```

**Response:**
```json
{
  "result": "success",
  "data": {
    "commands": ["0000c20081e628151d34af9c8878e4efbb84311d"]
  }
}
```

### Offline Keys (futuro)

#### POST `/user/locks/`

**Request:**
```json
{
  "userUUID": "1034838",
  "companyUUID": "1000239",
  "siteUUID": "2223372"
}
```

**Response:**
```json
{
  "data": {
    "units": [
      {
        "locks": [
          {
            "mac": "D0:1F:A6:44:B3:6F",
            "name": "Lock 1",
            "offlineKey": "...",
            "unlockCmd": "..."
          }
        ]
      }
    ]
  }
}
```

---

## 📂 Estructura de Archivos

```
NokeApp/
├── src/
│   ├── screens/
│   │   └── NativeScan/
│   │       ├── NativeScanScreen.tsx    # UI principal
│   │       └── styles.ts                # Estilos
│   └── config/
│       └── nokeCredentials.ts           # Credenciales (gitignored)
│
├── modules/
│   └── NativeScanner/
│       ├── js/
│       │   └── index.ts                 # TypeScript definitions
│       └── ios/
│           ├── NativeScanner.swift      # Módulo BLE
│           ├── NativeScannerModule.m    # Objective-C bridge
│           ├── NokeAPIClient.swift      # Cliente HTTP
│           ├── NokeAPIClientModule.m    # Objective-C bridge
│           ├── NokeAPI.js               # API wrapper JS
│           └── NokeAPI-example.js       # Ejemplo de uso
│
├── ios/
│   ├── NokeApp.xcworkspace              # Xcode workspace
│   └── Podfile                          # CocoaPods config
│
├── .gitignore                           # Ignora nokeCredentials.ts
└── package.json                         # Dependencias npm
```

---

## 🎓 Conceptos Clave

### Session Data

El **Session Data** es un valor hexadecimal de 20 bytes que el candado genera cada vez que se enciende o reinicia. Es necesario para que el servidor genere comandos válidos.

**Propiedades:**
- Único por sesión del candado
- Se lee de la característica BLE "Session"
- Cambia si el candado se reinicia
- Ejemplo: `E7030000FA51E3D524651DB6A965985B3FA6CE81`

### MAC Address en iOS

iOS no permite leer la MAC address directamente por privacidad. La solución implementada:

1. Noke incluye la MAC en el **nombre del dispositivo**
2. Formato: `NOKE3E_D01FA644B36F`
3. Extraemos los últimos 12 caracteres: `D01FA644B36F`
4. Formateamos con dos puntos: `D0:1F:A6:44:B3:6F`

```typescript
function getMacAddress(device: BleDevice): string | null {
  const name = device.name;
  if (!name) return null;
  
  // Buscar patrón: NOKE[modelo]_[12 hex chars]
  const match = name.match(/NOKE\w+_([0-9A-F]{12})$/i);
  if (!match) return null;
  
  const macWithoutColons = match[1];
  
  // Insertar dos puntos cada 2 caracteres
  return macWithoutColons.match(/.{1,2}/g)!.join(':').toUpperCase();
}
```

### Online vs Offline Unlock

| Aspecto | Online Unlock | Offline Unlock |
|---------|---------------|----------------|
| **Requiere internet** | ✅ Sí | ❌ No |
| **Comando** | Servidor genera en tiempo real | Pre-generado y cacheado |
| **Session necesaria** | ✅ Sí | ❌ No |
| **Validez** | Una sola sesión | Múltiples sesiones |
| **Implementado** | ✅ Sí | ⏳ Pendiente |

**Esta rama implementa solo Online Unlock.**

### ¿Cómo se cierra el candado?

El candado Noke **se cierra automáticamente** después del unlock usando un temporizador interno del firmware. No existe un comando API separado para "lock". El comportamiento es:

1. Se envía comando de unlock → Candado abre 🔓
2. Después de X segundos → Candado se cierra automáticamente 🔒
3. El tiempo de auto-cierre está configurado en el firmware del candado

---

## 📝 Notas Finales

### Estado del Proyecto

✅ **Completado:**
- Escaneo BLE con filtros
- Conexión y lectura de session
- Login y autenticación
- Auto re-login cuando token expira
- Unlock online
- UI con feedback visual
- Extracción de MAC en iOS
- Logging completo con cURL commands
- Auto-reset de botones
- Manejo robusto de errores

⏳ **Pendiente (futuras ramas):**
- Offline unlock
- Persistencia de offline keys
- Historial de accesos
- Sincronización en background
- Notificaciones de eventos del candado

### Contribuciones

**Desarrollado por:** Ricardo Padilla  
**Empresa:** Janus International  
**Fecha:** Octubre 2024  

### Licencia

Propiedad de Janus International. Código privado.

---

## 🆘 Soporte

Para problemas o preguntas:

1. Revisar la sección [Troubleshooting](#troubleshooting)
2. Verificar logs en consola
3. Contactar al equipo de desarrollo

**Logs importantes a compartir:**
- Logs de Swift (Xcode Console)
- Logs de JavaScript (Metro Console)
- Comando cURL del request que falla
- Respuesta del servidor

---

**¡Listo para usar! 🎉**

