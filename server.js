// server.js - Servidor local para impresión térmica con HTTPS
const express = require('express');
const https = require('https');
const cors = require('cors');
const net = require('net');
const fs = require('fs');
const path = require('path');
const iconv = require("iconv-lite");
const app = express();
const PORT = 3001;

// Configuración de la impresora
const PRINTER_IP = process.env.PRINTER_IP || '192.168.1.200';
const PRINTER_PORT = process.env.PRINTER_PORT || 9100;
const PRINT_SERVER_SECRET = process.env.PRINT_SERVER_SECRET || 'tu-secreto-muy-largo-y-dificil-de-adivinar';

// Configuración HTTPS - Cargar certificados
let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '192.168.1.47-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '192.168.1.47.pem'))
  };
  console.log('✅ Certificados HTTPS cargados correctamente');
} catch (error) {
  console.error('❌ Error cargando certificados:', error.message);
  console.log('Asegúrate de que los archivos printserver.local-key.pem y printserver.local.pem estén en la raíz del proyecto');
  process.exit(1);
}

app.use(cors({ 
  origin: "https://la-casita.vercel.app",
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

// Función para imprimir
function printToThermalPrinter(data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    
    client.connect(PRINTER_PORT, PRINTER_IP, () => {
      console.log('Conectado a la impresora');
      client.write(data);
    });
    
    client.on('close', () => {
      console.log('Conexión cerrada');
      resolve('Impresión completada');
    });
    
    client.on('error', (err) => {
      console.error('Error de impresión:', err);
      reject(err);
    });
    
    // Cerrar conexión después de escribir
    setTimeout(() => {
      client.end();
    }, 1000);
  });
}

// Endpoint para imprimir pedidos
app.post('/print', verifyToken, async (req, res) => {
  try {
    const { order, changes } = req.body;
    
    // --- VALIDACIÓN DE DATOS AÑADIDA ---
    if (!order || typeof order !== 'object' || !order.mesa || !Array.isArray(order.pedido_items)) {
      return res.status(400).json({ error: 'Datos del pedido incompletos o malformados.' });
    }
    
    console.log('Recibido pedido para imprimir:', { mesa: order.mesa, changes: !!changes, pedido_items: order.pedido_items });
    notes = []
    if (Array.isArray(order.pedido_items)) {
    order.pedido_items.forEach(individual => {
      console.log("INDIVIDUAL: ",individual)
      if (individual.notas) {
        console.log("NOTAS: ",individual.notas)
        // Parsear JSON string si es necesario
        if (typeof individual.notas === 'string') {
          try {
            const parsed = JSON.parse(individual.notas);
            console.log("PARSED: ",parsed)
            notes.push(...(Array.isArray(parsed) ? parsed : [individual.notas]));
            console.log("NOTES: ",notes)
          } catch {
            notes.push(individual.notas);
            console.log("NOTES CATCH: ",notes)
          }
        } else {
          notes.push(individual.notas);
          console.log("NOTES ELSE: ",notes)
        }
      }
    });
  }
    // Formatear la comanda
    const comandaBuffer = formatComanda(order, changes);
    
    // Imprimir
    await printToThermalPrinter(comandaBuffer);
    
    res.json({ success: true, message: 'Pedido impreso correctamente' });
    
  } catch (error) {
    console.error('Error al imprimir:', error);
    res.status(500).json({ 
      error: 'Error al imprimir pedido',
      details: error.message 
    });
  }
});

// Endpoint de prueba
app.get('/test', (req, res) => {
  res.json({ message: 'Servidor de impresión HTTPS funcionando correctamente' });
});

// Endpoint para probar impresora - CORREGIDO
app.post('/test-print', verifyToken, async (req, res) => {
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
      ESC_POS.FEED_LINE,
      ESC_POS.CUT
    ]);
    
    await printToThermalPrinter(testData);
    res.json({ success: true, message: 'Impresión de prueba completada' });
  } catch (error) {
    console.error('Error en impresión de prueba:', error);
    res.status(500).json({ error: 'Error en impresión de prueba', details: error.message });
  }
});

// Crear servidor HTTPS
const server = https.createServer(httpsOptions, app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🖨️  Servidor de impresión HTTPS ejecutándose en puerto ${PORT}`);
  console.log(`📡 Configurado para impresora en ${PRINTER_IP}:${PRINTER_PORT}`);
  console.log(`🔐 Disponible en: https://192.168.1.47:${PORT}`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   • https://192.168.1.47:${PORT}/test`);
  console.log(`   • https://192.168.1.47:${PORT}/print (POST)`);
  console.log(`   • https://192.168.1.47:${PORT}/test-print (POST)`);
  
  // Imprimir mensaje de inicio en la impresora térmica
  setTimeout(() => {
    console.log('🖨️  Enviando mensaje de inicio a la impresora...');
    printStartupMessage();
  }, 2000); // Esperar 2 segundos para que el servidor esté completamente listo
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
    console.log('✅ Conectado a la impresora para mensaje de inicio');
    client.write(bufferMessage);
  });
  
  client.on('data', (data) => {
    console.log('📄 Respuesta de impresora:', data.toString());
    client.destroy();
  });
  
  client.on('close', () => {
    console.log('✅ Mensaje de inicio enviado exitosamente');
  });
  
  client.on('error', (err) => {
    console.error('❌ Error enviando mensaje de inicio:', err.message);
  });
}