# Cómo Cambiar a Old Architecture (Para Testing)

## Estado Actual: New Architecture ✅

Actualmente estamos usando:
- ✅ Turbo Modules (no Nitro Modules)
- ✅ New Architecture habilitada
- ✅ JSI para llamadas nativas directas

---

## Pasos para Probar en Old Architecture

### 1. Cambiar Configuración Android

**Archivo**: `android/gradle.properties`

**Línea 35**, cambiar de:
```properties
newArchEnabled=true
```

A:
```properties
newArchEnabled=false
```

### 2. Cambiar Configuración iOS

**Archivo**: `ios/NokeApp/Info.plist`

Buscar la clave `RCTNewArchEnabled` y cambiar a `false`:

```xml
<key>RCTNewArchEnabled</key>
<false/>
```

**Nota**: Actualmente tu Info.plist tiene `<true/>` en línea 39.

### 3. Limpiar Todo

```bash
# Limpiar Android
cd android
./gradlew clean
cd ..

# Limpiar iOS
cd ios
rm -rf build Pods Podfile.lock
pod install
cd ..

# Limpiar Metro cache
rm -rf $TMPDIR/metro-* $TMPDIR/haste-*
watchman watch-del-all

# Limpiar Xcode DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/NokeApp-*
```

### 4. Rebuild

```bash
# iOS
npm run ios

# Android
npm run android
```

### 5. Verificar que cambió

**En los logs de compilación deberías ver**:

**Old Architecture (Bridge)**:
- NO verás mensajes de "Configuring the target with the New Architecture"
- NO se generarán archivos `*JSI.cpp`
- Los módulos usan `RCTBridge` en lugar de JSI

**New Architecture (Turbo)**:
- SÍ verás "Configuring the target with the New Architecture"
- SÍ se generan archivos `NativeScannerSpecJSI-generated.cpp`
- Los módulos usan JSI

---

## ¿Qué Cambia en el Comportamiento?

### Lo que NO cambia (tu código)

```typescript
// JavaScript - EXACTAMENTE IGUAL
import NativeScanner from './modules/NativeScanner/js';
await NativeScanner.startScan(10);  // Funciona igual
```

### Lo que SÍ cambia (interno)

| Aspecto | New Arch | Old Arch |
|---------|----------|----------|
| **Comunicación** | JSI (directo) | Bridge (serializado) |
| **Performance** | Más rápida | Un poco más lenta |
| **Compilación** | Genera JSI wrappers | Usa RCTBridge |
| **Logs** | `[Turbo]` | `[Bridge]` |

### Testing Checklist

Cuando cambies a Old Architecture, prueba:

- [ ] Home tab: BLE scanning funciona
- [ ] Native tab: NativeScanner funciona
- [ ] Settings tab: TestModule funciona
- [ ] No hay crashes
- [ ] Performance aceptable

---

## Para Regresar a New Architecture

### Mismo proceso pero inverso:

**Android** - `android/gradle.properties`:
```properties
newArchEnabled=true
```

**iOS** - `ios/NokeApp/Info.plist`:
```xml
<key>RCTNewArchEnabled</key>
<true/>
```

Luego limpiar y rebuild.

---

## ¿Por qué probar ambas?

### Razones para testing:

1. **Validación**: Confirmar que nuestro código híbrido funciona en ambas
2. **Debugging**: Si hay bug en New Arch, probar en Old
3. **Comparación**: Medir diferencia de performance
4. **Confianza**: Saber que tenemos fallback funcional

### Nuestra recomendación

**Mantener New Architecture** salvo que:
- ❌ Encuentres bugs críticos específicos de New Arch
- ❌ Alguna librería de terceros no sea compatible
- ❌ Problemas de performance (poco probable)

---

## Respuesta a tus preguntas

### "¿Usamos Nitro o Turbo?"

**Respuesta**: TURBO MODULES (oficial)

- ✅ Turbo Modules = Sistema de Meta/React Native
- ❌ Nitro Modules = NO (es de Marc Rousavy, experimental)

**Evidencia en código**:
```typescript
// modules/*/js/Native*.ts
import { TurboModuleRegistry } from 'react-native';
//        ^^^^^ Turbo, no Nitro
```

### "¿Cómo probar Old Architecture?"

**Respuesta**: Cambiar flags y rebuild (pasos arriba)

**Importante**:
- Tu código NO cambia
- Solo configuración del proyecto
- Debe funcionar en ambas (ya está preparado)
- Actualmente: New Arch (mejor performance)

---

## Estado Actual del Proyecto

```
NokeApp
├── Architecture: NEW (Turbo Modules)
├── Native Modules: Turbo (no Nitro)
├── Compatible: New + Old (hybrid code)
└── Recommendation: Keep NEW
```

**¿Necesitas cambiar a Old?**
- Solo para testing/validación
- Volver a New después
- No necesario para funcionalidad

---

**TL;DR**:
- Usamos Turbo (oficial), no Nitro (experimental)
- Estamos en New Architecture (mejor)
- Para probar Old: cambiar 2 flags y rebuild
- Nuestro código funciona en ambas automáticamente

