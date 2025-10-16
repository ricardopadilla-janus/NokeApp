# Noke React Native SDK - Overview para Manager

## 🎯 Objetivo del Proyecto

Crear **SDK de React Native** (2 paquetes NPM) para que terceros integren cerraduras Noke en sus apps.

---

## 📦 Productos Finales

### 1. @noke/ble-manager (Librería BLE Nativa)

**Qué es**: Módulo nativo con lógica BLE y protocolos Noke  
**Sin UI**: Solo funcionalidad, el cliente pone su propia UI si quiere  
**Plataformas**: iOS + Android  

```bash
# El cliente instala:
npm install @noke/ble-manager
```

```typescript
// El cliente usa:
import NokeBLE from '@noke/ble-manager';
await NokeBLE.startScan();
await NokeBLE.unlock(deviceId);
```

### 2. @noke/ui-components (Componentes UI)

**Qué es**: Pantallas y componentes pre-construidos de React Native  
**Opcional**: El cliente puede usarlos o hacer su propia UI  
**Depende de**: @noke/ble-manager  

```bash
# El cliente instala:
npm install @noke/ble-manager @noke/ui-components
```

```typescript
// El cliente usa pantalla completa:
import { NokeScanScreen } from '@noke/ui-components';
<NokeScanScreen />  // ¡Listo! Funciona de inmediato
```

---

## ✅ Por Qué Soportar Ambas Arquitecturas

### El Problema

**No sabemos qué React Native usa el cliente**:
- Algunos tienen RN 0.68 → Old Architecture
- Algunos tienen RN 0.76 → New Architecture
- No podemos pedirles que actualicen su proyecto

### La Solución

**Código híbrido que funciona en AMBAS**:

```objective-c
// Nuestro código nativo tiene ambas implementaciones
RCT_EXPORT_METHOD(...)  // Funciona siempre

#ifdef RCT_NEW_ARCH_ENABLED
  getTurboModule()      // Solo si cliente tiene New Arch
#endif
```

**Resultado**:
- Cliente con Old Arch → Usa Bridge (funciona)
- Cliente con New Arch → Usa Turbo (más rápido)
- **Mismo paquete NPM para ambos**

### Decisión: NO depende de nosotros

**Depende del proyecto del CLIENTE**:

| Cliente tiene | Nuestra librería usa |
|---------------|---------------------|
| RN 0.60-0.75 (Old) | Bridge automáticamente |
| RN 0.76+ (New) | Turbo automáticamente |

**Se adapta sola** al detectar el flag `newArchEnabled` del cliente.

---

## 🔧 NokeApp = Proyecto de Desarrollo

### NokeApp NO es el producto final

**NokeApp es**:
- Proyecto de desarrollo y testing
- Sandbox para probar features
- Demo para mostrar a clientes
- Eventualmente se convierte en "example app"

**Los productos finales son**:
- Package 1: @noke/ble-manager
- Package 2: @noke/ui-components

### Estructura actual vs futura

**Actual (desarrollo)**:
```
NokeApp/
├── modules/NokeBleManager/  → Será @noke/ble-manager
├── src/screens/Home/        → Será @noke/ui-components
└── Todo en un proyecto
```

**Futuro (distribución)**:
```
3 repositorios:
├── noke-ble-manager/      → npm package 1
├── noke-ui-components/    → npm package 2
└── noke-demo-app/         → NokeApp (ejemplo)
```

---

## ⏱️ Timeline Actualizado

### Fase 1-2: Desarrollo (3-4 semanas)
- Completar funcionalidad BLE
- Importar código nativo existente
- Pulir UI components
- **Output**: Todo funcionando en NokeApp

### Fase 3: Extracción a Packages (1 semana)
- Crear estructura de packages
- Mover código a paquetes separados
- Configurar monorepo
- **Output**: 2 paquetes NPM listos

### Fase 4: Testing de Compatibilidad (1 semana)
- Crear proyecto demo RN 0.68 (Old Arch)
- Crear proyecto demo RN 0.76 (New Arch)
- Instalar paquetes en ambos
- Validar que funcionan
- **Output**: Garantía de compatibilidad

### Fase 5: Integración Cliente (1 semana)
- Cliente instala packages
- Soporte durante integración
- Fix de issues
- **Output**: Cliente usando SDK en producción

**Total: 6-7 semanas**

---

## 🎯 Integración del Cliente (Caso de Uso Real)

### Escenario: Cliente quiere agregar Noke a su app

**Cliente tiene**: App React Native existente (RN 0.72, Old Arch)

**Pasos del cliente**:

```bash
# 1. Instalar (2 minutos)
npm install @noke/ble-manager @noke/ui-components
cd ios && pod install

# 2. Agregar permisos iOS (2 minutos)
# (Copiamos de nuestra docs)

# 3. Usar en código (5 minutos)
import { NokeScanScreen } from '@noke/ui-components';

function App() {
  return (
    <Stack.Screen name="Unlock" component={NokeScanScreen} />
  );
}
```

**Tiempo total de integración**: < 30 minutos  
**Resultado**: App del cliente puede escanear y desbloquear Nokes

---

## ✅ Ventajas de Nuestra Solución

### vs. Otras Librerías BLE

| Característica | Otras librerías | Noke SDK |
|----------------|-----------------|----------|
| Soporte Old Arch | ⚠️ Algunas | ✅ Sí |
| Soporte New Arch | ⚠️ Algunas | ✅ Sí |
| Protocolos Noke | ❌ No | ✅ Sí |
| UI incluida | ❌ No | ✅ Opcional |
| Fácil integración | ⚠️ Media | ✅ 30 min |

### Valor para el Cliente

✅ **Plug & Play**: Instalar package y funciona  
✅ **Flexible**: Usar UI propia o la nuestra  
✅ **Compatible**: Funciona con su versión de RN  
✅ **Soporte**: Documentación y ejemplos completos  
✅ **Performance**: Optimizado (Turbo si pueden, Bridge si no)  

---

## 📋 Decisiones Técnicas Clave

### 1. ¿Old o New Architecture?

**Decisión**: AMBAS (código híbrido)

**Razón**: No sabemos qué usa el cliente. Debe funcionar para todos.

**Cómo**: Compilación condicional (`#ifdef`). Se adapta automáticamente.

### 2. ¿1 o 2 Packages?

**Decisión**: 2 packages separados

**Razón**:
- Cliente puede querer solo BLE (su propia UI)
- Actualizaciones UI no requieren recompilar nativo
- Bundles más pequeños
- Separación de concerns

### 3. ¿Turbo Modules o Nitro?

**Decisión**: Turbo Modules (oficial de RN)

**Razón**:
- Oficial y soportado por Meta
- Mejor documentación
- Más estable que Nitro
- Compatible con Old Arch también

### 4. ¿Monorepo o Repos separados?

**Decisión**: Empezar monorepo, separar después

**Razón**:
- Desarrollo más rápido ahora
- Fácil testing conjunto
- Separar cuando estemos listos para publicar

---

## 🚀 Valor de Negocio

### Para Noke

- **Producto**: SDK reutilizable
- **Mercado**: Cualquier app React Native
- **Escalable**: Múltiples clientes, un SDK
- **Ingresos**: Potencial licenciamiento

### Para el Cliente

- **Ahorro**: 30 min vs 2-3 semanas de desarrollo
- **Calidad**: Código probado y mantenido por Noke
- **Soporte**: Documentación y actualizaciones
- **Flexibilidad**: Pueden customizar lo que necesiten

---

## Preguntas Frecuentes

### "¿El cliente necesita saber de arquitecturas?"

**NO**. Nuestra librería se adapta automáticamente. Es transparente para ellos.

### "¿Funciona si el cliente tiene RN viejo?"

**SÍ**. Soportamos desde RN 0.60+ (Old Architecture).

### "¿Y si actualizan a RN nuevo?"

**Sigue funcionando**. Se adapta automáticamente a New Architecture (más rápido).

### "¿Tienen que usar nuestra UI?"

**NO**. Pueden:
- Opción A: Usar nuestros componentes (rápido)
- Opción B: Usar solo BLE y hacer su UI (flexible)
- Opción C: Mix (algunos componentes nuestros, otros propios)

### "¿Cómo probamos compatibilidad?"

**Testing en**:
- NokeApp con New Arch (actual)
- Proyecto demo con Old Arch (RN 0.68)
- Proyecto demo con New Arch (RN 0.76)

---

## Próximos Pasos

### Esta Semana
1. ✅ Completar funcionalidad en NokeApp
2. ✅ Validar arquitectura híbrida
3. 📋 Presentar a manager
4. 🎯 Obtener aprobación

### Semanas 2-3
1. Importar código BLE nativo existente
2. Completar todas las features
3. Testing exhaustivo

### Semanas 4-5
1. Extraer a packages NPM
2. Crear documentación para clientes
3. Testing de compatibilidad

### Semana 6
1. Entregar a primer cliente
2. Soporte de integración
3. Ajustes finales

---

**Recomendación**: ✅ Proceder con desarrollo de SDK  
**Justificación**: Código híbrido garantiza compatibilidad universal  
**Timeline**: 6-7 semanas hasta SDK en producción  
**Riesgo**: Bajo (estrategia validada, fallbacks en lugar)

