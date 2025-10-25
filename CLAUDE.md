# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Start the local HTTP server only
- `npm run dev` - Start development server with nodemon for auto-restart
- `npm run ngrok` (or `npm run prod`) - Start server with ngrok tunnel (recommended)
- `node server.js` - Run server directly

### ngrok Setup (Recommended)
1. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
2. Add `NGROK_AUTHTOKEN` to your `.env` file
3. For ngrok Pro users, add `NGROK_DOMAIN` for a static domain
4. Run `npm run ngrok` to start server with public HTTPS tunnel

## Architecture Overview

This is a Node.js HTTP server for printing thermal receipts to ESC/POS compatible printers over TCP/IP. The server acts as a bridge between a web application and a thermal printer on the local network. HTTPS is provided by ngrok for secure public access.

### Core Components

**Server (server.js)**: Express.js HTTP server with the following key sections:
- HTTP server (ngrok provides HTTPS tunnel)
- CORS setup allowing requests from `https://la-casita.vercel.app`
- Bearer token authentication middleware
- ESC/POS command definitions and thermal printer formatting logic
- TCP socket connection handling for printer communication

**ngrok Integration (start-ngrok.js)**: Automatic tunnel setup with:
- Server process management
- Automatic ngrok tunnel creation
- Support for static domains (ngrok Pro)
- Graceful shutdown handling

### Key Features

**Security**:
- HTTPS via ngrok tunnel (no self-signed certificates needed)
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
- `PRINTER_IP` - IP address of thermal printer (default: 192.168.1.200)
- `PRINTER_PORT` - Port of thermal printer (default: 9100)
- `PORT` - Local server port (default: 3001)
- `PRINT_SERVER_SECRET` - Bearer token for authentication
- `NGROK_AUTHTOKEN` - Your ngrok authentication token (get from https://dashboard.ngrok.com)
- `NGROK_DOMAIN` - (Optional) Static domain for ngrok Pro users

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

### Key Files

- `server.js` - Main entry point that orchestrates all modules
- `start-ngrok.js` - ngrok tunnel initialization and management
- `launcher.py` - Python GUI launcher for easy server management
- `src/config/escpos.js` - ESC/POS printer command definitions
- `src/printer/connection.js` - TCP printer connection handling
- `src/printer/formatter.js` - Order formatting with ESC/POS commands
- `src/routes/printRoutes.js` - Express routes for printing endpoints
- `src/utils/orderUtils.js` - Order data utilities
- `.env` - Environment configuration (printer, ngrok, authentication)

### ngrok Benefits

**Why ngrok over self-signed certificates:**
- No certificate warnings in browsers
- Public HTTPS access from anywhere
- Static domains with Pro plan (doesn't change on restart)
- Automatic SSL/TLS handling
- Easy testing from external services (like Vercel)
- Built-in request inspection dashboard

**ngrok Free vs Pro:**
- Free: URL changes on each restart, good for testing
- Pro: Static domain that never changes, perfect for production