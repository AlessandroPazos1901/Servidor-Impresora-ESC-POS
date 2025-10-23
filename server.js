// server.js - Servidor modular para impresión térmica
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const net = require('net');
const iconv = require("iconv-lite");

// Importar módulos
const ESC_POS = require('./src/config/escpos');
const { printToThermalPrinter } = require('./src/printer/connection');
const printRoutes = require('./src/routes/printRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de la impresora
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.200';
const PRINTER_PORT = process.env.PRINTER_PORT || 9100;
const PRINT_SERVER_SECRET = process.env.PRINT_SERVER_SECRET || 'tu-secreto-muy-largo-y-dificil-de-adivinar';

// === MANEJO DE ERRORES NO CAPTURADOS ===
process.on('uncaughtException', (error) => {
  console.error(' ERROR NO CAPTURADO:', error.message);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error(' PROMESA RECHAZADA NO MANEJADA:', reason);
});

// === MANEJO DE SEÑALES DE TERMINACIÓN ===
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n Señal ${signal} recibida. Cerrando servidor...`);

  server.close(() => {
    console.log(' Servidor cerrado correctamente');
    process.exit(0);
  });

  setTimeout(() => {
    console.error(' Forzando cierre');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// === ESTADÍSTICAS DEL SERVIDOR ===
const serverStats = {
  startTime: new Date(),
  totalRequests: 0,
  successfulPrints: 0,
  failedPrints: 0,
  lastPrintTime: null,
  lastError: null
};

// CORS
app.use(cors({
  origin: ["https://la-casita.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// === MIDDLEWARE DE AUTORIZACIÓN ===
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: falta token' });
  }

  if (token !== PRINT_SERVER_SECRET) {
    return res.status(403).json({ error: 'Acceso prohibido: token inválido' });
  }

  next();
};

// === CONFIGURAR RUTAS ===
printRoutes.configure({
  verifyToken,
  serverStats,
  printerConfig: {
    ip: PRINTER_IP,
    port: PRINTER_PORT,
    serverPort: PORT
  }
});

// === ENDPOINTS ===
app.get('/test', (req, res) => {
  res.json({ message: 'Servidor de impresión HTTPS funcionando correctamente' });
});

app.get('/health', (req, res) => {
  const uptime = Date.now() - serverStats.startTime.getTime();
  const uptimeMinutes = Math.floor(uptime / 60000);

  res.json({
    status: 'ok',
    uptime: `${uptimeMinutes} minutos`,
    uptimeMs: uptime,
    startTime: serverStats.startTime,
    stats: {
      totalRequests: serverStats.totalRequests,
      successfulPrints: serverStats.successfulPrints,
      failedPrints: serverStats.failedPrints,
      successRate: serverStats.totalRequests > 0
        ? ((serverStats.successfulPrints / serverStats.totalRequests) * 100).toFixed(2) + '%'
        : 'N/A',
      lastPrintTime: serverStats.lastPrintTime,
      lastError: serverStats.lastError
    },
    printer: {
      ip: PRINTER_IP,
      port: PRINTER_PORT
    },
    server: {
      port: PORT,
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    }
  });
});

// Usar rutas de impresión
app.use('/', printRoutes.router);

// === CREAR Y ARRANCAR SERVIDOR ===
const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     SERVIDOR DE IMPRESIÓN TÉRMICA          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log(` Servidor HTTP ejecutándose en puerto ${PORT}`);
  console.log(` Impresora configurada: ${PRINTER_IP}:${PRINTER_PORT}`);
  console.log(` URL local: http://localhost:${PORT}`);
  console.log(`  Autenticación: Bearer Token habilitada`);
  console.log(`\n Endpoints disponibles:`);
  console.log(`   • GET  /test        - Health check básico`);
  console.log(`   • GET  /health      - Estado y estadísticas`);
  console.log(`   • POST /print       - Imprimir pedido`);
  console.log(`   • POST /test-print  - Prueba de impresora`);
  console.log(`\n Para exponer con ngrok: npm run ngrok`);
  console.log(`\n Protecciones activas:`);
  console.log(`   • uncaughtException handler: `);
  console.log(`   • unhandledRejection handler: `);
  console.log(`   • Graceful shutdown: `);
  console.log(`\n Iniciado: ${new Date().toLocaleString('es-PE')}`);
  console.log('═'.repeat(48) + '\n');

  // Imprimir mensaje de inicio (opcional, comentado por defecto)
  // setTimeout(() => printStartupMessage(), 2000);

  // Monitor de memoria cada 5 minutos
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    console.log(`\n [Monitor] Memoria: RSS=${rss}MB, Heap=${heapUsed}MB | Impresiones: ${serverStats.successfulPrints} ${serverStats.failedPrints}`);
  }, 5 * 60 * 1000);
});

// Función para imprimir mensaje de inicio (opcional)
function printStartupMessage() {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-PE');
  const hora = now.toLocaleTimeString('es-PE');

  let mensaje = '';
  mensaje += '\x1B\x40'; // Reset
  mensaje += '\x1B\x61\x01'; // Centrar
  mensaje += '\x1B\x21\x30'; // Texto grande
  mensaje += '======================\n';
  mensaje += '  SERVIDOR INICIADO  \n';
  mensaje += '======================\n\n';
  mensaje += '\x1B\x21\x00'; // Texto normal
  mensaje += `Fecha: ${fecha}\n`;
  mensaje += `Hora: ${hora}\n\n`;
  mensaje += 'Sistema de impresion\n';
  mensaje += 'termica ACTIVO\n\n';
  mensaje += `IP: ${PRINTER_IP}\n`;
  mensaje += `Puerto: ${PRINTER_PORT}\n`;
  mensaje += `Servidor: Puerto ${PORT}\n\n`;
  mensaje += '----------------------\n';
  mensaje += '   Listo para usar   \n';
  mensaje += '----------------------\n\n\n';
  mensaje += '\x1D\x56\x42\x00'; // Cortar

  const bufferMessage = iconv.encode(mensaje, 'cp850');
  const client = new net.Socket();

  client.connect(PRINTER_PORT, PRINTER_IP, () => {
    console.log(' Conectado a impresora para mensaje de inicio');
    client.write(bufferMessage);
  });

  client.on('close', () => {
    console.log(' Mensaje de inicio enviado');
  });

  client.on('error', (err) => {
    console.error(' Error enviando mensaje de inicio:', err.message);
  });
}
