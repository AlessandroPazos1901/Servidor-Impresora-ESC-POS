# 🖥️ Guía de Migración para Otras Computadoras

Esta guía es específica para migrar el sistema de impresión en **otras computadoras** que ya tienen instalado el sistema antiguo (con certificados autofirmados).

---

##  Información General

### Lo que necesitas:
-  Token de ngrok (uno solo para todas las computadoras)
-  10-15 minutos por computadora
-  Acceso remoto o físico a cada computadora

### Lo que NO necesitas:
-  Reinstalar Node.js
-  Reinstalar Docker
-  Cambiar configuración de la impresora
-  Reconfigurar el sistema desde cero

---

##  Pasos de Migración (Versión Rápida)

### Paso 1: Conectarse a la computadora remota

Usa escritorio remoto, TeamViewer, AnyDesk o acceso físico.

### Paso 2: Detener el servidor actual

1. Si el launcher está corriendo, **cierra la ventana del launcher** (click en )
2. Si hay un proceso corriendo, el launcher preguntará si quieres detenerlo → **Sí**

### Paso 3: Actualizar archivos del proyecto

**Opción A: Si tienes acceso a Git**
```bash
cd D:\AlShepAI\print-server
git pull origin main
```

**Opción B: Si NO tienes Git (Manual)**
1. Descarga el ZIP del proyecto actualizado
2. Extrae y **reemplaza** estos archivos:
   - `server.js`
   - `start-ngrok.js`
   - `launcher.py`
   - `package.json`
   - `docker-entrypoint.sh`
   - `docker-compose.yml`
   - `Dockerfile`

### Paso 4: Instalar nuevas dependencias

Abre CMD en `D:\AlShepAI\print-server` y ejecuta:

```bash
npm install
```

### Paso 5: Actualizar archivo `.env`

1. Abre el archivo `.env` con un editor de texto (Notepad, Notepad++, VSCode)
2. **Agrega estas nuevas líneas al final**:

```env
# Puerto del servidor local
PORT=3001

# Token de ngrok (usa el mismo para todas las computadoras)
NGROK_AUTHTOKEN=tu_token_de_ngrok_aqui

# Dominio estático (opcional - solo si tienes ngrok Pro)
NGROK_DOMAIN=

# Usar ngrok (true para acceso público, false para solo local)
USE_NGROK=true
```

3. **Reemplaza** `tu_token_de_ngrok_aqui` con tu token real
4. **Guarda** el archivo

### Paso 6: (Opcional) Si usas Docker, reconstruir imagen

```bash
cd D:\AlShepAI\print-server
docker-compose down
docker-compose build --no-cache
```

### Paso 7: Iniciar el servidor

1. Doble click en `Iniciar Servidor.bat`
2. Click en **▶️ INICIAR SERVIDOR**
3. Espera unos segundos...
4. Verás un **popup con la URL pública** de ngrok 🎉
5. **Copia esa URL** (click en " Copiar URL")

### Paso 8: Probar que funciona

Abre un navegador y ve a:
```
https://tu-url-de-ngrok.ngrok-free.app/test
```

Deberías ver:
```json
{"message":"Servidor de impresión HTTPS funcionando correctamente"}
```

 **¡Listo!** El servidor está migrando exitosamente.

---

## 📁 Resumen de Archivos a Copiar/Actualizar

Si haces la migración manual (sin Git):

### Archivos que DEBES copiar (nuevos o actualizados):
```
D:\AlShepAI\print-server\
├── server.js              ← ACTUALIZADO (HTTP en lugar de HTTPS)
├── start-ngrok.js         ← NUEVO
├── launcher.py            ← ACTUALIZADO (soporte para ngrok)
├── package.json           ← ACTUALIZADO (nuevos scripts)
├── docker-entrypoint.sh   ← ACTUALIZADO (soporte ngrok)
├── docker-compose.yml     ← ACTUALIZADO (variables ngrok)
├── Dockerfile             ← ACTUALIZADO (sin certificados)
└── .env.example           ← NUEVO (plantilla)
```

### Archivos que NO debes tocar:
```
├── .env                   ← Solo AGREGAR líneas, no reemplazar
├── node_modules/          ← Se actualiza con npm install
└── logs/                  ← Dejar como está
```

### Archivos que puedes ELIMINAR (ya no se usan):
```
├── 192.168.1.47.pem       ← Certificados viejos (ya no necesarios)
├── 192.168.1.47-key.pem   ← Certificados viejos (ya no necesarios)
```

---

## 🔧 Configuración del `.env`

Tu archivo `.env` final debe verse así:

```env
# Configuración de la Impresora
PRINTER_IP=192.168.1.200
PRINTER_PORT=9100

# Puerto del servidor local
PORT=3001

# Token Secreto para la Autorización
PRINT_SERVER_SECRET=0ad6c635-04c4-4e3f-9d4f-ae3a24fb378a

# Configuración de ngrok
NGROK_AUTHTOKEN=2pXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX   ← TU TOKEN AQUÍ
NGROK_DOMAIN=                                         ← Vacío si usas plan gratuito

# Docker
USE_NGROK=true
```

---

## ❓ Preguntas Frecuentes

### ¿Puedo usar el mismo token de ngrok en todas las computadoras?

**Sí**. Un solo token sirve para múltiples túneles. Cada computadora tendrá su propia URL única.

### ¿Qué pasa con la URL anterior (https://192.168.1.47:3001)?

Ya no funcionará. Ahora cada computadora tendrá su propia URL de ngrok, por ejemplo:
- Computadora 1: `https://abc123.ngrok-free.app`
- Computadora 2: `https://def456.ngrok-free.app`
- Computadora 3: `https://ghi789.ngrok-free.app`

### ¿Necesito cambiar algo en mi aplicación de Vercel?

Sí, debes actualizar la URL del servidor de impresión con la nueva URL de ngrok de cada local.

**Recomendación:** Si tienes múltiples locales, considera:
1. Actualizar a ngrok Pro y tener un dominio estático por local
2. O crear una variable de entorno en cada local que especifique su URL

### ¿El launcher seguirá funcionando igual?

¡Sí! El launcher ahora:
-  Detecta automáticamente si tienes ngrok configurado
-  Muestra un popup con la URL pública cuando inicia
-  Permite copiar la URL con un click
-  Verifica el servidor en la URL de ngrok

### ¿Qué pasa si no configuro el token de ngrok?

El launcher iniciará el servidor en modo **HTTP local** (sin ngrok):
-  Solo accesible en `http://localhost:3001`
-  NO accesible desde internet
-  NO accesible desde tu app de Vercel

### ¿Puedo hacer rollback si algo sale mal?

**Sí**. Guarda una copia del archivo `.env` original antes de modificarlo:

```bash
copy .env .env.backup
```

Si algo sale mal:
1. Restaura el `.env`: `copy .env.backup .env`
2. Reemplaza `server.js` con la versión antigua
3. Reinicia el launcher

---

## 🐛 Troubleshooting

### El launcher no inicia

**Problema:** Doble click en `Iniciar Servidor.bat` no hace nada

**Solución:**
1. Abre CMD en la carpeta del proyecto
2. Ejecuta: `python launcher.py`
3. Mira los errores que aparecen

### No veo el popup con la URL de ngrok

**Problema:** El servidor inicia pero no sale el popup

**Solución:**
1. Mira los logs en el launcher
2. Busca una línea que diga: ` URL Pública: https://...`
3. Copia esa URL manualmente

### Error: "NGROK_AUTHTOKEN no configurado"

**Problema:** El servidor inicia pero sin ngrok

**Solución:**
1. Verifica que el `.env` tenga la línea `NGROK_AUTHTOKEN=...`
2. Verifica que el token NO sea `tu_authtoken_aqui`
3. Verifica que no haya espacios extra

### El servidor no responde en la URL de ngrok

**Problema:** La URL de ngrok muestra "ERR_NGROK_3200"

**Solución:**
1. El servidor local no está corriendo
2. Reinicia el launcher completamente
3. Espera 10-15 segundos después de ver "Servidor iniciado"
4. Verifica que el puerto 3001 no esté ocupado

### Docker no inicia

**Problema:** Error al iniciar con Docker

**Solución:**
```bash
# Limpiar contenedores viejos
docker ps -a
docker rm thermal-printer

# Reconstruir imagen
docker-compose build --no-cache
docker-compose up -d

# Ver logs
docker logs -f thermal-printer-server
```

---

##  Checklist de Verificación Post-Migración

Después de migrar, verifica:

- [ ] El launcher inicia sin errores
- [ ] Al hacer click en "INICIAR SERVIDOR", el servidor arranca
- [ ] Aparece un popup con la URL pública de ngrok
- [ ] La URL de ngrok responde al acceder desde un navegador
- [ ] El endpoint `/test` devuelve un JSON correctamente
- [ ] Puedes copiar la URL con el botón " Copiar URL"
- [ ] La impresora responde a comandos de prueba
- [ ] Los logs muestran actividad correctamente

---

##  Ejemplo de Logs Exitosos

Cuando todo funciona correctamente, verás logs como estos:

```
[14:23:45]  Iniciando servidor...
[14:23:46]  Iniciando con ngrok...
[14:23:47]  Servidor de impresión HTTP ejecutándose en puerto 3001
[14:23:50]  Túnel ngrok establecido exitosamente!
[14:23:50]  URL Pública: https://abc-def-ghi.ngrok-free.app
[14:23:50]  Copia esta URL y úsala en tu aplicación
[14:23:50]  Servidor iniciado correctamente
[14:23:50] ⏳ Esperando URL pública de ngrok...
```

---

## 🆘 Soporte Adicional

Si tienes problemas:

1. **Revisa los logs del launcher**: Todo aparece en la ventana
2. **Revisa el `.env`**: Asegúrate de que el token esté bien configurado
3. **Prueba manualmente**: Abre CMD y ejecuta `npm run ngrok`
4. **Verifica internet**: ngrok necesita conexión a internet
5. **Verifica firewall**: Asegúrate de que no bloquee Node.js

---

##  Script de Migración Automática (Opcional)

Si quieres automatizar la migración, crea un archivo `migrate.bat`:

```batch
@echo off
echo ====================================
echo   Migracion a ngrok
echo ====================================
echo.

REM Backup del .env
copy .env .env.backup.%date:~-4%%date:~3,2%%date:~0,2%

REM Actualizar código
git pull origin main

REM Instalar dependencias
npm install

echo.
echo ====================================
echo Migracion completada!
echo ====================================
echo.
echo IMPORTANTE: Edita el archivo .env y agrega tu NGROK_AUTHTOKEN
echo.
pause
```

Ejecuta el `.bat` y luego solo edita el `.env`.

---

**¡Listo!** Con esta guía puedes migrar todas tus computadoras al nuevo sistema con ngrok.

¿Necesitas ayuda? Revisa los logs del launcher y consulta la sección de Troubleshooting.
