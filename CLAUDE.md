# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon for auto-restart
- `node server.js` - Run server directly

### Docker
- Build: `docker build -t thermal-printer-server .`
- Run: `docker run --env-file .env -p 3001:3001 thermal-printer-server`
- Compose: `docker-compose up -d`

## Architecture Overview

This is a Node.js HTTPS server for printing thermal receipts to ESC/POS compatible printers over TCP/IP. The server acts as a bridge between a web application and a thermal printer on the local network.

### Core Components

**Server (server.js)**: Express.js HTTPS server with the following key sections:
- HTTPS configuration using self-signed certificates (192.168.1.47.pem/key)
- CORS setup allowing requests from `https://la-casita.vercel.app`
- Bearer token authentication middleware
- ESC/POS command definitions and thermal printer formatting logic
- TCP socket connection handling for printer communication

### Key Features

**Security**:
- HTTPS only with self-signed certificates
- Bearer token authentication for all endpoints
- CORS restricted to specific origin

**Printer Communication**:
- TCP/IP connection to thermal printer (default: 192.168.1.200:9100)
- ESC/POS command formatting with CP850 encoding
- Support for order printing and updates with diff highlighting

**Endpoints**:
- `POST /print` - Print complete orders or order updates
- `POST /test-print` - Print test page
- `GET /test` - Health check endpoint

### Environment Configuration

Required environment variables (see .env):
- `PRINTER_IP` - IP address of thermal printer
- `PRINTER_PORT` - Port of thermal printer (typically 9100)
- `PRINT_SERVER_SECRET` - Bearer token for authentication

### Order Data Format

The `/print` endpoint expects:
```json
{
  "order": {
    "mesa": "table_number",
    "mozo": "waiter_name", 
    "created_at": "timestamp",
    "pedido_items": [/* array of order items */]
  },
  "changes": { // optional for updates
    "agregados": [/* added items */],
    "eliminados": [/* removed items */], 
    "modificados": [/* modified items with specification changes */]
  }
}
```

### Thermal Printing Logic

The `formatComanda()` function handles:
- ESC/POS command sequencing for proper formatting
- Text encoding to CP850 for Spanish characters
- Responsive text sizing (titles, headers, products, notes)
- Order diff printing for updates (shows only changes)
- Consistent line spacing and cutting

### Docker Support

**Dockerfile**: Simple Node.js container setup with SSL certificates
**docker-compose.yml**: Production-ready orchestration with:
- Environment variable configuration
- Volume mounts for logs and certificates
- Health checks and resource limits
- Host networking for printer access
- Security hardening options

**docker-entrypoint.sh**: Ultra-reliable startup script with:
- Signal handling for graceful shutdown
- Automatic server restart on failure (up to 10 attempts)
- Built-in monitoring and logging
- System information display

### Key Files

- `server.js` - Main HTTPS server with ESC/POS printing logic
- `docker-compose.yml` - Container orchestration with health checks
- `docker-entrypoint.sh` - Reliable startup script with auto-restart
- `Dockerfile` - Container build configuration
- `.env` - Environment configuration for printer IP and authentication token