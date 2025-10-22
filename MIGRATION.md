# Guía de Migración - Sistema Antiguo a ngrok

Esta guía te ayudará a migrar tus instalaciones existentes (con certificados autofirmados) al nuevo sistema con ngrok.

## 📋 Tabla de Contenidos

- [Resumen de Cambios](#resumen-de-cambios)
- [Migración Rápida (5 minutos)](#migración-rápida-5-minutos)
- [Migración en Computadoras Remotas](#migración-en-computadoras-remotas)
- [Rollback (Volver al Sistema Antiguo)](#rollback-volver-al-sistema-antiguo)
- [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Resumen de Cambios

### ¿Qué ha cambiado?

| Aspecto | Sistema Antiguo | Sistema Nuevo |
|---------|----------------|---------------|
| **Protocolo** | HTTPS con certificados autofirmados | HTTP + ngrok (que provee HTTPS) |
| **Certificados** | 192.168.1.47.pem/key requeridos | No necesarios |
| **URL de acceso** | `https://192.168.1.47:3001` | `https://tu-dominio.ngrok-free.app` |
| **Advertencias SSL** | Sí, en cada navegador | No |
| **Acceso público** | Solo red local | Acceso desde cualquier lugar |
| **Dominio estático** | Sí (IP local) | Sí (con ngrok Pro) |

### ¿Por qué migrar?

✅ **Sin advertencias de certificado**
✅ **Acceso desde cualquier lugar** (no solo red local)
✅ **Más fácil de integrar** con servicios externos (Vercel, etc.)
✅ **Dominio estático con ngrok Pro** (no cambia al reiniciar)
✅ **Dashboard de inspección** de requests en tiempo real
✅ **Menos configuración** (no más certificados SSL)

---

## Migración Rápida (5 minutos)

### Para instalaciones NO-Docker (npm)

1. **Detener el servidor actual:**
   ```bash
   # Si está corriendo, detén el proceso
   # Ctrl+C en la terminal donde corre
   ```

2. **Actualizar el código:**
   ```bash
   cd /ruta/a/tu/print-server
   git pull origin main
   # O descarga el código actualizado manualmente
   ```

3. **Instalar nuevas dependencias:**
   ```bash
   npm install
   ```

4. **Configurar ngrok en `.env`:**
   ```bash
   # Edita tu .env existente y agrega:
   nano .env  # o usa notepad en Windows
   ```

   Agrega estas líneas:
   ```env
   # Token de ngrok (obtén el tuyo en https://dashboard.ngrok.com)
   NGROK_AUTHTOKEN=tu_token_aqui

   # Dominio estático (opcional - solo ngrok Pro)
   NGROK_DOMAIN=
   ```

5. **Iniciar con ngrok:**
   ```bash
   npm run ngrok
   ```

6. **Copiar la URL pública:**
   - Verás algo como: `🌐 URL Pública: https://abc123.ngrok-free.app`
   - Copia esta URL y úsala en tu aplicación Vercel

✅ **¡Listo!** Tu servidor ahora está accesible públicamente con HTTPS.

---

### Para instalaciones con Docker

1. **Detener el contenedor actual:**
   ```bash
   docker-compose down
   # o
   docker stop thermal-printer-server
   ```

2. **Actualizar el código:**
   ```bash
   cd /ruta/a/tu/print-server
   git pull origin main
   # O descarga el código actualizado
   ```

3. **Actualizar tu archivo `.env`:**
   ```bash
   # Edita tu .env existente
   nano .env
   ```

   Agrega estas nuevas variables:
   ```env
   # Puerto (ya debería estar, pero verifica)
   PORT=3001

   # Token de ngrok (REQUERIDO)
   NGROK_AUTHTOKEN=tu_token_de_ngrok_aqui

   # Dominio estático (OPCIONAL - solo ngrok Pro)
   NGROK_DOMAIN=

   # Activar ngrok (por defecto: true)
   USE_NGROK=true
   ```

4. **Reconstruir y reiniciar el contenedor:**
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

5. **Ver los logs y obtener la URL pública:**
   ```bash
   docker logs -f thermal-printer-server
   ```

   Verás algo como:
   ```
   🌐 URL Pública: https://abc123.ngrok-free.app
   ```

6. **Actualizar tu aplicación:**
   - Copia la URL pública de ngrok
   - Reemplaza la URL antigua (`https://192.168.1.47:3001`) en tu app de Vercel

✅ **¡Listo!** Docker ahora usa ngrok automáticamente.

---

## Migración en Computadoras Remotas

Si tienes el servidor instalado en múltiples computadoras, sigue estos pasos:

### Opción A: Actualización Manual (Recomendada)

1. **Conéctate a la computadora remota** (SSH, escritorio remoto, etc.)

2. **Navega al directorio del proyecto:**
   ```bash
   cd /ruta/donde/esta/print-server
   ```

3. **Guarda tu `.env` actual:**
   ```bash
   cp .env .env.backup
   ```

4. **Actualiza el código:**
   ```bash
   git pull origin main
   # O copia los archivos actualizados manualmente
   ```

5. **Instala dependencias (si NO usas Docker):**
   ```bash
   npm install
   ```

6. **Actualiza el `.env`:**

   **Si usas ngrok (recomendado):**
   ```bash
   nano .env
   ```
   Agrega:
   ```env
   NGROK_AUTHTOKEN=tu_token_aqui
   NGROK_DOMAIN=  # Opcional
   USE_NGROK=true
   ```

   **Si NO quieres usar ngrok (solo red local):**
   ```env
   USE_NGROK=false
   ```

7. **Reinicia el servidor:**

   **Docker:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   docker logs -f thermal-printer-server
   ```

   **npm:**
   ```bash
   npm run ngrok  # Con ngrok
   # o
   npm start      # Sin ngrok (solo local HTTP)
   ```

### Opción B: Script de Migración Automática

Si tienes muchas instalaciones, puedes usar este script:

```bash
#!/bin/bash
# migrate.sh - Script de migración automática

echo "🔄 Iniciando migración a ngrok..."

# Backup del .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup de .env creado"

# Actualizar código
git pull origin main
echo "✅ Código actualizado"

# Instalar dependencias (solo si NO es Docker)
if [ ! -f "docker-compose.yml" ]; then
    npm install
    echo "✅ Dependencias actualizadas"
fi

# Verificar si ya tiene NGROK_AUTHTOKEN
if grep -q "NGROK_AUTHTOKEN" .env; then
    echo "⚠️  NGROK_AUTHTOKEN ya existe en .env"
else
    echo "" >> .env
    echo "# ngrok configuration" >> .env
    echo "NGROK_AUTHTOKEN=PONER_TOKEN_AQUI" >> .env
    echo "NGROK_DOMAIN=" >> .env
    echo "USE_NGROK=true" >> .env
    echo "✅ Variables de ngrok agregadas a .env"
    echo "⚠️  IMPORTANTE: Edita .env y agrega tu NGROK_AUTHTOKEN"
fi

echo ""
echo "✅ Migración completada"
echo ""
echo "📝 Próximos pasos:"
echo "1. Edita .env y agrega tu NGROK_AUTHTOKEN"
echo "2. Reinicia el servidor:"
if [ -f "docker-compose.yml" ]; then
    echo "   docker-compose down && docker-compose build && docker-compose up -d"
else
    echo "   npm run ngrok"
fi
```

Guárdalo como `migrate.sh`, hazlo ejecutable y ejecútalo:

```bash
chmod +x migrate.sh
./migrate.sh
```

---

## Rollback (Volver al Sistema Antiguo)

Si necesitas volver al sistema anterior:

### Docker

1. **Edita tu `.env`:**
   ```env
   USE_NGROK=false
   ```

2. **Restaura certificados (si los eliminaste):**
   ```bash
   # Recupera de tu backup o regenera
   ```

3. **Reinicia:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### npm

1. **Vuelve al commit anterior:**
   ```bash
   git checkout <commit-hash-anterior>
   ```

2. **Reinstala dependencias:**
   ```bash
   npm install
   ```

3. **Inicia con el método antiguo:**
   ```bash
   npm start
   ```

---

## Preguntas Frecuentes

### ¿Puedo usar el sistema sin ngrok?

**Sí**, pero solo con acceso HTTP local. Configura en tu `.env`:

```env
USE_NGROK=false
```

El servidor iniciará en `http://localhost:3001` (solo accesible localmente).

### ¿Necesito ngrok Pro?

**No es obligatorio**, pero tiene ventajas:

| Plan | Ventajas | Desventajas |
|------|----------|-------------|
| **Gratuito** | Funciona perfecto | URL cambia en cada reinicio |
| **Pro** | Dominio estático (no cambia) | Costo (~$8/mes) |

Para pruebas y desarrollo, el plan gratuito es suficiente. Para producción, recomendamos Pro.

### ¿Qué pasa con mis certificados SSL?

Ya no los necesitas. ngrok se encarga del SSL/TLS automáticamente. Puedes eliminar los archivos `.pem` si quieres (pero guárdalos por si necesitas rollback).

### ¿Cómo obtengo mi NGROK_AUTHTOKEN?

1. Ve a https://ngrok.com y crea una cuenta (gratis)
2. Inicia sesión en https://dashboard.ngrok.com
3. Ve a "Your Authtoken": https://dashboard.ngrok.com/get-started/your-authtoken
4. Copia tu token
5. Agrégalo al `.env`

### ¿El mismo NGROK_AUTHTOKEN sirve para todas las computadoras?

**Sí**, puedes usar el mismo token en todas tus instalaciones. Cada una creará su propio túnel con su propia URL.

### ¿Cómo sé si la migración fue exitosa?

Verifica estos puntos:

✅ El servidor inicia sin errores
✅ Los logs muestran una URL de ngrok pública
✅ Puedes acceder a `https://tu-url-ngrok/test` desde tu navegador
✅ Tu app de Vercel puede hacer requests al servidor
✅ La impresora funciona correctamente

### ¿Qué hago si tengo problemas?

1. **Verifica los logs:**
   ```bash
   # Docker
   docker logs -f thermal-printer-server

   # npm
   # Verás los logs en la consola
   ```

2. **Verifica tu `.env`:**
   - ¿Está configurado `NGROK_AUTHTOKEN`?
   - ¿Es válido el token?

3. **Prueba sin ngrok temporalmente:**
   ```env
   USE_NGROK=false
   ```

4. **Consulta los logs de errores:**
   ```bash
   cat logs/errors.log
   ```

### ¿Necesito cambiar algo en mi app de Vercel?

Sí, solo la URL base:

```javascript
// Antes
const PRINT_SERVER_URL = 'https://192.168.1.47:3001';

// Después
const PRINT_SERVER_URL = 'https://tu-url-ngrok.app';
```

El resto (endpoints, autenticación, formato de datos) **no cambia**.

### ¿Los cambios afectan el formato de impresión?

**No**. La lógica de impresión (ESC/POS) permanece exactamente igual. Solo cambió cómo el servidor se expone a internet.

### ¿Puedo tener múltiples instalaciones con el mismo dominio de ngrok?

**No**. Cada instalación necesita su propio túnel ngrok con su propia URL. Si tienes ngrok Pro y múltiples impresoras, necesitas múltiples dominios estáticos.

---

## Checklist Final

Después de migrar, verifica:

- [ ] El servidor inicia correctamente
- [ ] Los logs muestran la URL pública de ngrok
- [ ] Puedes acceder a la URL desde tu navegador
- [ ] El endpoint `/test` responde correctamente
- [ ] Tu app de Vercel usa la nueva URL
- [ ] Las impresiones funcionan correctamente
- [ ] No hay errores en los logs
- [ ] (Opcional) Has actualizado a ngrok Pro para dominio estático

---

## Soporte

Si encuentras problemas:

1. Revisa los logs: `docker logs thermal-printer-server` o consola npm
2. Verifica tu configuración de `.env`
3. Consulta [README-NGROK.md](./README-NGROK.md) para más detalles
4. Revisa el dashboard de ngrok: https://dashboard.ngrok.com

---

**¡Felicitaciones!** Has migrado exitosamente al nuevo sistema con ngrok. 🎉
