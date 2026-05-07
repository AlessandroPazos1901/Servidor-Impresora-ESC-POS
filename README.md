# Thermal Printer Server

> Servidor Node.js que actúa como puente HTTP/TCP entre una aplicación web y una impresora térmica ESC/POS en una red local, expuesto vía túnel HTTPS de ngrok.

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com)
[![ngrok](https://img.shields.io/badge/ngrok-tunnel-1F1E37?logo=ngrok&logoColor=white)](https://ngrok.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](#licencia)

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecución](#ejecución)
- [API](#api)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Solución de problemas](#solución-de-problemas)
- [Licencia](#licencia)

---

## Descripción

Este servicio resuelve el problema de **mixed content** entre una aplicación web servida por HTTPS (desplegada en Vercel) y una impresora térmica de red que solo expone TCP plano dentro del local del comercio.

El servidor recibe pedidos en formato JSON, los formatea con comandos ESC/POS y los envía por TCP/IP a la impresora. La aplicación web accede al servicio mediante una URL pública HTTPS provista por un túnel ngrok, sin necesidad de certificados auto‑firmados ni configuración de red avanzada en el local.

## Características

- **API REST** con autenticación por Bearer token y CORS restringido por origen.
- **Túnel HTTPS público** con ngrok (soporte para dominio estático en plan Pro).
- **Comunicación TCP/IP** directa con impresoras ESC/POS (puerto 9100 por defecto).
- **Codificación CP850** para soporte correcto de caracteres en español.
- **Impresión diferencial**: para actualizaciones de pedidos solo imprime *agregados*, *eliminados* y *modificados*.
- **Arquitectura modular** con separación clara entre rutas, formateo, conexión y configuración.
- **Manejo robusto de errores**: timeouts de conexión y escritura, reintentos, captura de excepciones no manejadas y *graceful shutdown*.
- **Health check** y métricas en tiempo real (uptime, tasa de éxito, último error, uso de memoria).
- **Launcher gráfico** (Python + Tkinter) para iniciar y monitorear el servidor en Windows.

## Arquitectura

```
┌──────────────────────┐         HTTPS         ┌─────────────────┐         TCP/IP        ┌─────────────────┐
│  Aplicación web      │ ────────────────────▶ │  Print Server   │ ────────────────────▶ │  Impresora      │
│  (Vercel)            │   Bearer + JSON       │  (Node.js)      │   ESC/POS + CP850     │  térmica        │
└──────────────────────┘                       └─────────────────┘                       └─────────────────┘
                                                       ▲
                                                       │ Túnel
                                                       │
                                                ┌─────────────┐
                                                │    ngrok    │
                                                └─────────────┘
```

## Stack tecnológico

| Categoría | Tecnologías |
|---|---|
| **Runtime** | Node.js 16+ |
| **Web framework** | Express 4 |
| **Networking** | `net` (TCP/IP nativo), `http` |
| **Tunneling** | `@ngrok/ngrok` |
| **Encoding** | `iconv-lite` (CP850) |
| **Middleware** | `cors`, `express.json` |
| **Configuración** | `dotenv` |
| **Dev tooling** | `nodemon` |
| **Launcher GUI** | Python 3 + Tkinter |
| **Protocolo de impresión** | ESC/POS |

## Requisitos previos

- Node.js 16 o superior y npm
- Python 3.x (solo si se usa el launcher gráfico)
- Impresora térmica compatible con ESC/POS conectada a la misma red local
- Cuenta de ngrok (plan gratuito o Pro)

## Instalación

```bash
git clone <url-del-repo>
cd print-server
npm install
cp .env.example .env
```

## Configuración

Edita el archivo `.env` con tus valores:

```env
# Impresora
PRINTER_IP=192.168.1.200
PRINTER_PORT=9100

# Servidor
PORT=3001
PRINT_SERVER_SECRET=<token-largo-y-aleatorio>

# ngrok
NGROK_AUTHTOKEN=<tu-authtoken>
NGROK_DOMAIN=                  # opcional (ngrok Pro)
```

> **Tip:** genera un token seguro con
> `node -e "console.log(require('crypto').randomUUID())"`

| Variable | Descripción | Requerido |
|---|---|:---:|
| `PRINTER_IP` | IP de la impresora térmica en la LAN | ✓ |
| `PRINTER_PORT` | Puerto TCP de la impresora (típicamente 9100) | ✓ |
| `PORT` | Puerto local del servidor HTTP | ✓ |
| `PRINT_SERVER_SECRET` | Bearer token para autenticar las peticiones | ✓ |
| `NGROK_AUTHTOKEN` | Token de autenticación de ngrok | ✓ |
| `NGROK_DOMAIN` | Dominio estático de ngrok (Pro) | ✗ |

## Ejecución

| Comando | Descripción |
|---|---|
| `npm run ngrok` | Inicia servidor + túnel HTTPS público (recomendado). |
| `npm start` | Inicia solo el servidor HTTP local. |
| `npm run dev` | Modo desarrollo con auto‑reinicio (`nodemon`). |
| `python launcher.py` | Launcher gráfico con control y logs en vivo. |

En Windows también puedes usar `Iniciar Servidor.bat` o `Servidor Impresion.vbs` para arrancar el launcher con doble clic.

## API

Todos los endpoints `POST` requieren el header:

```
Authorization: Bearer <PRINT_SERVER_SECRET>
```

### `GET /test`

Health check básico.

```json
{ "message": "Servidor de impresión HTTPS funcionando correctamente" }
```

### `GET /health`

Estadísticas detalladas del servidor.

```json
{
  "status": "ok",
  "uptime": "125 minutos",
  "stats": {
    "totalRequests": 47,
    "successfulPrints": 45,
    "failedPrints": 2,
    "successRate": "95.74%",
    "lastPrintTime": "2025-10-24T18:00:00.000Z",
    "lastError": null
  },
  "printer": { "ip": "192.168.1.200", "port": 9100 },
  "server": {
    "port": 3001,
    "nodeVersion": "v20.11.0",
    "memory": { "rss": "78.42 MB", "heapUsed": "12.10 MB" }
  }
}
```

### `POST /test-print`

Imprime una página de prueba para verificar la conexión con la impresora.

### `POST /print`

Imprime una comanda completa o una actualización de pedido.

**Request body:**

```json
{
  "order": {
    "mesa": "5",
    "mozo": "Juan",
    "created_at": "2025-10-24T18:00:00.000Z",
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

**Response (200):**

```json
{
  "success": true,
  "message": "Pedido impreso correctamente",
  "mesa": "5",
  "duration": 342
}
```

**Response (4xx / 5xx):** incluye `error`, `details`, `code` y `mesa` para facilitar diagnóstico.

## Estructura del proyecto

```
print-server/
├── src/
│   ├── config/
│   │   └── escpos.js           # Definición de comandos ESC/POS
│   ├── printer/
│   │   ├── connection.js       # Conexión TCP con timeouts y manejo de errores
│   │   └── formatter.js        # Construcción del buffer ESC/POS de la comanda
│   ├── routes/
│   │   └── printRoutes.js      # Endpoints /print y /test-print con validación
│   └── utils/
│       └── orderUtils.js       # Helpers de procesamiento de pedidos
├── server.js                   # Punto de entrada (Express + middleware + health)
├── start-ngrok.js              # Bootstrap del túnel ngrok
├── launcher.py                 # GUI Tkinter para gestión del servidor
├── Iniciar Servidor.bat        # Atajo de arranque (Windows)
├── Servidor Impresion.vbs      # Atajo silencioso (Windows)
├── package.json
├── .env.example
└── README.md
```

## Solución de problemas

<details>
<summary><strong>Error de conexión a la impresora</strong></summary>

- Verifica `PRINTER_IP` y `PRINTER_PORT` en `.env`.
- Confirma que la impresora esté encendida y en la misma red.
- Comprueba conectividad: `ping <PRINTER_IP>`.
- Asegúrate de que el firewall no bloquee el puerto 9100.

</details>

<details>
<summary><strong>Error de ngrok</strong></summary>

- Confirma que `NGROK_AUTHTOKEN` esté presente y sea válido.
- Si usas dominio estático, verifica que `NGROK_DOMAIN` exista en tu cuenta.
- Cierra cualquier otro proceso de ngrok activo en la máquina.

</details>

<details>
<summary><strong>Puerto en uso</strong></summary>

```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID>

# Linux / macOS
lsof -ti:3001 | xargs kill -9
```

</details>

<details>
<summary><strong>Error de autenticación (401 / 403)</strong></summary>

- El header debe ser exactamente `Authorization: Bearer <token>`.
- El token debe coincidir con `PRINT_SERVER_SECRET` del `.env`.

</details>

<details>
<summary><strong>Caracteres con acento mal impresos</strong></summary>

El servidor codifica el buffer en CP850. Si la impresora tiene otra página de códigos configurada, ajusta el código en `src/printer/formatter.js` o la configuración de la impresora.

</details>

## Licencia

ISC
