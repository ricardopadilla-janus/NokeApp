# React Native Architecture: Old vs New - Explicación Simple

## ¿Qué es esto de Old y New Architecture?

React Native tiene dos formas de comunicar JavaScript con código nativo. Piensa en ellas como dos sistemas de mensajería diferentes.

---

## Old Architecture (Bridge) - El sistema tradicional

### ¿Cómo funciona?

```
JavaScript                     Native (iOS/Android)
    |                               |
    |  "Llama función X"            |
    |  (convierte a JSON)           |
    |------------------------------>|
    |         BRIDGE                |
    |  (serialización/cola)         |
    |                               |
    |                          Ejecuta X
    |                               |
    |     Resultado (JSON)          |
    |<------------------------------|
    |         BRIDGE                |
    |  (deserialización)            |
    |                               |
Muestra resultado
```

**Problema**: Todo se serializa a JSON, pasa por una cola, y es asíncrono. Lento para operaciones frecuentes.

---

## New Architecture (JSI/Turbo Modules) - El sistema moderno

### ¿Cómo funciona?

```
JavaScript                     Native (iOS/Android)
    |                               |
    |  Llama función X              |
    |  (llamada directa)            |
    |==============================>|  (JSI - memoria compartida)
    |      SIN SERIALIZACIÓN        |
    |                               |
    |                          Ejecuta X
    |                               |
    |     Resultado (directo)       |
    |<==============================|  (JSI - sin conversión)
    |                               |
Muestra resultado
```

**Ventaja**: Llamadas directas, sin serialización, puede ser síncrono. Mucho más rápido.

---

## ¿Cómo funciona nuestro código en AMBAS?

### Compilación Condicional

Nuestros módulos tienen **dos implementaciones en el mismo archivo**:

```objective-c
// modules/NativeScanner/ios/NativeScanner.h

#ifdef RCT_NEW_ARCH_ENABLED
  // 👇 Versión Nueva Arquitectura
  #import <NativeScannerSpec/NativeScannerSpec.h>
  @interface NativeScanner : RCTEventEmitter <NativeScannerSpec>
#else
  // 👇 Versión Old Architecture
  @interface NativeScanner : RCTEventEmitter <RCTBridgeModule>
#endif
```

**¿Qué significa esto?**

- Si `RCT_NEW_ARCH_ENABLED` está activo → Usa Turbo Module
- Si NO está activo → Usa Bridge tradicional
- **El mismo código funciona para ambas**

### En el archivo .mm

```objective-c
// modules/NativeScanner/ios/NativeScanner.mm

// Este método se exporta SIEMPRE (ambas arquitecturas)
RCT_EXPORT_METHOD(startScan:(double)seconds
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    // Código que funciona igual en ambas arquitecturas
    [self.centralManager scanForPeripherals...];
}

// Este código SOLO se compila en New Architecture
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:... {
    return std::make_shared<facebook::react::NativeScannerSpecJSI>(params);
}
#endif
```

---

## ¿Cómo se activa una u otra?

### Current State: New Architecture ACTIVADA ✅

**Archivo**: `android/gradle.properties`
```properties
newArchEnabled=true
```

**Archivo**: `ios/NokeApp/Info.plist`
```xml
<key>RCTNewArchEnabled</key>
<true/>
```

### Para cambiar a Old Architecture

**Android** - Edita `android/gradle.properties`:
```properties
newArchEnabled=false  # Cambiar a false
```

**iOS** - Edita `ios/NokeApp/Info.plist`:
```xml
<key>RCTNewArchEnabled</key>
<false/>  <!-- Cambiar a false -->
```

**Luego**:
```bash
# Android
cd android && ./gradlew clean && cd ..

# iOS
cd ios && rm -rf build Pods Podfile.lock && pod install && cd ..

# Rebuild
npm run ios   # o npm run android
```

---

## ¿Qué usa nuestra app AHORA?

### Estado Actual: New Architecture (Turbo Modules)

**Evidencia**:
1. `gradle.properties`: `newArchEnabled=true`
2. Al compilar iOS, dice: `"Configuring the target with the New Architecture"`
3. Codegen genera archivos JSI (`NativeScannerSpecJSI`)

**Qué significa**:
- ✅ Nuestros módulos usan JSI (llamadas directas)
- ✅ Mejor performance
- ✅ Preparados para el futuro de React Native
- ✅ Pero aún funciona en Old si cambiamos el flag

---

## JavaScript: ¿Nota la diferencia?

### NO. El código JavaScript es IDÉNTICO

**Desde JavaScript**:
```typescript
import NativeScanner from './modules/NativeScanner/js';

// Este código funciona IGUAL en ambas arquitecturas
await NativeScanner.startScan(10);
```

**Lo que cambia internamente**:
- **New Arch**: Llamada directa via JSI
- **Old Arch**: Llamada via Bridge

**Pero tu código JavaScript no cambia**. Transparente.

---

## Ventajas de soportar ambas

### ¿Por qué hicimos esto?

1. **Compatibilidad**: Si surge problema con New Arch, cambiamos a Old
2. **Testing**: Podemos probar en ambas y comparar
3. **Usuarios**: Algunos dispositivos/versiones prefieren Old Arch
4. **Migración**: Permite transición gradual

### ¿Cuál deberíamos usar?

**Recomendación**: ✅ **New Architecture (actual)**

**Razones**:
- Es el futuro de React Native (Old será deprecated)
- Mejor performance para BLE (callbacks frecuentes)
- Ya está funcionando en nuestro proyecto
- React Native 0.76+ recomienda New Arch

**Mantener Old como opción**:
- Solo si encontramos bugs específicos de New Arch
- Para testing/comparación
- No cambiar sin razón

---

## Resumen para Manager

### Pregunta: "¿Funciona en ambas arquitecturas?"

**Respuesta**: Sí, nuestros módulos nativos funcionan en:
- ✅ New Architecture (Turbo Modules) - ACTUAL
- ✅ Old Architecture (Bridge) - FALLBACK

**Cómo**: Usamos compilación condicional (`#ifdef`). El mismo código se compila de dos formas diferentes según el flag.

### Pregunta: "¿Cuál estamos usando?"

**Respuesta**: New Architecture (Turbo Modules)

**Evidencia**:
- `gradle.properties` tiene `newArchEnabled=true`
- Logs de compilación muestran "New Architecture"
- Mejor performance

### Pregunta: "¿Cómo cambiamos?"

**Respuesta**: Cambiar un flag en configuración y recompilar:
```
Android: gradle.properties → newArchEnabled=false
iOS: Info.plist → RCTNewArchEnabled=false
```

### Pregunta: "¿Deberíamos cambiar?"

**Respuesta**: No. New Architecture es:
- Más rápida (crítico para BLE)
- El futuro de React Native
- Ya funcionando en nuestro proyecto
- Recomendada por React Native para nuevos proyectos

---

## Diagrama Visual

```
┌─────────────────────────────────────────────────────┐
│           JavaScript Code (React Native)            │
│                                                     │
│  await NativeScanner.startScan(10);                 │
└────────────────┬────────────────────────────────────┘
                 │
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼
┌─────────────┐       ┌─────────────┐
│ NEW ARCH    │       │ OLD ARCH    │
│ (JSI/Turbo) │       │ (Bridge)    │
│             │       │             │
│ Llamada     │       │ Serializa   │
│ Directa ⚡  │       │ a JSON      │
│             │       │ Pasa cola   │
└──────┬──────┘       └──────┬──────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────────────────────────────┐
│    Native iOS Code                  │
│    (NativeScanner.mm)               │
│                                     │
│    [centralManager scanFor...]      │
└─────────────────────────────────────┘

Flag: newArchEnabled=true  →  Usa NEW ARCH
Flag: newArchEnabled=false →  Usa OLD ARCH
```

---

## Para la presentación

### Puntos Clave

1. **Tenemos doble compatibilidad**
   - Un solo código funciona en ambas arquitecturas
   - Magia de `#ifdef` en compilación

2. **Usamos New Architecture actualmente**
   - Más moderna y rápida
   - Recomendada por React Native
   - Mejor para BLE (operaciones frecuentes)

3. **Podemos cambiar fácilmente**
   - Solo un flag de configuración
   - Sin cambios de código
   - Fallback si hay problemas

4. **No hay que decidir ahora**
   - Ya funciona en New Arch
   - Old Arch disponible si se necesita
   - Transparente para el usuario final

### Si preguntan: "¿Cuál es mejor?"

**New Architecture** para:
- ✅ Mejor performance (BLE con muchos callbacks)
- ✅ Futuro de React Native
- ✅ Proyectos nuevos (nuestro caso)

**Old Architecture** solo si:
- ❌ Hay bugs críticos en New Arch
- ❌ Necesitas soportar RN muy antiguas
- ❌ Terceros módulos incompatibles

**Nuestra recomendación**: Seguir con New Architecture (actual)

---

## Glosario Rápido

- **Bridge**: Sistema antiguo de comunicación JS ↔ Native (serializa todo a JSON)
- **JSI**: JavaScript Interface - memoria compartida entre JS y Native
- **Turbo Module**: Módulo nativo que usa JSI (New Architecture)
- **Codegen**: Genera código C++ automáticamente desde TypeScript
- **RCT_NEW_ARCH_ENABLED**: Flag de compilación que activa/desactiva New Arch

---

**Conclusión**: Nuestros módulos son "híbridos inteligentes" que se adaptan automáticamente a la arquitectura configurada. Actualmente usan New Architecture (más rápida), pero pueden volver a Old si fuera necesario.

