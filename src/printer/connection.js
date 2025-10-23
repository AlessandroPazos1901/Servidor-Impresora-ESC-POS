const net = require('net');

// Configuración de timeouts
const CONNECTION_TIMEOUT = 5000; // 5 segundos
const WRITE_TIMEOUT = 3000; // 3 segundos

// Función para imprimir con manejo robusto de errores
function printToThermalPrinter(data, printerIP, printerPort) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let isResolved = false;
    let connectionTimer = null;
    let writeTimer = null;

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
        client.destroy();
        reject(error);
      }
    };

    // Configurar timeout
    client.setTimeout(CONNECTION_TIMEOUT);

    // Timeout de conexión
    connectionTimer = setTimeout(() => {
      safeReject(new Error(`Timeout al conectar a la impresora ${printerIP}:${printerPort}`));
    }, CONNECTION_TIMEOUT);

    // Evento de conexión exitosa
    client.connect(printerPort, printerIP, () => {
      console.log(` Conectado a impresora ${printerIP}:${printerPort}`);
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

          // Timer para cerrar la conexión
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

    // Evento de cierre
    client.on('close', () => {
      console.log(' Conexión con impresora cerrada');
      safeResolve('Impresión completada exitosamente');
    });

    // Evento de error
    client.on('error', (err) => {
      const errorMessage = err.message || err.code || 'Error desconocido en la conexión';
      console.error(' Error en conexión con impresora:', errorMessage);

      let detailedError = new Error(errorMessage);

      if (err.code === 'ECONNREFUSED') {
        detailedError = new Error(`No se puede conectar a la impresora en ${printerIP}:${printerPort}. Verifique que la impresora esté encendida y conectada a la red.`);
      } else if (err.code === 'ETIMEDOUT') {
        detailedError = new Error(`Timeout al conectar a la impresora en ${printerIP}:${printerPort}`);
      } else if (err.code === 'EHOSTUNREACH') {
        detailedError = new Error(`No se puede alcanzar la impresora en ${printerIP}:${printerPort}. Verifique la dirección IP.`);
      } else if (err.code === 'ENETUNREACH') {
        detailedError = new Error(`Red no accesible para ${printerIP}:${printerPort}`);
      }

      detailedError.code = err.code;
      safeReject(detailedError);
    });

    // Evento de timeout
    client.on('timeout', () => {
      console.error(' Timeout en socket de impresora');
      safeReject(new Error('Timeout en la conexión con la impresora'));
    });
  });
}

module.exports = {
  printToThermalPrinter
};
