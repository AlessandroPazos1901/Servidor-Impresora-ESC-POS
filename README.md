# Thermal Printer Server

> Node.js service that bridges HTTP/TCP between a web application and an ESC/POS thermal printer on a local network, exposed through an HTTPS ngrok tunnel.

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com)
[![ngrok](https://img.shields.io/badge/ngrok-tunnel-1F1E37?logo=ngrok&logoColor=white)](https://ngrok.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](#license)

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the server](#running-the-server)
- [API](#api)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

This service solves the **mixed-content** problem between a web application served over HTTPS (deployed on Vercel) and a network thermal printer that only exposes plain TCP inside the venue's local network.

The server receives orders as JSON, formats them with ESC/POS commands and sends them over TCP/IP to the printer. The web app reaches the service through a public HTTPS URL provided by an ngrok tunnel — no self-signed certificates and no advanced network configuration required on site.

## Features

- **REST API** with Bearer token authentication and origin-restricted CORS.
- **Public HTTPS tunnel** via ngrok (static-domain support on the Pro plan).
- **Direct TCP/IP communication** with ESC/POS printers (default port 9100).
- **CP850 encoding** for proper Spanish character support.
- **Differential printing**: order updates print only *added*, *removed* and *modified* items.
- **Modular architecture** with clear separation between routes, formatting, connection and configuration.
- **Robust error handling**: connection and write timeouts, retries, uncaught-exception capture and *graceful shutdown*.
- **Health check** and real-time metrics (uptime, success rate, last error, memory usage).
- **Graphical launcher** (Python + Tkinter) to start and monitor the server on Windows.

## Architecture

```
┌──────────────────────┐         HTTPS         ┌─────────────────┐         TCP/IP        ┌─────────────────┐
│   Web application    │ ────────────────────▶ │  Print Server   │ ────────────────────▶ │     Thermal     │
│      (Vercel)        │   Bearer + JSON       │    (Node.js)    │   ESC/POS + CP850     │     printer     │
└──────────────────────┘                       └─────────────────┘                       └─────────────────┘
                                                       ▲
                                                       │ Tunnel
                                                       │
                                                ┌─────────────┐
                                                │    ngrok    │
                                                └─────────────┘
```

## Tech stack

| Category | Technologies |
|---|---|
| **Runtime** | Node.js 16+ |
| **Web framework** | Express 4 |
| **Networking** | `net` (native TCP/IP), `http` |
| **Tunneling** | `@ngrok/ngrok` |
| **Encoding** | `iconv-lite` (CP850) |
| **Middleware** | `cors`, `express.json` |
| **Configuration** | `dotenv` |
| **Dev tooling** | `nodemon` |
| **GUI launcher** | Python 3 + Tkinter |
| **Printing protocol** | ESC/POS |

## Prerequisites

- Node.js 16 or later, plus npm
- Python 3.x (only required for the graphical launcher)
- ESC/POS-compatible thermal printer connected to the same local network
- An ngrok account (Free or Pro plan)

## Installation

```bash
git clone <repo-url>
cd print-server
npm install
cp .env.example .env
```

## Configuration

Edit the `.env` file with your values:

```env
# Printer
PRINTER_IP=192.168.1.200
PRINTER_PORT=9100

# Server
PORT=3001
PRINT_SERVER_SECRET=<long-random-token>

# ngrok
NGROK_AUTHTOKEN=<your-authtoken>
NGROK_DOMAIN=                  # optional (ngrok Pro)
```

> **Tip:** generate a secure token with
> `node -e "console.log(require('crypto').randomUUID())"`

| Variable | Description | Required |
|---|---|:---:|
| `PRINTER_IP` | LAN IP address of the thermal printer | ✓ |
| `PRINTER_PORT` | Printer TCP port (typically 9100) | ✓ |
| `PORT` | Local HTTP server port | ✓ |
| `PRINT_SERVER_SECRET` | Bearer token used to authenticate requests | ✓ |
| `NGROK_AUTHTOKEN` | ngrok authentication token | ✓ |
| `NGROK_DOMAIN` | ngrok static domain (Pro) | ✗ |

## Running the server

| Command | Description |
|---|---|
| `npm run ngrok` | Starts the server + public HTTPS tunnel (recommended). |
| `npm start` | Starts the local HTTP server only. |
| `npm run dev` | Development mode with auto-reload (`nodemon`). |
| `python launcher.py` | Graphical launcher with controls and live logs. |

On Windows you can also double-click `Iniciar Servidor.bat` or `Servidor Impresion.vbs` to open the launcher.

## API

All `POST` endpoints require the header:

```
Authorization: Bearer <PRINT_SERVER_SECRET>
```

### `GET /test`

Basic health check.

```json
{ "message": "HTTPS print server is running correctly" }
```

### `GET /health`

Detailed server statistics.

```json
{
  "status": "ok",
  "uptime": "125 minutes",
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

Prints a test page to verify the connection to the printer.

### `POST /print`

Prints a complete order or an order update.

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
  "message": "Order printed successfully",
  "mesa": "5",
  "duration": 342
}
```

**Response (4xx / 5xx):** includes `error`, `details`, `code` and `mesa` to make diagnostics easier.

## Project structure

```
print-server/
├── src/
│   ├── config/
│   │   └── escpos.js           # ESC/POS command definitions
│   ├── printer/
│   │   ├── connection.js       # TCP connection with timeouts and error handling
│   │   └── formatter.js        # Builds the ESC/POS buffer for the order
│   ├── routes/
│   │   └── printRoutes.js      # /print and /test-print endpoints with validation
│   └── utils/
│       └── orderUtils.js       # Order processing helpers
├── server.js                   # Entry point (Express + middleware + health)
├── start-ngrok.js              # ngrok tunnel bootstrap
├── launcher.py                 # Tkinter GUI to manage the server
├── Iniciar Servidor.bat        # Startup shortcut (Windows)
├── Servidor Impresion.vbs      # Silent startup shortcut (Windows)
├── package.json
├── .env.example
└── README.md
```

## Troubleshooting

<details>
<summary><strong>Printer connection error</strong></summary>

- Check `PRINTER_IP` and `PRINTER_PORT` in `.env`.
- Confirm the printer is powered on and on the same network.
- Test connectivity with `ping <PRINTER_IP>`.
- Make sure the firewall is not blocking port 9100.

</details>

<details>
<summary><strong>ngrok error</strong></summary>

- Confirm that `NGROK_AUTHTOKEN` is set and valid.
- If you use a static domain, verify `NGROK_DOMAIN` exists in your account.
- Close any other ngrok process running on the machine.

</details>

<details>
<summary><strong>Port already in use</strong></summary>

```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID>

# Linux / macOS
lsof -ti:3001 | xargs kill -9
```

</details>

<details>
<summary><strong>Authentication error (401 / 403)</strong></summary>

- The header must be exactly `Authorization: Bearer <token>`.
- The token must match `PRINT_SERVER_SECRET` from `.env`.

</details>

<details>
<summary><strong>Accented characters print incorrectly</strong></summary>

The server encodes the buffer in CP850. If the printer is configured with a different code page, adjust `src/printer/formatter.js` or the printer settings.

</details>

## License

ISC
