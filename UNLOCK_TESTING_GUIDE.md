# 🧪 Guía de Pruebas de Unlock

Esta guía explica cómo probar el sistema de unlock de candados Noke después de la migración a React Native.

## 🎯 Objetivo

Verificar que el sistema de unlock funciona correctamente con:
- ✅ HTTP API migrado a React Native TypeScript
- ✅ BLE operations mantenidas nativas
- ✅ Compatibilidad iOS y Android
- ✅ Manejo de errores robusto

## 🔧 Configuración Previa

### 1. Configurar Credenciales

```bash
# Copia el template de credenciales
cp src/config/nokeCredentials.template.ts src/config/nokeCredentials.ts

# Edita con tus credenciales reales
# Ver: NOKE_CREDENTIALS_GUIDE.md
```

### 2. Configurar Ejemplos (Opcional)

```bash
# Copia el template de ejemplos
cp src/examples/NokeAPIExamples.template.tsx src/examples/NokeAPIExamples.tsx

# Edita con tus credenciales reales
```

## 📱 Pruebas en iOS

### Requisitos
- Dispositivo iOS físico (BLE no funciona en simulador)
- Xcode 14+
- CocoaPods instalado

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Instalar pods
cd ios && pod install && cd ..

# 3. Compilar y ejecutar
npm run ios
```

### Pruebas a Realizar

1. **Login Automático**
   - Abrir app → Tab "Native"
   - Verificar que aparece "✅ Sesión iniciada"
   - Si falla, verificar credenciales

2. **Escaneo BLE**
   - Tap "Escanear Dispositivos BLE"
   - Verificar que encuentra candados Noke
   - Verificar que muestra MAC address

3. **Unlock Online**
   - Seleccionar un candado
   - Tap "Desbloquear"
   - Verificar que se conecta
   - Verificar que obtiene comandos del servidor
   - Verificar que envía comandos al candado
   - Verificar que el candado se abre

4. **Manejo de Errores**
   - Probar sin internet
   - Probar con credenciales incorrectas
   - Probar con candado desconectado

## 🤖 Pruebas en Android

### Requisitos
- Dispositivo Android físico o emulador con BLE
- Android Studio
- Gradle

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar y ejecutar
npm run android
```

### Pruebas a Realizar

1. **Login Automático**
   - Abrir app → Tab "Native"
   - Verificar que aparece "✅ Sesión iniciada"

2. **Escaneo BLE**
   - Tap "Escanear Dispositivos BLE"
   - Verificar que encuentra candados Noke
   - Verificar que muestra MAC address

3. **Unlock Online**
   - Seleccionar un candado
   - Tap "Desbloquear"
   - Verificar que se conecta
   - Verificar que obtiene comandos del servidor
   - Verificar que envía comandos al candado
   - Verificar que el candado se abre

## 🔍 Verificación de Logs

### iOS (Xcode Console)

```
[NativeScanner] ✅ Connected to: NOKE3E_D01FA644B36F
[NokeAPIService] 📥 Response: 200
[NokeAPIService] ✅ Unlock commands received: 1 commands
```

### Android (Logcat)

```
[NativeScanner] ✅ Connected to: NOKE3E_D01FA644B36F
[NokeAPIService] 📥 Response: 200
[NokeAPIService] ✅ Unlock commands received: 1 commands
```

### React Native (Metro)

```
[NokeAPI] Getting unlock commands for D0:1F:A6:44:B3:6F...
[NokeAPI] ✅ Unlock commands received (1 commands)
```

## 🧪 Pruebas Específicas

### 1. Prueba de Login

```typescript
import { useNokeAPI } from '../hooks/useNokeAPI';

const { login, isLoggedIn, userData } = useNokeAPI();

const testLogin = async () => {
  try {
    await login({
      email: 'tu-email@ejemplo.com',
      password: 'tu-password',
      companyUUID: 'tu-company-uuid',
      siteUUID: 'tu-site-uuid',
    });
    
    console.log('Login exitoso:', isLoggedIn);
    console.log('User data:', userData);
  } catch (error) {
    console.error('Error de login:', error);
  }
};
```

### 2. Prueba de Unlock

```typescript
import { useNokeAPI } from '../hooks/useNokeAPI';

const { getUnlockCommands } = useNokeAPI();

const testUnlock = async () => {
  try {
    const unlockData = await getUnlockCommands('D0:1F:A6:44:B3:6F', 'session-data');
    console.log('Comandos obtenidos:', unlockData);
  } catch (error) {
    console.error('Error de unlock:', error);
  }
};
```

### 3. Prueba de Offline Keys

```typescript
import { useNokeAPI } from '../hooks/useNokeAPI';

const { getAllOfflineKeys } = useNokeAPI();

const testOfflineKeys = async () => {
  try {
    const keys = await getAllOfflineKeys();
    console.log('Offline keys:', keys);
  } catch (error) {
    console.error('Error de offline keys:', error);
  }
};
```

## 🐛 Troubleshooting

### Error: "Invalid credentials"
- Verifica que las credenciales sean correctas
- Asegúrate de que la cuenta tenga permisos

### Error: "Network error"
- Verifica tu conexión a internet
- Asegúrate de que el environment sea correcto

### Error: "BLE not available"
- Verifica que Bluetooth esté habilitado
- Asegúrate de que los permisos estén concedidos

### Error: "Device not found"
- Verifica que el candado esté encendido
- Asegúrate de que esté en modo de escaneo

### Error: "Connection failed"
- Verifica que el candado esté cerca
- Asegúrate de que no esté conectado a otro dispositivo

## 📊 Métricas de Éxito

### Funcionalidad Básica
- ✅ Login automático funciona
- ✅ Escaneo BLE encuentra candados
- ✅ Conexión BLE establecida
- ✅ Unlock online exitoso

### Rendimiento
- ✅ Login < 2 segundos
- ✅ Escaneo encuentra candados en < 10 segundos
- ✅ Unlock completo < 5 segundos

### Robustez
- ✅ Manejo de errores de red
- ✅ Manejo de errores de BLE
- ✅ Recuperación automática
- ✅ Logs detallados para debugging

## 🔄 Pruebas de Regresión

### Antes de la Migración
- [ ] Login funciona
- [ ] Escaneo BLE funciona
- [ ] Unlock online funciona
- [ ] Manejo de errores funciona

### Después de la Migración
- [ ] Login funciona (React Native)
- [ ] Escaneo BLE funciona (nativo)
- [ ] Unlock online funciona (React Native)
- [ ] Manejo de errores funciona (React Native)

## 📝 Reporte de Pruebas

### Template de Reporte

```
## Reporte de Pruebas - [Fecha]

### Plataforma: [iOS/Android]
### Dispositivo: [Modelo]
### Versión: [React Native 0.81]

### Pruebas Realizadas:
- [ ] Login automático
- [ ] Escaneo BLE
- [ ] Unlock online
- [ ] Manejo de errores

### Resultados:
- ✅ Login: [Tiempo] segundos
- ✅ Escaneo: [Candados encontrados] en [Tiempo] segundos
- ✅ Unlock: [Tiempo] segundos
- ✅ Errores: [Manejo correcto/incorrecto]

### Problemas Encontrados:
- [Lista de problemas]

### Recomendaciones:
- [Lista de recomendaciones]
```

## 🎉 Conclusión

Después de completar todas las pruebas, deberías tener:

1. **Confianza** en que la migración funciona correctamente
2. **Documentación** de cualquier problema encontrado
3. **Métricas** de rendimiento para comparar con versiones futuras
4. **Conocimiento** de cómo probar el sistema en el futuro

---

**Recuerda:** Siempre prueba en dispositivos físicos para obtener resultados reales. Los simuladores no pueden probar BLE correctamente.
