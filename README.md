# Servidor de Impresión Térmica

Servidor HTTP con túnel ngrok para impresión térmica de comandas a impresoras ESC/POS compatibles.

## Descripción

Este es un servidor Node.js que actúa como puente entre una aplicación web (La Casita en Vercel) y una impresora térmica en la red local. Permite imprimir comandas y actualizaciones de pedidos con formato térmico optimizado.

## Características

- **Servidor HTTP** con túnel ngrok para acceso HTTPS público
- **Arquitectura modular** con separación de responsabilidades
- **Autenticación** mediante Bearer token
- **CORS** configurado para origen específico (la-casita.vercel.app)
- **Comunicación TCP/IP** con impresora térmica
- **Formato ESC/POS** con codificación CP850
- **Impresión de diferencias** para actualizaciones de pedidos
- **Launcher GUI** en Python para fácil gestión del servidor
- **Manejo robusto de errores** y reintentos

## Requisitos Previos

1. **Node.js** versión 16 o superior
2. **npm** (incluido con Node.js)
3. **Python 3.x** (para el launcher GUI)
4. Una impresora térmica compatible con ESC/POS conectada a la red
5. **Cuenta ngrok** (gratuita o Pro) para el túnel HTTPS

## Instalación Paso a Paso

### 1. Descargar e Instalar Node.js
- Visita https://nodejs.org
- Descarga la versión LTS (recomendada)
- Ejecuta el instalador y sigue las instrucciones
- Verifica la instalación abriendo terminal/cmd y ejecutando:
  ```bash
  node --version
  npm --version
  ```

### 2. Instalar Python
- Visita https://python.org
- Descarga Python 3.x
- Durante la instalación, marca "Add Python to PATH"
- Verifica la instalación:
  ```bash
  python --version
  ```

### 3. Obtener el Código del Proyecto
- Descarga o clona el proyecto en tu computadora
- Navega a la carpeta del proyecto en la terminal:
  ```bash
  cd ruta/al/proyecto/print-server
  ```

### 4. Instalar Dependencias
```bash
npm install
```

### 5. Configurar ngrok
1. Crea una cuenta en https://dashboard.ngrok.com
2. Obtén tu authtoken desde https://dashboard.ngrok.com/get-started/your-authtoken
3. (Opcional) Para ngrok Pro: obtén un dominio estático

### 6. Configurar Variables de Entorno
Edita el archivo `.env` con los siguientes valores:

```env
# IP de tu impresora térmica
PRINTER_IP=192.168.1.200

# Puerto de la impresora (generalmente 9100)
PRINTER_PORT=9100

# Puerto local del servidor
PORT=3001

# Token secreto para autenticación (cambia este valor)
PRINT_SERVER_SECRET=tu-token-secreto-aqui

# ngrok authentication token (REQUERIDO)
NGROK_AUTHTOKEN=tu_authtoken_de_ngrok

# ngrok domain (OPCIONAL - solo para cuentas Pro)
NGROK_DOMAIN=tu-dominio-estatico.ngrok.app
```

### 7. Verificar Configuración de Red
- Asegúrate de que tu computadora y la impresora estén en la misma red
- Verifica que puedes hacer ping a la impresora:
  ```bash
  ping 192.168.1.200
  ```

### 8. Ejecutar el Servidor

**Opción 1: Usando el Launcher GUI (Recomendado)**
- **Windows**: Doble clic en `Iniciar Servidor.bat` o `Servidor Impresion.vbs`
- **Linux/Mac**: Ejecuta `python launcher.py`

El launcher te permitirá:
- Iniciar/detener el servidor con botones
- Ver el estado en tiempo real
- Monitorear logs
- Acceder a la URL pública de ngrok

**Opción 2: Desde la terminal**

Con ngrok (recomendado):
```bash
npm run ngrok
```

Solo servidor local (sin HTTPS):
```bash
npm start
```

Para desarrollo (con auto-reinicio):
```bash
npm run dev
```

### 9. Verificar Instalación
- El servidor se iniciará y ngrok generará una URL pública
- La URL aparecerá en el launcher o en los logs de la terminal
- Prueba el endpoint de salud: `GET https://tu-url.ngrok.app/test`
- Prueba la impresión: `POST https://tu-url.ngrok.app/test-print`

## API Endpoints

### `GET /test`
Endpoint de verificación de estado del servidor.

**Respuesta:**
```json
{
  "message": "Servidor de impresión térmica funcionando correctamente",
  "timestamp": "2024-10-24T18:00:00.000Z"
}
```

### `GET /health`
Endpoint con estadísticas detalladas del servidor.

**Respuesta:**
```json
{
  "status": "ok",
  "uptime": "2h 15m 30s",
  "stats": {
    "successfulPrints": 45,
    "failedPrints": 2,
    "successRate": "95.74%"
  },
  "server": {
    "memory": {...}
  }
}
```

### `POST /test-print`
Imprime una página de prueba.

**Headers requeridos:**
```
Authorization: Bearer YOUR_SECRET_TOKEN
```

### `POST /print`
Imprime una comanda completa o actualización.

**Headers requeridos:**
```
Authorization: Bearer YOUR_SECRET_TOKEN
Content-Type: application/json
```

**Formato del cuerpo de la solicitud:**
```json
{
  "order": {
    "mesa": "número_de_mesa",
    "mozo": "nombre_del_mozo",
    "created_at": "timestamp",
    "pedido_items": [
      {
        "producto": "Pizza Margherita",
        "cantidad": 2,
        "precio": 15.50,
        "notas": "Sin cebolla"
      }
    ]
  },
  "changes": {
    "agregados": [],
    "eliminados": [],
    "modificados": []
  }
}
```

## Comandos Disponibles

### Desarrollo
- `npm start` - Iniciar servidor HTTP local (sin ngrok)
- `npm run dev` - Iniciar servidor de desarrollo con auto-reinicio
- `npm run ngrok` - Iniciar servidor con túnel ngrok (recomendado)
- `node server.js` - Ejecutar servidor directamente

### Launcher
- **Windows**: Ejecutar `Iniciar Servidor.bat` o `Servidor Impresion.vbs`
- **Linux/Mac**: `python launcher.py`

## Estructura del Proyecto

```
print-server/
├── src/
│   ├── config/
│   │   └── escpos.js          # Comandos ESC/POS para impresora
│   ├── printer/
│   │   ├── connection.js      # Manejo de conexión TCP con impresora
│   │   └── formatter.js       # Formateo de comandas con ESC/POS
│   ├── routes/
│   │   └── printRoutes.js     # Rutas Express para impresión
│   └── utils/
│       └── orderUtils.js      # Utilidades para pedidos
├── server.js                  # Punto de entrada principal
├── start-ngrok.js             # Inicializador de túnel ngrok
├── launcher.py                # Launcher GUI con Python/Tkinter
├── package.json               # Dependencias y scripts npm
├── .env                       # Variables de entorno (no commitear)
├── .env.example               # Ejemplo de configuración
├── CLAUDE.md                  # Documentación para Claude Code
├── ARCHITECTURE.md            # Documentación de arquitectura modular
└── README.md                  # Este archivo
```

## Arquitectura Modular

El servidor está organizado en módulos especializados:

- **config/escpos.js**: Define todos los comandos ESC/POS (bold, tamaños, corte, etc.)
- **printer/connection.js**: Maneja la conexión TCP/IP con timeouts y reintentos
- **printer/formatter.js**: Construye el buffer de impresión con formato térmico
- **routes/printRoutes.js**: Define los endpoints HTTP y validación
- **utils/orderUtils.js**: Funciones auxiliares para procesamiento de pedidos

Ventajas de esta arquitectura:
- **Mantenibilidad**: Cada módulo tiene una responsabilidad clara
- **Testabilidad**: Los módulos pueden ser testeados independientemente
- **Escalabilidad**: Fácil agregar nuevas funcionalidades
- **Legibilidad**: El código principal pasó de 850 a 250 líneas

## Solución de Problemas

### Error de Conexión a Impresora
- Verifica la IP y puerto de la impresora en `.env`
- Asegúrate de que la impresora esté encendida y conectada a la red
- Revisa que no haya firewall bloqueando el puerto 9100
- Prueba hacer ping a la IP de la impresora

### Error de ngrok
- Verifica que `NGROK_AUTHTOKEN` esté configurado en `.env`
- Asegúrate de que tu authtoken sea válido en https://dashboard.ngrok.com
- Si usas dominio estático, verifica que `NGROK_DOMAIN` sea correcto
- Revisa que no haya otro proceso usando ngrok en tu máquina

### Puerto en Uso
- Si el puerto 3001 está ocupado, cambia `PORT` en `.env`
- O termina el proceso que está usando el puerto:
  ```bash
  # Windows
  netstat -ano | findstr :3001
  taskkill /F /PID <PID>

  # Linux/macOS
  lsof -ti:3001 | xargs kill -9
  ```

### Error de Autenticación
- Verifica que el token en `.env` coincida con el enviado en el header `Authorization: Bearer`
- El formato debe ser exactamente: `Authorization: Bearer tu-token-secreto`

### Problemas de Codificación
- El servidor usa codificación CP850 para caracteres especiales en español
- Si hay problemas con acentos, verifica la configuración de la impresora

### Servidor se Cierra Inesperadamente
- Revisa los logs en el launcher para ver el error
- Asegúrate de tener las últimas dependencias: `npm install`
- Verifica que Node.js sea versión 16 o superior
- Revisa que la impresora esté accesible en la red

## ngrok: Gratuito vs Pro

**Plan Gratuito:**
- URL pública cambia cada vez que reinicias el servidor
- Límite de conexiones
- Suficiente para desarrollo y pruebas

**Plan Pro:**
- Dominio estático que nunca cambia
- Sin límites de conexiones
- Ideal para producción
- Configurar con `NGROK_DOMAIN` en `.env`

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crea un Pull Request

## Licencia

ISC
