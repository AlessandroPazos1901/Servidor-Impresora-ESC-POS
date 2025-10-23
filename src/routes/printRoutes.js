const express = require('express');
const { formatComanda } = require('../printer/formatter');
const { printToThermalPrinter } = require('../printer/connection');

const router = express.Router();

// Middleware de autenticación (se inyectará)
let verifyToken = null;
let serverStats = null;
let printerConfig = null;

// Configurar dependencias
function configure(config) {
  verifyToken = config.verifyToken;
  serverStats = config.serverStats;
  printerConfig = config.printerConfig;
}

// Endpoint para imprimir pedidos
router.post('/print', (req, res) => {
  if (!verifyToken) {
    return res.status(500).json({ error: 'Servidor no configurado correctamente' });
  }

  verifyToken(req, res, async () => {
    const startTime = Date.now();
    let mesa = 'desconocida';
    serverStats.totalRequests++;

    try {
      const { order, changes } = req.body;

      // Validación de datos
      if (!order || typeof order !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Datos del pedido incompletos: order debe ser un objeto.'
        });
      }

      if (!order.mesa) {
        return res.status(400).json({
          success: false,
          error: 'Datos del pedido incompletos: falta número de mesa.'
        });
      }

      mesa = order.mesa;

      if (!Array.isArray(order.pedido_items)) {
        return res.status(400).json({
          success: false,
          error: 'Datos del pedido incompletos: pedido_items debe ser un array.'
        });
      }

      if (order.pedido_items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No hay items para imprimir.'
        });
      }

      console.log(` [Mesa ${mesa}] Pedido recibido - Items: ${order.pedido_items.length}, Cambios: ${!!changes}`);

      // Log del JSON completo
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('PEDIDO RECIBIDO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      // console.log(JSON.stringify({ order, changes }, null, 2));
      //console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Formatear la comanda
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

      // Imprimir
      try {
        await printToThermalPrinter(comandaBuffer, printerConfig.ip, printerConfig.port);
        const duration = Date.now() - startTime;
        console.log(` [Mesa ${mesa}] Impresión completada en ${duration}ms`);

        serverStats.successfulPrints++;
        serverStats.lastPrintTime = new Date();

        res.json({
          success: true,
          message: 'Pedido impreso correctamente',
          mesa: mesa,
          duration: duration
        });
      } catch (printError) {
        const errorMsg = printError?.message || printError?.toString() || 'Error desconocido de impresión';
        const errorCode = printError?.code || 'UNKNOWN';

        console.error(` [Mesa ${mesa}] Error en impresión:`, errorMsg);

        serverStats.failedPrints++;
        serverStats.lastError = {
          mesa: mesa,
          time: new Date(),
          error: errorMsg,
          code: errorCode
        };

        return res.status(500).json({
          success: false,
          error: 'Error al enviar a la impresora',
          details: errorMsg,
          code: errorCode,
          mesa: mesa
        });
      }

    } catch (error) {
      const errorMsg = error?.message || error?.toString() || 'Error desconocido';

      console.error(` [Mesa ${mesa}] ERROR INESPERADO:`, errorMsg);
      console.error('Stack:', error?.stack);

      serverStats.failedPrints++;
      serverStats.lastError = {
        mesa: mesa,
        time: new Date(),
        error: errorMsg,
        type: 'unexpected'
      };

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
});

// Endpoint de prueba de impresión
router.post('/test-print', (req, res) => {
  if (!verifyToken) {
    return res.status(500).json({ error: 'Servidor no configurado correctamente' });
  }

  verifyToken(req, res, async () => {
    const iconv = require("iconv-lite");
    const ESC_POS = require('../config/escpos');

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
        iconv.encode(`Puerto: ${printerConfig.serverPort}`, 'CP850'),
        ESC_POS.FEED_LINE,
        iconv.encode(`Impresora: ${printerConfig.ip}:${printerConfig.port}`, 'CP850'),
        ESC_POS.FEED_LINE,
        ESC_POS.FEED_LINE,
        ESC_POS.CUT
      ]);

      await printToThermalPrinter(testData, printerConfig.ip, printerConfig.port);
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
});

module.exports = {
  router,
  configure
};
