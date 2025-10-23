// server.js - Servidor local para impresión térmica con HTTP (ngrok provee HTTPS)
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const net = require('net');
const iconv = require("iconv-lite");
const app = express();
const PORT = process.env.PORT || 3001;

// === MANEJO DE ERRORES NO CAPTURADOS ===
process.on('uncaughtException', (error) => {
  console.error(' ERROR NO CAPTURADO:', error.message);
  console.error('Stack:', error.stack);
  // NO cerramos el proceso, solo registramos el error
});

process.on('unhandledRejection', (reason) => {
  console.error(' PROMESA RECHAZADA NO MANEJADA:', reason);
  // NO cerramos el proceso, solo registramos el error
});

// === MANEJO DE SEÑALES DE TERMINACIÓN ===
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('Ya se está cerrando el servidor...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n Señal ${signal} recibida. Cerrando servidor de forma ordenada...`);

  server.close(() => {
    console.log(' Servidor HTTP cerrado correctamente');
    process.exit(0);
  });

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    console.error(' Forzando cierre después de 10 segundos');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Configuración de la impresora
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.200';
const PRINTER_PORT = process.env.PRINTER_PORT || 9100;
const PRINT_SERVER_SECRET = process.env.PRINT_SERVER_SECRET || 'tu-secreto-muy-largo-y-dificil-de-adivinar';

// CORS - ngrok se encarga del HTTPS
app.use(cors({
  origin: ["https://la-casita.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// --- MIDDLEWARE DE AUTORIZACIÓN ---
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // El token viene en formato "Bearer TU_TOKEN"
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    // No hay token
    return res.status(401).json({ error: 'Acceso no autorizado: falta token' });
  }

  if (token !== PRINT_SERVER_SECRET) {
    // El token es incorrecto
    return res.status(403).json({ error: 'Acceso prohibido: token inválido' });
  }
  
  // Si el token es correcto, dejamos pasar la petición
  next();
};

// Comandos ESC/POS para impresora térmica - CORREGIDOS
const ESC_POS = {
  INIT: Buffer.from([0x1B, 0x40]), // Inicializar impresora
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]), // Negrita ON
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]), // Negrita OFF
  CENTER: Buffer.from([0x1B, 0x61, 0x01]), // Centrar
  LEFT: Buffer.from([0x1B, 0x61, 0x00]), // Alinear izquierda
  FEED_LINE: Buffer.from([0x0A]), // Nueva línea
  CUT: Buffer.from([0x1D, 0x56, 0x42, 0x00]), // Corte parcial
  
  // Tamaños de texto corregidos
  TITLE_TEXT: Buffer.from([0x1B, 0x21, 0x30]), // Para títulos principales (doble altura y ancho)
  HEADER_TEXT: Buffer.from([0x1B, 0x21, 0x20]), // Para encabezados de secciones (doble altura)
  NORMAL_TEXT: Buffer.from([0x1B, 0x21, 0x00]), // Texto normal
  PRODUCT_TEXT: Buffer.from([0x1B, 0x21, 0x20]), // Para nombres de productos (doble ancho)
  SMALL_TEXT: Buffer.from([0x1B, 0x21, 0x08]), // Texto pequeño para notas

  // Espaciado
  LINE_SPACING_DEFAULT: Buffer.from([0x1B, 0x32]),
  LINE_SPACING_TIGHT: Buffer.from([0x1B, 0x33, 0x20]),
  
  // Feeds
  FEED_HALF_LINES: Buffer.from([0x1B, 0x33, 32]),
  FEED_2_LINES: Buffer.from([0x0A, 0x0A]),
  FEED_3_LINES: Buffer.from([0x0A, 0x0A, 0x0A]),
  FEED_4_LINES: Buffer.from([0x0A, 0x0A, 0x0A, 0x0A]),
};

// Función auxiliar para obtener notas 
function getNotes(item) {
  const notes = [];
  if (item?.individuals && Array.isArray(item?.individuals)) {
    item?.individuals.forEach(individual => {
      if (individual.notes) notes.push(individual.notes);
      if (individual.notas) notes.push(individual.notas);
    });
  }
  else if (item?.notas && Array.isArray(item?.notas)) {
    notes.push(...item?.notas);
  }
  else if (item?.notas) {
    console.log("ITEM STRING: ",item)
    if (typeof item.notas === 'string') {
      try {
        const parsed = JSON.parse(item.notas);
        notes.push(...(Array.isArray(parsed) ? parsed : [item.notas]));
      } catch {
        notes.push(item.notas);
      }
    } else {
      notes.push(item.notas);
    }
  }
  return notes.filter(Boolean);
}

// Función para crear el formato de la comanda - CORREGIDA
function formatComanda(order, changes) {
  const isUpdate = changes && (changes.agregados.length > 0 || changes.eliminados.length > 0 || changes.modificados.length > 0);
  const formatDate = (dateString) => new Date(dateString).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  
  let comandaBuffer = Buffer.alloc(0);
  
  // Función helper para agregar texto
  const addText = (text) => {
    const encoded = iconv.encode(text, "CP850");
    comandaBuffer = Buffer.concat([comandaBuffer, encoded]);
  };
  
  // Función helper para agregar comando ESC/POS
  const addCommand = (command) => {
    comandaBuffer = Buffer.concat([comandaBuffer, command]);
  };
  
  // Función para líneas punteadas con ancho consistente
  const addDashedLine = (totalChars = 47) => {
    addCommand(ESC_POS.NORMAL_TEXT); // Asegurar texto normal para líneas consistentes
    addText('-'.repeat(totalChars));
    addCommand(ESC_POS.FEED_LINE);
  };
  
  // Función para printRow corregida
  const printRow = (left, right, totalChars = 23) => {
    right = formatDate(right);
    const L = (left ?? '').toString();
    const R = (right ?? '').toString();

    if (R.length >= totalChars) {
      addText(L);
      addCommand(ESC_POS.FEED_LINE);
      addText(R);
      addCommand(ESC_POS.FEED_LINE);
      return;
    }

    const maxLeftLastLine = totalChars - R.length;
    const lines = [];
    for (let i = 0; i < L.length; i += totalChars) {
      lines.push(L.slice(i, i + totalChars));
    }

    for (let j = 0; j < lines.length - 1; j++) {
      addText(lines[j]);
      addCommand(ESC_POS.FEED_LINE);
    }

    const lastLeft = lines[lines.length - 1] ?? '';
    const spaces = Math.max(0, totalChars - (lastLeft.length + R.length));
    addText(lastLeft + ' '.repeat(spaces) + R);
    addCommand(ESC_POS.FEED_LINE);
  };
  
  // Inicializar impresora
  addCommand(ESC_POS.INIT);
  addCommand(ESC_POS.NORMAL_TEXT); // Establecer texto normal por defecto
  addCommand(ESC_POS.FEED_LINE);
  
  // === TÍTULO CENTRADO ===
  addCommand(ESC_POS.CENTER);
  addCommand(ESC_POS.BOLD_ON);
  addCommand(ESC_POS.TITLE_TEXT); // Usar título grande
  addText(isUpdate ? ' --- ACTUALIZACION --- ' : ' --- NUEVO PEDIDO --- ');
  addCommand(ESC_POS.FEED_LINE);
  addCommand(ESC_POS.NORMAL_TEXT); // Resetear a texto normal
  addCommand(ESC_POS.BOLD_OFF);
  addCommand(ESC_POS.LEFT); // Volver a alineación izquierda
  
  // === LÍNEA PUNTEADA ===
  addCommand(ESC_POS.FEED_LINE);
  addDashedLine(); // Ahora será consistente
  
  // === MESA Y HORA ===
  addCommand(ESC_POS.BOLD_ON);
  addCommand(ESC_POS.HEADER_TEXT); // Usar tamaño de encabezado
  addCommand(ESC_POS.FEED_HALF_LINES);
  printRow(`MESA: ${order.mesa}`, `${order.created_at}`);
  addCommand(ESC_POS.NORMAL_TEXT); // Resetear a normal
  addCommand(ESC_POS.BOLD_OFF);
  addCommand(ESC_POS.FEED_LINE);
  
  // === MOZO ===
  addCommand(ESC_POS.FEED_HALF_LINES);
  addCommand(ESC_POS.NORMAL_TEXT);
  addText(`Por: ${order.mozo || order.atendido_por || 'Admin'}`);
  addCommand(ESC_POS.FEED_LINE);

  // === LÍNEA PUNTEADA DESPUÉS DEL MOZO ===
  addCommand(ESC_POS.FEED_HALF_LINES);
  addDashedLine(); // Ahora será del mismo tamaño que la anterior

  if (isUpdate) {
    // === PRODUCTOS AGREGADOS ===
    if (changes.agregados.length > 0) {
      addCommand(ESC_POS.FEED_HALF_LINES);
      addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.HEADER_TEXT); // Usar tamaño de encabezado consistente
      addText('AGREGA:');
      addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);

      changes.agregados.forEach(item => {
        addCommand(ESC_POS.FEED_LINE);
        addCommand(ESC_POS.PRODUCT_TEXT); // Usar tamaño apropiado para productos
        //addCommand(ESC_POS.BOLD_ON);
        addText(`- ${item.quantity} ${item.nombre}`);
        //addCommand(ESC_POS.BOLD_OFF);
        addCommand(ESC_POS.NORMAL_TEXT);
        addCommand(ESC_POS.FEED_LINE);
        
        // Mostrar notas si existen
        if (item.notas && item.notas.length > 0) {
          item.notas.forEach(nota => {
            addCommand(ESC_POS.SMALL_TEXT);
            addText(`    - ${nota}`);
            addCommand(ESC_POS.FEED_LINE);
          });
          addCommand(ESC_POS.NORMAL_TEXT); // Resetear después de las notas
        }
      });
    }
    
    // === PRODUCTOS ELIMINADOS ===
    if (changes.eliminados.length > 0) {
      addCommand(ESC_POS.FEED_LINE);
      addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.HEADER_TEXT); // Consistente con AGREGA
      addText('ELIMINA:');
      addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);
      
      changes.eliminados.forEach(item => {
        addCommand(ESC_POS.FEED_LINE);
        addCommand(ESC_POS.PRODUCT_TEXT); // Consistente con agregados
        //addCommand(ESC_POS.BOLD_ON);
        addText(`- ${item.quantity} ${item.nombre}`);
        //addCommand(ESC_POS.BOLD_OFF);
        addCommand(ESC_POS.NORMAL_TEXT);
        addCommand(ESC_POS.FEED_LINE);
        
        // Mostrar notas de eliminados si existen
        if (item.notas && item.notas.length > 0) {
          item.notas.forEach(nota => {
            addCommand(ESC_POS.SMALL_TEXT);
            addText(`    - ${nota}`);
            addCommand(ESC_POS.FEED_LINE);
          });
          addCommand(ESC_POS.NORMAL_TEXT);
        }
      });
    }
    
    // === ESPECIFICACIONES MODIFICADAS ===
    if (changes.modificados.length > 0) {
      addCommand(ESC_POS.FEED_LINE);
      addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.HEADER_TEXT); // Consistente con otras secciones
      addText('ESPECIFICACION:');
      addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);

      changes.modificados.forEach(item => {
        const originales = item.especificacionesOriginales || [];
        const nuevas = item.especificacionesNuevas || [];
        
        // Detectar cambios específicos
        const agregadas = nuevas.filter(spec => !originales.includes(spec));
        const quitadas = originales.filter(spec => !nuevas.includes(spec));
        
        // Crear mensajes de cambios
        const cambios = [];
        if (agregadas.length > 0 && quitadas.length > 0) {
          quitadas.forEach((quitada, idx) => {
            if (agregadas[idx]) {
              cambios.push(`${agregadas[idx]} (cambio de "${quitada}")`);
            }
          });
          if (agregadas.length > quitadas.length) {
            agregadas.slice(quitadas.length).forEach(agregada => {
              cambios.push(`${agregada} (nueva)`);
            });
          }
        } else if (agregadas.length > 0) {
          agregadas.forEach(agregada => {
            cambios.push(`${agregada} (nueva)`);
          });
        } else if (quitadas.length > 0) {
          cambios.push(`sin especificaciones (antes: ${quitadas.join(', ')})`);
        }
        
        addCommand(ESC_POS.FEED_LINE);
        addCommand(ESC_POS.PRODUCT_TEXT); // Tamaño consistente para productos
        //addCommand(ESC_POS.BOLD_ON);
        addText(`- 1 ${item.nombre}:`);
        //addCommand(ESC_POS.BOLD_OFF);
        addCommand(ESC_POS.NORMAL_TEXT);
        addCommand(ESC_POS.FEED_LINE);
        
        cambios.forEach(cambio => {
          addCommand(ESC_POS.SMALL_TEXT); // Tamaño menor para especificaciones
          addText(`    * ${cambio}`);
          addCommand(ESC_POS.FEED_LINE);
        });
        addCommand(ESC_POS.NORMAL_TEXT); // Resetear después de especificaciones
      });
    }
  } else {
    // === PEDIDO COMPLETO === (sin cambios)
    const items = order.pedido_items || order.currentOrder || [];
    items.forEach(item => {
      addCommand(ESC_POS.FEED_LINE);
      console.log("ITEM1111: ",item)
      // Nombre del producto
      //addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.PRODUCT_TEXT); // Tamaño consistente para productos
      addText(`- ${item.quantity || item.cantidad} ${item.nombre || item.producto?.nombre}`);
      //addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);
      
      // Mostrar notas usando la función getNotes
      const notes = getNotes(item);
      if (notes.length > 0) {
        notes.forEach(nota => {
          addCommand(ESC_POS.SMALL_TEXT);
          addText(`  * ${nota}`);
          addCommand(ESC_POS.FEED_LINE);
        });
        addCommand(ESC_POS.NORMAL_TEXT); // Resetear después de las notas
      }
    });
  }
  
  // === LÍNEA FINAL PUNTEADA ===
  addCommand(ESC_POS.FEED_LINE);
  addDashedLine(); // Ahora será consistente con todas las demás
  
  // Espacios antes del corte
  addCommand(ESC_POS.FEED_LINE);
  
  // Corte parcial
  addCommand(ESC_POS.CUT);
  
  return comandaBuffer;
}

// Función para imprimir con manejo robusto de errores
function printToThermalPrinter(data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let isResolved = false;
    let connectionTimer = null;
    let writeTimer = null;

    // Timeout para la conexión (5 segundos)
    const CONNECTION_TIMEOUT = 5000;
    // Timeout para escritura y cierre (3 segundos adicionales)
    const WRITE_TIMEOUT = 3000;

    // Función helper para resolver/rechazar una sola vez
    const safeResolve = (message) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(connectionTimer);
        clearTimeout(writeTimer);
        resolve(message);
      }
    };

    const safeReject = (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(connectionTimer);
        clearTimeout(writeTimer);
        client.destroy(); // Asegurar que se cierre el socket
        reject(error);
      }
    };

    // Configurar timeout de conexión
    client.setTimeout(CONNECTION_TIMEOUT);

    // Timeout de conexión
    connectionTimer = setTimeout(() => {
      safeReject(new Error(`Timeout al conectar a la impresora ${PRINTER_IP}:${PRINTER_PORT}`));
    }, CONNECTION_TIMEOUT);

    // Evento de conexión exitosa
    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      console.log(` Conectado a impresora ${PRINTER_IP}:${PRINTER_PORT}`);
      clearTimeout(connectionTimer);

      try {
        // Escribir datos a la impresora
        client.write(data, (writeErr) => {
          if (writeErr) {
            console.error(' Error al escribir a la impresora:', writeErr);
            safeReject(writeErr);
            return;
          }

          console.log(' Datos enviados a la impresora');

          // Timer para cerrar la conexión después de enviar
          writeTimer = setTimeout(() => {
            try {
              client.end();
            } catch (endErr) {
              console.error(' Error al cerrar conexión:', endErr);
              client.destroy();
            }
          }, WRITE_TIMEOUT);
        });
      } catch (err) {
        console.error(' Excepción al escribir:', err);
        safeReject(err);
      }
    });

    // Evento de cierre de conexión
    client.on('close', () => {
      console.log(' Conexión con impresora cerrada');
      safeResolve('Impresión completada exitosamente');
    });

    // Evento de error
    client.on('error', (err) => {
      const errorMessage = err.message || err.code || 'Error desconocido en la conexión';
      console.error(' Error en conexión con impresora:', errorMessage);

      // Crear error más descriptivo
      let detailedError = new Error(errorMessage);

      // Agregar información del código de error si existe
      if (err.code === 'ECONNREFUSED') {
        detailedError = new Error(`No se puede conectar a la impresora en ${PRINTER_IP}:${PRINTER_PORT}. Verifique que la impresora esté encendida y conectada a la red.`);
      } else if (err.code === 'ETIMEDOUT') {
        detailedError = new Error(`Timeout al conectar a la impresora en ${PRINTER_IP}:${PRINTER_PORT}`);
      } else if (err.code === 'EHOSTUNREACH') {
        detailedError = new Error(`No se puede alcanzar la impresora en ${PRINTER_IP}:${PRINTER_PORT}. Verifique la dirección IP.`);
      } else if (err.code === 'ENETUNREACH') {
        detailedError = new Error(`Red no accesible para ${PRINTER_IP}:${PRINTER_PORT}`);
      }

      detailedError.code = err.code;
      safeReject(detailedError);
    });

    // Evento de timeout del socket
    client.on('timeout', () => {
      console.error(' Timeout en socket de impresora');
      safeReject(new Error('Timeout en la conexión con la impresora'));
    });
  });
}

// Endpoint para imprimir pedidos
app.post('/print', verifyToken, async (req, res) => {
  const startTime = Date.now();
  let mesa = 'desconocida';
  serverStats.totalRequests++;

  try {
    const { order, changes } = req.body;

    // --- VALIDACIÓN DE DATOS MEJORADA ---
    if (!order || typeof order !== 'object') {
      console.error(' Error de validación: order no es un objeto válido');
      return res.status(400).json({
        success: false,
        error: 'Datos del pedido incompletos: order debe ser un objeto.'
      });
    }

    if (!order.mesa) {
      console.error(' Error de validación: falta número de mesa');
      return res.status(400).json({
        success: false,
        error: 'Datos del pedido incompletos: falta número de mesa.'
      });
    }

    mesa = order.mesa;

    if (!Array.isArray(order.pedido_items)) {
      console.error(' Error de validación: pedido_items no es un array');
      return res.status(400).json({
        success: false,
        error: 'Datos del pedido incompletos: pedido_items debe ser un array.'
      });
    }

    if (order.pedido_items.length === 0) {
      console.error(' Error de validación: pedido_items está vacío');
      return res.status(400).json({
        success: false,
        error: 'No hay items para imprimir.'
      });
    }

    console.log(` [Mesa ${mesa}] Pedido recibido - Items: ${order.pedido_items.length}, Cambios: ${!!changes}`);

    // Logging detallado de notas (solo en modo debug)
    const notes = [];
    if (Array.isArray(order.pedido_items)) {
      order.pedido_items.forEach(individual => {
        if (individual.notas) {
          if (typeof individual.notas === 'string') {
            try {
              const parsed = JSON.parse(individual.notas);
              notes.push(...(Array.isArray(parsed) ? parsed : [individual.notas]));
            } catch {
              notes.push(individual.notas);
            }
          } else {
            notes.push(individual.notas);
          }
        }
      });
    }

    if (notes.length > 0) {
      console.log(` [Mesa ${mesa}] Notas especiales: ${notes.length}`);
    }

    // Formatear la comanda (puede lanzar excepciones)
    let comandaBuffer;
    try {
      comandaBuffer = formatComanda(order, changes);
      console.log(` [Mesa ${mesa}] Comanda formateada - Buffer size: ${comandaBuffer.length} bytes`);
    } catch (formatError) {
      console.error(` [Mesa ${mesa}] Error al formatear comanda:`, formatError);
      return res.status(500).json({
        success: false,
        error: 'Error al formatear la comanda',
        details: formatError.message
      });
    }

    // Imprimir (con manejo de errores mejorado)
    try {
      await printToThermalPrinter(comandaBuffer);
      const duration = Date.now() - startTime;
      console.log(` [Mesa ${mesa}] Impresión completada en ${duration}ms`);

      // Actualizar estadísticas de éxito
      serverStats.successfulPrints++;
      serverStats.lastPrintTime = new Date();

      res.json({
        success: true,
        message: 'Pedido impreso correctamente',
        mesa: mesa,
        duration: duration
      });
    } catch (printError) {
      // Asegurar que el error tenga un mensaje
      const errorMsg = printError?.message || printError?.toString() || 'Error desconocido de impresión';
      const errorCode = printError?.code || 'UNKNOWN';

      console.error(` [Mesa ${mesa}] Error en impresión:`, errorMsg);

      // Actualizar estadísticas de error
      serverStats.failedPrints++;
      serverStats.lastError = {
        mesa: mesa,
        time: new Date(),
        error: errorMsg,
        code: errorCode
      };

      // NO cerramos el servidor, solo reportamos el error
      return res.status(500).json({
        success: false,
        error: 'Error al enviar a la impresora',
        details: errorMsg,
        code: errorCode,
        mesa: mesa
      });
    }

  } catch (error) {
    // Captura de errores inesperados
    const errorMsg = error?.message || error?.toString() || 'Error desconocido';

    console.error(` [Mesa ${mesa}] ERROR INESPERADO:`, errorMsg);
    console.error('Stack:', error?.stack);

    // Actualizar estadísticas de error
    serverStats.failedPrints++;
    serverStats.lastError = {
      mesa: mesa,
      time: new Date(),
      error: errorMsg,
      type: 'unexpected'
    };

    // Respondemos con error pero NO cerramos el servidor
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Error inesperado al procesar pedido',
        details: errorMsg,
        mesa: mesa
      });
    }
  }
});

// === ESTADÍSTICAS DEL SERVIDOR ===
let serverStats = {
  startTime: new Date(),
  totalRequests: 0,
  successfulPrints: 0,
  failedPrints: 0,
  lastPrintTime: null,
  lastError: null
};

// Endpoint de prueba
app.get('/test', (req, res) => {
  res.json({ message: 'Servidor de impresión HTTPS funcionando correctamente' });
});

// Endpoint de health check con estadísticas
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

// Endpoint para probar impresora - MEJORADO
app.post('/test-print', verifyToken, async (req, res) => {
  console.log(' Iniciando impresión de prueba...');

  try {
    const testData = Buffer.concat([
      ESC_POS.INIT,
      ESC_POS.CENTER,
      ESC_POS.BOLD_ON,
      ESC_POS.TITLE_TEXT,
      iconv.encode('PRUEBA DE IMPRESORA', 'CP850'),
      ESC_POS.FEED_LINE,
      ESC_POS.NORMAL_TEXT,
      ESC_POS.BOLD_OFF,
      ESC_POS.LEFT,
      iconv.encode('Servidor HTTPS funcionando correctamente', 'CP850'),
      ESC_POS.FEED_LINE,
      iconv.encode(`Fecha: ${new Date().toLocaleString('es-PE')}`, 'CP850'),
      ESC_POS.FEED_LINE,
      iconv.encode(`Puerto: ${PORT}`, 'CP850'),
      ESC_POS.FEED_LINE,
      iconv.encode(`Impresora: ${PRINTER_IP}:${PRINTER_PORT}`, 'CP850'),
      ESC_POS.FEED_LINE,
      ESC_POS.FEED_LINE,
      ESC_POS.CUT
    ]);

    await printToThermalPrinter(testData);
    console.log(' Impresión de prueba completada');
    res.json({ success: true, message: 'Impresión de prueba completada' });
  } catch (error) {
    console.error(' Error en impresión de prueba:', error);
    res.status(500).json({
      success: false,
      error: 'Error en impresión de prueba',
      details: error.message
    });
  }
});

// Crear servidor HTTP (ngrok provee HTTPS)
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
  console.log(`   • GET  /health      - Estado y estadísticas del servidor`);
  console.log(`   • POST /print       - Imprimir pedido (requiere auth)`);
  console.log(`   • POST /test-print  - Imprimir prueba (requiere auth)`);
  console.log(`\n Para exponer con ngrok: npm run ngrok`);
  console.log(`\n Monitoreo de errores: ACTIVO`);
  console.log(`   • uncaughtException handler: `);
  console.log(`   • unhandledRejection handler: `);
  console.log(`   • Graceful shutdown: `);
  console.log(`\n Servidor iniciado: ${new Date().toLocaleString('es-PE')}`);
  console.log('═'.repeat(48) + '\n');

  // Imprimir mensaje de inicio en la impresora térmica
  setTimeout(() => {
    console.log('  Enviando mensaje de inicio a la impresora...');
    printStartupMessage();
  }, 2000); // Esperar 2 segundos para que el servidor esté completamente listo

  // Monitor de memoria cada 5 minutos
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);

    console.log(`\n [Monitor] Memoria: RSS=${rss}MB, Heap=${heapUsed}MB | Impresiones: ${serverStats.successfulPrints} ${serverStats.failedPrints}`);
  }, 5 * 60 * 1000); // Cada 5 minutos
});

// Función para imprimir mensaje de inicio
function printStartupMessage() {
  const now = new Date();
  const fecha = now.toLocaleDateString('es-PE');
  const hora = now.toLocaleTimeString('es-PE');
  
  let mensaje = '';
  
  // Reset y configuración inicial
  mensaje += '\x1B\x40'; // ESC @ (Reset de la impresora)
  
  // Centrar texto
  mensaje += '\x1B\x61\x01'; // ESC a 1 (Centrar)
  
  // Texto grande para el título
  mensaje += '\x1B\x21\x30'; // ESC ! 48 (Doble ancho y alto)
  mensaje += '======================\n';
  mensaje += '  SERVIDOR INICIADO  \n';
  mensaje += '======================\n\n';
  
  // Texto normal
  mensaje += '\x1B\x21\x00'; // ESC ! 0 (Texto normal)
  mensaje += `Fecha: ${fecha}\n`;
  mensaje += `Hora: ${hora}\n\n`;
  
  mensaje += 'Sistema de impresion\n';
  mensaje += 'termica ACTIVO\n\n';
  
  mensaje += `IP: ${PRINTER_IP}\n`;
  mensaje += `Puerto: ${PRINTER_PORT}\n`;
  mensaje += `Servidor: Puerto ${PORT}\n\n`;
  
  // Separador
  mensaje += '----------------------\n';
  mensaje += '   Listo para usar   \n';
  mensaje += '----------------------\n\n\n';
  
  // Cortar papel
  mensaje += '\x1D\x56\x42\x00'; // GS V B 0 (Cortar papel)
  
  // Convertir a CP850
  const bufferMessage = iconv.encode(mensaje, 'cp850');
  
  // Crear conexión TCP a la impresora
  const client = new net.Socket();
  
  client.connect(PRINTER_PORT, PRINTER_IP, () => {
    console.log(' Conectado a la impresora para mensaje de inicio');
    client.write(bufferMessage);
  });
  
  client.on('data', (data) => {
    console.log(' Respuesta de impresora:', data.toString());
    client.destroy();
  });
  
  client.on('close', () => {
    console.log(' Mensaje de inicio enviado exitosamente');
  });
  
  client.on('error', (err) => {
    console.error(' Error enviando mensaje de inicio:', err.message);
  });
}