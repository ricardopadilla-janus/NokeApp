/**
 * Template de credenciales para Noke API
 * 
 * INSTRUCCIONES:
 * 1. Copia este archivo como 'nokeCredentials.ts'
 * 2. Reemplaza los valores de ejemplo con tus credenciales reales
 * 3. NUNCA commitees nokeCredentials.ts al repositorio
 */

export const NOKE_CREDENTIALS = {
  // 🔐 CREDENCIALES DE NOKKE
  email: 'tu-email@ejemplo.com',           // Email de tu cuenta Noke
  password: 'tu-password-seguro',           // Password de tu cuenta
  
  // 🏢 CONFIGURACIÓN DE ORGANIZACIÓN
  companyUUID: 'tu-company-uuid',           // UUID de la compañía (puede ser '-1')
  siteUUID: 'tu-site-uuid',                // UUID del sitio/propiedad
  
  // 📱 CONFIGURACIÓN DE DISPOSITIVO
  deviceId: 'tu-device-uuid',               // Device UUID del API (opcional, se genera automáticamente)
  
  // 🌐 AMBIENTE
  environment: 'development',               // 'development' o 'production'
  
  // 🔗 URLs (no cambiar a menos que sea necesario)
  baseURL: 'https://router.smartentry.noke.dev/',  // URL base del API
};

/**
 * CÓMO OBTENER TUS CREDENCIALES:
 * 
 * 1. EMAIL Y PASSWORD:
 *    - Tus credenciales de login a https://manage.noke.com
 * 
 * 2. COMPANYUUID:
 *    - En el dashboard de Noke, ve a Settings → Company
 *    - Copia el UUID de la compañía
 *    - En algunos casos puede ser '-1'
 * 
 * 3. SITEUUID:
 *    - En el dashboard, ve a Properties/Sites
 *    - Selecciona tu sitio/propiedad
 *    - Copia el UUID del sitio
 * 
 * 4. DEVICEID:
 *    - Opcional, se genera automáticamente si no se proporciona
 *    - Puedes usar cualquier UUID único
 * 
 * 5. ENVIRONMENT:
 *    - 'development' → https://router.smartentry.noke.dev/
 *    - 'production' → https://router.smartentry.noke.com/
 */

/**
 * EJEMPLO DE CONFIGURACIÓN COMPLETA:
 * 
 * export const NOKE_CREDENTIALS = {
 *   email: 'ricardo.padilla@janusintl.com',
 *   password: 'Dr@keNoKe',
 *   companyUUID: '-1',
 *   siteUUID: '2223372',
 *   deviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   environment: 'development',
 *   baseURL: 'https://router.smartentry.noke.dev/',
 * };
 */
