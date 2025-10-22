# Guía de Configuración de ngrok

Este documento explica cómo configurar y usar ngrok con tu servidor de impresión térmica.

## ¿Por qué ngrok?

ngrok proporciona un túnel HTTPS público a tu servidor local, eliminando la necesidad de certificados autofirmados y permitiendo acceso desde servicios externos como Vercel.

### Ventajas sobre certificados autofirmados:
- ✅ Sin advertencias de certificado en navegadores
- ✅ Acceso público HTTPS desde cualquier lugar
- ✅ Dominios estáticos con ngrok Pro (no cambia al reiniciar)
- ✅ SSL/TLS automático
- ✅ Dashboard de inspección de requests
- ✅ Fácil integración con servicios externos

## Configuración Inicial

### 1. Crear cuenta en ngrok

1. Ve a https://ngrok.com y crea una cuenta gratuita
2. Para producción, considera actualizar a [ngrok Pro](https://ngrok.com/pricing) para obtener un dominio estático

### 2. Obtener tu authtoken

1. Inicia sesión en https://dashboard.ngrok.com
2. Ve a "Your Authtoken" en https://dashboard.ngrok.com/get-started/your-authtoken
3. Copia tu token de autenticación

### 3. Configurar variables de entorno

Edita tu archivo `.env` y agrega:

```env
# Token de autenticación de ngrok (REQUERIDO)
NGROK_AUTHTOKEN=tu_token_real_aqui

# Dominio estático (OPCIONAL - solo para ngrok Pro)
# Ejemplo: NGROK_DOMAIN=mi-impresora.ngrok-free.app
NGROK_DOMAIN=
```

**Para usuarios de ngrok Pro:**
Si tienes ngrok Pro, puedes configurar un dominio estático en tu dashboard:
1. Ve a https://dashboard.ngrok.com/cloud-edge/domains
2. Crea o copia tu dominio estático
3. Agrégalo a tu `.env` como `NGROK_DOMAIN`

### 4. Instalar dependencias

Si aún no lo has hecho:

```bash
npm install
```

## Uso

### Iniciar servidor con ngrok

```bash
npm run ngrok
```

o

```bash
npm run prod
```

Verás una salida similar a:

```
🚀 Iniciando servidor de impresión...

🖨️  Servidor de impresión HTTP ejecutándose en puerto 3001
📡 Configurado para impresora en 192.168.1.200:9100
...

🔗 Iniciando túnel ngrok...

✅ Túnel ngrok establecido exitosamente!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 URL Pública: https://abc123.ngrok-free.app
🖨️  Puerto local: 3001

🔗 Endpoints públicos:
   • https://abc123.ngrok-free.app/test (GET)
   • https://abc123.ngrok-free.app/print (POST)
   • https://abc123.ngrok-free.app/test-print (POST)

💡 Usa esta URL en tu aplicación Vercel
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Dashboard: https://dashboard.ngrok.com
```

### Iniciar solo el servidor local (sin ngrok)

Si solo quieres probar localmente:

```bash
npm start
```

## Integración con tu aplicación

### Actualizar URL en tu app de Vercel

1. Copia la URL pública de ngrok (ejemplo: `https://abc123.ngrok-free.app`)
2. En tu aplicación Vercel, actualiza la variable de entorno o configuración que apunta al servidor de impresión
3. Reemplaza la URL antigua (ej: `https://192.168.1.47:3001`) con la nueva URL de ngrok

### Ejemplo de código en tu frontend:

```javascript
// Antes (certificado autofirmado)
const PRINT_SERVER_URL = 'https://192.168.1.47:3001';

// Después (ngrok)
const PRINT_SERVER_URL = 'https://abc123.ngrok-free.app';

// Para ngrok Pro con dominio estático
const PRINT_SERVER_URL = 'https://mi-impresora.ngrok-free.app';
```

### Hacer un request de prueba:

```javascript
const response = await fetch(`${PRINT_SERVER_URL}/test`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${PRINT_SERVER_SECRET}`
  }
});
```

## Planes de ngrok

### Plan Gratuito
- ✅ Túneles HTTPS ilimitados
- ⚠️  URL cambia cada vez que reinicias
- ✅ Perfecto para desarrollo y pruebas
- ✅ 40 conexiones/minuto

### Plan Pro (~$8/mes)
- ✅ **Dominio estático** (no cambia al reiniciar)
- ✅ Dominios personalizados
- ✅ Sin límite de conexiones
- ✅ IP estática
- ✅ Ideal para producción

## Troubleshooting

### Error: "NGROK_AUTHTOKEN no configurado"

**Solución:** Asegúrate de agregar tu authtoken al archivo `.env`:
```env
NGROK_AUTHTOKEN=tu_token_real_aqui
```

### Error: "Failed to validate tunnel authtoken"

**Solución:**
1. Verifica que el token sea correcto
2. Cópialo nuevamente desde https://dashboard.ngrok.com/get-started/your-authtoken
3. Asegúrate de no tener espacios extra en el `.env`

### Error: "Domain is already registered"

**Solución:** Si usas un dominio estático (`NGROK_DOMAIN`):
1. Asegúrate de que no tengas otra instancia de ngrok corriendo con ese dominio
2. Verifica que el dominio exista en tu dashboard de ngrok
3. Si usas plan gratuito, elimina `NGROK_DOMAIN` del `.env`

### La URL cambia cada vez que reinicio

**Solución:** Esto es normal con el plan gratuito. Para un dominio estático:
1. Actualiza a ngrok Pro
2. Configura tu dominio estático en el dashboard
3. Agrégalo a `NGROK_DOMAIN` en tu `.env`

### No puedo acceder desde Vercel

**Solución:**
1. Verifica que el túnel ngrok esté activo
2. Prueba la URL pública en tu navegador primero
3. Verifica que el token de autorización sea correcto
4. Revisa que CORS incluya el origen de Vercel (ya configurado: `https://la-casita.vercel.app`)

## Monitoreo

### Dashboard de ngrok

Accede a https://dashboard.ngrok.com para:
- Ver todos tus túneles activos
- Inspeccionar requests HTTP en tiempo real
- Ver estadísticas de uso
- Gestionar dominios estáticos
- Revisar logs

### Logs del servidor

Todos los requests se registran en la consola donde ejecutaste `npm run ngrok`.

## Seguridad

### Recomendaciones:

1. **Mantén tu authtoken seguro**: No lo compartas ni lo agregues a git
2. **Usa Bearer token**: Todos los endpoints (excepto `/test`) requieren autenticación
3. **CORS configurado**: Solo permite requests desde tu dominio de Vercel
4. **Monitorea el dashboard**: Revisa regularmente la actividad en tu túnel

### El archivo `.env` está en `.gitignore`

Asegúrate de que tu `.env` NUNCA se suba a git:

```bash
# Verifica que .gitignore incluya:
.env
```

## Comandos útiles

```bash
# Iniciar con ngrok (recomendado)
npm run ngrok

# Iniciar solo servidor local
npm start

# Desarrollo con auto-restart
npm run dev

# Ver estado de ngrok
# Visita: http://localhost:4040 (si usas ngrok CLI)
```

## Próximos pasos

1. ✅ Configura tu `NGROK_AUTHTOKEN` en `.env`
2. ✅ Ejecuta `npm run ngrok`
3. ✅ Copia la URL pública
4. ✅ Actualiza tu app de Vercel con la nueva URL
5. ✅ Prueba un request a `/test`
6. ✅ ¡Imprime tu primera comanda!

---

**¿Preguntas?** Consulta la documentación oficial: https://ngrok.com/docs
