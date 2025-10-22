# 📁 Configuration Directory

Este directorio contiene archivos de configuración para la aplicación.

## 🔐 Credenciales de Noke

### Archivos:

1. **`nokeCredentials.template.ts`** ✅ (Commiteado al repo)
   - Template con las credenciales vacías
   - Sirve como referencia de estructura
   - Seguro para commitear

2. **`nokeCredentials.ts`** ⚠️ (NO commiteado)
   - Contiene tus credenciales reales
   - Ya está en `.gitignore`
   - **NUNCA** debe commitearse al repositorio

### Cómo usar:

#### Para nuevos desarrolladores:

```bash
# 1. Copia el template
cp src/config/nokeCredentials.template.ts src/config/nokeCredentials.ts

# 2. Edita con tus credenciales reales
# 3. ¡Listo! La app usará automáticamente tus credenciales
```

#### Estructura de credenciales:

```typescript
export const NOKE_CREDENTIALS = {
  email: 'tu-email@ejemplo.com',           // Email de tu cuenta Noke
  password: 'tu-password',                  // Password
  companyUUID: 'tu-company-uuid',          // UUID de la compañía (puede ser '-1')
  siteUUID: 'tu-site-uuid',                // UUID del sitio/propiedad
  deviceId: 'tu-device-uuid',              // Device UUID del API (opcional)
  environment: 'development',               // 'development' o 'production'
};
```

### Cómo obtener tus credenciales:

1. **email y password**: Tus credenciales de login a Noke
2. **companyUUID**: Obtenido del dashboard de Noke (o '-1' en algunos casos)
3. **siteUUID**: ID del sitio/propiedad en Noke
4. **deviceId**: UUID único del dispositivo (se genera automáticamente si no se proporciona)
5. **environment**: 
   - `'development'` → `https://router.smartentry.noke.dev/`
   - `'production'` → `https://router.smartentry.noke.com/`

### Seguridad:

✅ **Buenas prácticas:**
- Mantén `nokeCredentials.ts` fuera del control de versiones
- Usa variables de entorno en producción
- No compartas tus credenciales
- Rota tus passwords periódicamente

❌ **NO hacer:**
- Commitear `nokeCredentials.ts` al repo
- Compartir credenciales en chat/email
- Hardcodear credenciales en otros archivos
- Usar credenciales de producción en desarrollo

### Verificación:

Para verificar que está bien configurado:

```bash
# Verificar que nokeCredentials.ts está en .gitignore
git status

# No debería aparecer nokeCredentials.ts
# Si aparece, está mal configurado
```

## 🔧 Otros archivos de configuración

Agrega aquí documentación de otros archivos de config que crees.



