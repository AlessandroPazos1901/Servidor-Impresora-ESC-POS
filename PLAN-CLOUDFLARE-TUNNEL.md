#  Plan de Migración: ngrok → Cloudflare Tunnel

Este documento describe el plan organizado en fases para migrar de ngrok a Cloudflare Tunnel cuando sea necesario.

---

##  ¿Cuándo considerar esta migración?

-  Tienes 5+ locales y el costo de ngrok Pro es significativo ($40+/mes)
-  Quieres una solución 100% gratuita a largo plazo
-  Necesitas mejor performance y confiabilidad empresarial
-  Quieres más control (access policies, analytics, etc.)

---

##  Comparación Rápida

| Aspecto | ngrok Pro | Cloudflare Tunnel |
|---------|-----------|-------------------|
| **Costo** | $8/mes por local | **Gratis** |
| **Dominio estático** | Sí | Sí |
| **Setup inicial** | Fácil | Medio |
| **Performance** | Bueno | Excelente |
| **DDoS protection** | No | Sí |

---

## 🗂️ Fases de Implementación

### **FASE 0: Preparación (1 día)**

**Objetivo:** Familiarizarte con Cloudflare Tunnel sin romper nada

**Tareas:**
1. [ ] Crear cuenta gratuita en Cloudflare (https://dash.cloudflare.com)
2. [ ] Leer documentación oficial: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
3. [ ] Instalar `cloudflared` en UNA computadora de prueba
4. [ ] Crear un tunnel de prueba manualmente (CLI)
5. [ ] Verificar que funciona con tu servidor local

**Comandos de prueba:**
```bash
# Instalar cloudflared (Windows)
# Descargar de: https://github.com/cloudflare/cloudflared/releases

# Login (solo primera vez)
cloudflared tunnel login

# Crear tunnel de prueba
cloudflared tunnel create print-server-test

# Ejecutar tunnel
cloudflared tunnel --url http://localhost:3001
```

**Resultado esperado:** Ver tu servidor accesible desde una URL de Cloudflare

---

### **FASE 1: Desarrollo del Script (2-3 días)**

**Objetivo:** Crear `start-cloudflare.js` similar a `start-ngrok.js`

#### **Tarea 1.1: Instalar cloudflared programáticamente**

Crear script para instalar/verificar `cloudflared` automáticamente:

```javascript
// install-cloudflared.js
const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');

async function installCloudflared() {
  const platform = os.platform();
  const arch = os.arch();

  // Detectar si ya está instalado
  try {
    execSync('cloudflared --version', { stdio: 'pipe' });
    console.log('cloudflared ya está instalado');
    return true;
  } catch {
    console.log('Descargando cloudflared...');
  }

  // Descargar según plataforma
  const downloadUrl = getDownloadUrl(platform, arch);
  // ... implementar descarga e instalación
}
```

#### **Tarea 1.2: Crear start-cloudflare.js**

```javascript
// start-cloudflare.js
require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const TUNNEL_NAME = process.env.CLOUDFLARE_TUNNEL_NAME;
const TUNNEL_TOKEN = process.env.CLOUDFLARE_TUNNEL_TOKEN;

// Validaciones
if (!TUNNEL_TOKEN) {
  console.error('Error: CLOUDFLARE_TUNNEL_TOKEN no configurado');
  process.exit(1);
}

console.log('Iniciando servidor...');

// Iniciar servidor Node.js
const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: process.env
});

// Esperar a que el servidor esté listo
setTimeout(async () => {
  console.log('\n Iniciando Cloudflare Tunnel...\n');

  // Iniciar cloudflared
  const tunnelProcess = spawn('cloudflared', [
    'tunnel',
    'run',
    '--token', TUNNEL_TOKEN
  ], {
    stdio: 'pipe'
  });

  tunnelProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);

    // Detectar URL del tunnel
    if (output.includes('https://')) {
      const urlMatch = output.match(/https:\/\/[^\s]+/);
      if (urlMatch) {
        console.log('\n Tunnel establecido!');
        console.log(` URL Pública: ${urlMatch[0]}\n`);
      }
    }
  });

}, 3000);

// Manejo de cierre
process.on('SIGINT', () => {
  console.log('\n Cerrando servidor y tunnel...');
  serverProcess.kill();
  process.exit(0);
});
```

#### **Tarea 1.3: Actualizar .env.example**

```env
# ===========================================
# CLOUDFLARE TUNNEL (Alternativa a ngrok)
# ===========================================

# Token del tunnel (obtener de Cloudflare Dashboard)
CLOUDFLARE_TUNNEL_TOKEN=tu_token_de_cloudflare_aqui

# Nombre del tunnel (opcional)
CLOUDFLARE_TUNNEL_NAME=print-server-local1

# Activar Cloudflare Tunnel (true/false)
USE_CLOUDFLARE=false
```

**Entregables:**
- [ ] `start-cloudflare.js` funcional
- [ ] `install-cloudflared.js` (script de instalación)
- [ ] `.env.example` actualizado
- [ ] Pruebas en computadora de desarrollo

---

### **FASE 2: Integración con Launcher (1-2 días)**

**Objetivo:** Actualizar `launcher.py` para soportar Cloudflare Tunnel

#### **Tarea 2.1: Detectar modo a usar**

Modificar `load_env_config()` en launcher.py:

```python
def load_env_config(self):
    config = {
        'mode': 'HTTP + ngrok',
        'tunnel_type': 'ngrok',  # o 'cloudflare'
        'has_ngrok_token': False,
        'has_cloudflare_token': False
    }

    # Leer .env
    if os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                if 'NGROK_AUTHTOKEN' in line and value != 'tu_authtoken_aqui':
                    config['has_ngrok_token'] = True
                elif 'CLOUDFLARE_TUNNEL_TOKEN' in line and value != 'tu_token_aqui':
                    config['has_cloudflare_token'] = True
                    config['tunnel_type'] = 'cloudflare'
                elif 'USE_CLOUDFLARE=true' in line:
                    config['tunnel_type'] = 'cloudflare'

    return config
```

#### **Tarea 2.2: Actualizar start_server()**

```python
def run_server():
    # ... código existente ...

    # Decidir qué tunnel usar
    tunnel_type = self.config.get('tunnel_type', 'ngrok')

    if tunnel_type == 'cloudflare':
        self.root.after(0, lambda: self.log_message("☁️ Iniciando con Cloudflare Tunnel..."))
        cmd = "npm run cloudflare"
    elif has_ngrok:
        self.root.after(0, lambda: self.log_message(" Iniciando con ngrok..."))
        cmd = "npm run ngrok"
    else:
        self.root.after(0, lambda: self.log_message(" Sin tunnel, servidor local"))
        cmd = "npm start"
```

#### **Tarea 2.3: Detectar URL de Cloudflare**

```python
# En el loop de lectura de output
if 'trycloudflare.com' in line_stripped or 'Registered tunnel' in line_stripped:
    import re
    url_match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line_stripped)
    if url_match:
        self.ngrok_url = url_match.group(0)
        self.root.after(0, lambda u=self.ngrok_url: self.show_ngrok_url(u))
```

**Entregables:**
- [ ] Launcher detecta automáticamente Cloudflare vs ngrok
- [ ] Muestra URL de Cloudflare en logs
- [ ] Panel de información muestra el tipo correcto

---

### **FASE 3: Configuración en Cloudflare Dashboard (1 día)**

**Objetivo:** Configurar tunnels permanentes para cada local

#### **Tarea 3.1: Crear tunnel por cada local**

En Cloudflare Dashboard (https://one.dash.cloudflare.com/):

1. Ir a **Zero Trust** → **Networks** → **Tunnels**
2. Click en **Create a tunnel**
3. Nombre: `print-server-local1` (o nombre descriptivo)
4. Copiar el **Token** generado
5. Configurar subdomain (opcional):
   - Public hostname: `impresora-local1.tudominio.com`
   - Service: `http://localhost:3001`

Repetir para cada local:
- Local 1: `print-server-local1`
- Local 2: `print-server-local2`
- Local 3: `print-server-local3`
- etc.

#### **Tarea 3.2: Documentar tokens**

Crear una tabla con los tokens:

| Local | Nombre Tunnel | Token | URL |
|-------|--------------|-------|-----|
| Local Centro | print-server-centro | eyJh... | impresora-centro.tudominio.com |
| Local Norte | print-server-norte | eyJh... | impresora-norte.tudominio.com |
| Local Sur | print-server-sur | eyJh... | impresora-sur.tudominio.com |

**Entregables:**
- [ ] Tunnels creados en Cloudflare Dashboard
- [ ] Tokens documentados en lugar seguro
- [ ] URLs asignadas (si usas dominio propio)

---

### **FASE 4: Scripts de Migración (1-2 días)**

**Objetivo:** Crear scripts para facilitar la migración en locales existentes

#### **Tarea 4.1: Crear migrate-to-cloudflare.bat**

```batch
@echo off
echo ====================================
echo   Migracion a Cloudflare Tunnel
echo ====================================
echo.

REM Backup del .env
copy .env .env.backup.%date:~-4%%date:~3,2%%date:~0,2%

REM Instalar cloudflared si no existe
echo Verificando cloudflared...
node install-cloudflared.js

REM Actualizar código
git pull origin main
npm install

echo.
echo ====================================
echo Configuracion:
echo ====================================
echo.
echo 1. Edita .env y agrega:
echo    CLOUDFLARE_TUNNEL_TOKEN=tu_token_aqui
echo    USE_CLOUDFLARE=true
echo.
echo 2. Comenta o elimina:
echo    NGROK_AUTHTOKEN
echo.
echo 3. Reinicia el launcher
echo.
pause
```

#### **Tarea 4.2: Crear MIGRATION-CLOUDFLARE.md**

Documento completo con:
- Paso a paso para migrar de ngrok a Cloudflare
- Screenshots del dashboard de Cloudflare
- Troubleshooting común
- Rollback si hay problemas

**Entregables:**
- [ ] Script de migración automatizado
- [ ] Documentación detallada
- [ ] Guía de troubleshooting

---

### **FASE 5: Piloto en 1 Local (1 semana)**

**Objetivo:** Probar en producción con 1 local real

#### **Tarea 5.1: Seleccionar local piloto**

Elegir el local con:
-  Menos tráfico (por si hay problemas)
-  Personal técnico disponible
-  Fácil acceso físico (por si necesitas revertir)

#### **Tarea 5.2: Ejecutar migración**

1. Coordinar con el local (evitar horas pico)
2. Backup completo del `.env`
3. Ejecutar `migrate-to-cloudflare.bat`
4. Configurar token en `.env`
5. Reiniciar launcher
6. Verificar funcionamiento:
   - [ ] Servidor inicia correctamente
   - [ ] URL de Cloudflare funciona
   - [ ] Impresiones funcionan
   - [ ] No hay errores en logs

#### **Tarea 5.3: Monitoreo intensivo**

Durante 1 semana:
- Revisar logs diariamente
- Preguntar al personal si hay problemas
- Medir performance (tiempo de respuesta)
- Documentar cualquier issue

**Entregables:**
- [ ] Local piloto funcionando con Cloudflare
- [ ] Reporte de performance vs ngrok
- [ ] Issues encontrados y solucionados
- [ ] Aprobación para continuar

---

### **FASE 6: Migración Gradual (2-4 semanas)**

**Objetivo:** Migrar todos los locales de forma escalonada

#### **Estrategia:**

**Semana 1:** Migrar 2-3 locales adicionales
**Semana 2:** Migrar 3-5 locales más
**Semana 3:** Migrar locales restantes
**Semana 4:** Buffer para resolver problemas

#### **Por cada local:**

1. [ ] Notificar al personal con anticipación
2. [ ] Conectarse remotamente o visitar
3. [ ] Ejecutar script de migración
4. [ ] Configurar token específico del local
5. [ ] Verificar funcionamiento
6. [ ] Actualizar documentación (qué URL usa cada local)
7. [ ] Capacitar al personal (si es necesario)

#### **Checklist post-migración:**

- [ ] Todos los locales funcionando con Cloudflare
- [ ] Cancelar suscripciones de ngrok Pro
- [ ] Actualizar URLs en aplicación Vercel (si es necesario)
- [ ] Documentar configuración final de cada local

**Entregables:**
- [ ] 100% de locales migrados
- [ ] Tabla actualizada con tokens y URLs
- [ ] Documentación de troubleshooting actualizada
- [ ] Cancelación de ngrok Pro confirmada

---

### **FASE 7: Optimización y Refinamiento (continuo)**

**Objetivo:** Mejorar la implementación basándose en uso real

#### **Posibles mejoras:**

1. **Auto-restart con watchdog**
   ```javascript
   // Reiniciar tunnel si falla
   tunnelProcess.on('exit', (code) => {
     if (code !== 0) {
       console.log(' Tunnel falló, reiniciando...');
       setTimeout(startTunnel, 5000);
     }
   });
   ```

2. **Monitoreo de salud**
   ```javascript
   // Ping periódico para verificar que funciona
   setInterval(() => {
     fetch(`${tunnelUrl}/test`)
       .then(() => console.log(' Tunnel healthy'))
       .catch(() => console.log('Tunnel down'));
   }, 60000);
   ```

3. **Métricas y analytics**
   - Usar Cloudflare Analytics
   - Logs centralizados
   - Alertas si un local se cae

4. **Access Policies (opcional)**
   - Restringir acceso por país
   - Requerir autenticación adicional
   - Rate limiting avanzado

**Entregables:**
- [ ] Sistema estable en producción
- [ ] Monitoreo automatizado
- [ ] Documentación final completa

---

## 📦 Estructura de Archivos Final

Después de la implementación completa:

```
print-server/
├── server.js                          # Servidor HTTP
├── start-ngrok.js                     # Tunnel con ngrok (actual)
├── start-cloudflare.js                # Tunnel con Cloudflare (nuevo)
├── install-cloudflared.js             # Instalador de cloudflared
├── launcher.py                        # Interfaz gráfica (soporta ambos)
├── migrate-to-cloudflare.bat          # Script de migración
├── package.json                       # Con script "cloudflare"
├── .env                               # Configuración (con token CF)
├── .env.example                       # Template actualizado
├── README-CLOUDFLARE.md               # Guía de uso
├── MIGRATION-CLOUDFLARE.md            # Guía de migración
└── PLAN-CLOUDFLARE-TUNNEL.md          # Este documento
```

---

## 🛠️ Cambios en package.json

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "ngrok": "node start-ngrok.js",
    "cloudflare": "node start-cloudflare.js",
    "prod": "node start-ngrok.js"
  }
}
```

---

## 🔧 Configuración del .env (después de migración)

```env
# Configuración de la Impresora
PRINTER_IP=192.168.1.200
PRINTER_PORT=9100
PORT=3001

# Token Secreto para Autorización
PRINT_SERVER_SECRET=0ad6c635-04c4-4e3f-9d4f-ae3a24fb378a

# ==========================================
# CLOUDFLARE TUNNEL (Activo)
# ==========================================
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiZjg3NjU0MzIxMDk4NzY1NCIsInQiOiI...
CLOUDFLARE_TUNNEL_NAME=print-server-local1
USE_CLOUDFLARE=true

# ==========================================
# NGROK (Deshabilitado - mantener por backup)
# ==========================================
# NGROK_AUTHTOKEN=2pXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# NGROK_DOMAIN=
# USE_NGROK=false
```

---

##  Estimaciones

### **Tiempo total:**
- **Desarrollo inicial:** 1-2 semanas
- **Piloto:** 1 semana
- **Migración completa:** 2-4 semanas
- **Total:** 4-7 semanas

### **Esfuerzo:**
- **Desarrollo:** Alta intensidad (tiempo completo)
- **Piloto:** Media intensidad (monitoreo diario)
- **Migración:** Media intensidad (2-3 horas por local)

### **Riesgo:**
- **Bajo:** Si se hace gradualmente
- **Medio:** Si se hace todo a la vez
- **Rollback fácil:** Mantener ngrok como backup

---

##  Criterios de Éxito

La migración será exitosa cuando:

- [ ] 100% de locales funcionando con Cloudflare Tunnel
- [ ] 0 downtime para clientes finales
- [ ] Performance igual o mejor que ngrok
- [ ] Personal capacitado en el nuevo sistema
- [ ] Documentación completa y actualizada
- [ ] Ahorro de costos confirmado (cancelación de ngrok Pro)
- [ ] Sistema estable por 1 mes sin incidentes

---

## 🆘 Plan de Rollback

Si algo sale mal, puedes volver a ngrok fácilmente:

1. **Editar `.env`:**
   ```env
   USE_CLOUDFLARE=false
   USE_NGROK=true
   NGROK_AUTHTOKEN=tu_token_original
   ```

2. **Reiniciar launcher**

3. **Listo**, vuelve a ngrok en menos de 5 minutos

---

## 📞 Soporte

Si necesitas ayuda durante la migración:

1. **Documentación oficial:** https://developers.cloudflare.com/cloudflare-one/
2. **Community:** https://community.cloudflare.com/
3. **Support:** support@cloudflare.com (plan Pro si aplica)

---

##  Notas Finales

- **No hay prisa:** ngrok funciona perfectamente, migra solo cuando tenga sentido económicamente
- **Prueba primero:** Siempre piloto en 1 local antes de migrar todos
- **Backup siempre:** Mantén ngrok configurado como backup por si acaso
- **Documenta todo:** Cada local, cada token, cada problema encontrado

---

**Fecha de creación:** 2025-10-22
**Última actualización:** 2025-10-22
**Estado:** Planificado (No iniciado)
**Prioridad:** Baja (mantener ngrok por ahora)

---

¡Buena suerte con la migración cuando decidas hacerla! 
