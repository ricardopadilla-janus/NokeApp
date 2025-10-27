# 🔐 Guía de Credenciales Noke

Esta guía explica cómo configurar las credenciales de Noke de forma segura en el proyecto.

## 📁 Archivos de Credenciales

### ✅ Archivos Seguros (Commiteados al Repo)

- **`src/config/nokeCredentials.template.ts`** - Template con credenciales vacías
- **`src/examples/NokeAPIExamples.template.tsx`** - Ejemplos con credenciales de ejemplo

### ⚠️ Archivos Sensibles (NO Commiteados)

- **`src/config/nokeCredentials.ts`** - Tus credenciales reales
- **`src/examples/NokeAPIExamples.tsx`** - Ejemplos con tus credenciales reales

## 🚀 Configuración Inicial

### Para Nuevos Desarrolladores

```bash
# 1. Copia el template de credenciales
cp src/config/nokeCredentials.template.ts src/config/nokeCredentials.ts

# 2. Copia el template de ejemplos
cp src/examples/NokeAPIExamples.template.tsx src/examples/NokeAPIExamples.tsx

# 3. Edita ambos archivos con tus credenciales reales
# 4. ¡Listo! La app usará automáticamente tus credenciales
```

### Estructura de Credenciales

```typescript
export const NOKE_CREDENTIALS = {
  email: 'tu-email@ejemplo.com',           // Email de tu cuenta Noke
  password: 'tu-password',                  // Password
  companyUUID: 'tu-company-uuid',          // UUID de la compañía (puede ser '-1')
  siteUUID: 'tu-site-uuid',                // UUID del sitio/propiedad
  deviceId: 'tu-device-uuid',              // Device UUID del API (opcional)
  environment: 'development',               // 'development' o 'production'
  baseURL: 'https://router.smartentry.noke.dev/',  // URL base del API
};
```

## 🔍 Cómo Obtener Tus Credenciales

### 1. Email y Password
- Tus credenciales de login a https://manage.noke.com

### 2. CompanyUUID
- En el dashboard de Noke, ve a Settings → Company
- Copia el UUID de la compañía
- En algunos casos puede ser '-1'

### 3. SiteUUID
- En el dashboard, ve a Properties/Sites
- Selecciona tu sitio/propiedad
- Copia el UUID del sitio

### 4. DeviceId
- Opcional, se genera automáticamente si no se proporciona
- Puedes usar cualquier UUID único

### 5. Environment
- `'development'` → https://router.smartentry.noke.dev/
- `'production'` → https://router.smartentry.noke.com/

## 🛡️ Seguridad

### ✅ Buenas Prácticas

- Mantén `nokeCredentials.ts` fuera del control de versiones
- Usa variables de entorno en producción
- No compartas tus credenciales
- Rota tus passwords periódicamente
- Usa credenciales de desarrollo para testing

### ❌ NO Hacer

- Commitear `nokeCredentials.ts` al repo
- Compartir credenciales en chat/email
- Hardcodear credenciales en otros archivos
- Usar credenciales de producción en desarrollo
- Subir archivos con credenciales reales

## 🔧 Verificación

### Verificar que está bien configurado

```bash
# Verificar que nokeCredentials.ts está en .gitignore
git status

# No debería aparecer nokeCredentials.ts
# Si aparece, está mal configurado
```

### Verificar que los templates están commiteados

```bash
# Verificar que los templates están en el repo
git ls-files | grep template

# Debería mostrar:
# src/config/nokeCredentials.template.ts
# src/examples/NokeAPIExamples.template.tsx
```

## 📝 Ejemplo Completo

```typescript
// src/config/nokeCredentials.ts
export const NOKE_CREDENTIALS = {
  email: 'ricardo.padilla@janusintl.com',
  password: 'Dr@keNoKe',
  companyUUID: '-1',
  siteUUID: '2223372',
  deviceId: '550e8400-e29b-41d4-a716-446655440000',
  environment: 'development',
  baseURL: 'https://router.smartentry.noke.dev/',
};
```

## 🧪 Testing

### Probar Login

```typescript
import { useNokeAPI } from '../hooks/useNokeAPI';

const { login, isLoggedIn } = useNokeAPI();

const testLogin = async () => {
  try {
    await login({
      email: 'tu-email@ejemplo.com',
      password: 'tu-password',
      companyUUID: 'tu-company-uuid',
      siteUUID: 'tu-site-uuid',
    });
    console.log('Login exitoso:', isLoggedIn);
  } catch (error) {
    console.error('Error de login:', error);
  }
};
```

### Probar Unlock

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

## 🆘 Troubleshooting

### Error: "Invalid credentials"
- Verifica que el email y password sean correctos
- Asegúrate de que la cuenta tenga permisos en el sitio

### Error: "Company not found"
- Verifica que el companyUUID sea correcto
- Prueba con '-1' si no estás seguro

### Error: "Site not found"
- Verifica que el siteUUID sea correcto
- Asegúrate de que tengas acceso al sitio

### Error: "Network error"
- Verifica tu conexión a internet
- Asegúrate de que el environment sea correcto

## 📚 Recursos Adicionales

- [Noke API Documentation](https://router.smartentry.noke.dev/)
- [Noke Management Portal](https://manage.noke.com)
- [React Native Fetch API](https://reactnative.dev/docs/network)

---

**Recuerda:** Nunca commitees archivos con credenciales reales al repositorio. Usa siempre los templates como base.
