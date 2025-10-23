const iconv = require("iconv-lite");
const ESC_POS = require('../config/escpos');
const { getNotes } = require('../utils/orderUtils');

// Función para crear el formato de la comanda
function formatComanda(order, changes) {
  const isUpdate = changes && (changes.agregados?.length > 0 || changes.eliminados?.length > 0 || changes.modificados?.length > 0);
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

  // Función para líneas punteadas
  const addDashedLine = (totalChars = 47) => {
    addCommand(ESC_POS.NORMAL_TEXT);
    addText('-'.repeat(totalChars));
    addCommand(ESC_POS.FEED_LINE);
  };

  // Función para printRow
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
  addCommand(ESC_POS.NORMAL_TEXT);
  addCommand(ESC_POS.FEED_LINE);

  // TÍTULO CENTRADO
  addCommand(ESC_POS.CENTER);
  addCommand(ESC_POS.BOLD_ON);
  addCommand(ESC_POS.TITLE_TEXT);
  addText(isUpdate ? ' --- ACTUALIZACION --- ' : ' --- NUEVO PEDIDO --- ');
  addCommand(ESC_POS.FEED_LINE);
  addCommand(ESC_POS.NORMAL_TEXT);
  addCommand(ESC_POS.BOLD_OFF);
  addCommand(ESC_POS.LEFT);

  // LÍNEA PUNTEADA
  addCommand(ESC_POS.FEED_LINE);
  addDashedLine();

  // MESA Y HORA
  addCommand(ESC_POS.BOLD_ON);
  addCommand(ESC_POS.HEADER_TEXT);
  addCommand(ESC_POS.FEED_HALF_LINES);
  printRow(`MESA: ${order.mesa}`, `${order.created_at}`);
  addCommand(ESC_POS.NORMAL_TEXT);
  addCommand(ESC_POS.BOLD_OFF);
  addCommand(ESC_POS.FEED_LINE);

  // MOZO
  addCommand(ESC_POS.FEED_HALF_LINES);
  addCommand(ESC_POS.NORMAL_TEXT);
  addText(`Por: ${order.mozo || order.atendido_por || 'Admin'}`);
  addCommand(ESC_POS.FEED_LINE);

  // LÍNEA PUNTEADA
  addCommand(ESC_POS.FEED_HALF_LINES);
  addDashedLine();

  if (isUpdate) {
    // PRODUCTOS AGREGADOS
    if (changes.agregados?.length > 0) {
      addCommand(ESC_POS.FEED_HALF_LINES);
      addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.HEADER_TEXT);
      addText('AGREGA:');
      addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);

      changes.agregados.forEach(item => {
        addCommand(ESC_POS.FEED_LINE);
        addCommand(ESC_POS.PRODUCT_TEXT);
        addText(`- ${item.quantity} ${item.nombre}`);
        addCommand(ESC_POS.NORMAL_TEXT);
        addCommand(ESC_POS.FEED_LINE);

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

    // PRODUCTOS ELIMINADOS
    if (changes.eliminados?.length > 0) {
      addCommand(ESC_POS.FEED_LINE);
      addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.HEADER_TEXT);
      addText('ELIMINA:');
      addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);

      changes.eliminados.forEach(item => {
        addCommand(ESC_POS.FEED_LINE);
        addCommand(ESC_POS.PRODUCT_TEXT);
        addText(`- ${item.quantity} ${item.nombre}`);
        addCommand(ESC_POS.NORMAL_TEXT);
        addCommand(ESC_POS.FEED_LINE);

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

    // ESPECIFICACIONES MODIFICADAS
    if (changes.modificados?.length > 0) {
      addCommand(ESC_POS.FEED_LINE);
      addCommand(ESC_POS.BOLD_ON);
      addCommand(ESC_POS.HEADER_TEXT);
      addText('ESPECIFICACION:');
      addCommand(ESC_POS.BOLD_OFF);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);

      changes.modificados.forEach(item => {
        const originales = item.especificacionesOriginales || [];
        const nuevas = item.especificacionesNuevas || [];

        const agregadas = nuevas.filter(spec => !originales.includes(spec));
        const quitadas = originales.filter(spec => !nuevas.includes(spec));

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
        addCommand(ESC_POS.PRODUCT_TEXT);
        addText(`- 1 ${item.nombre}:`);
        addCommand(ESC_POS.NORMAL_TEXT);
        addCommand(ESC_POS.FEED_LINE);

        cambios.forEach(cambio => {
          addCommand(ESC_POS.SMALL_TEXT);
          addText(`    * ${cambio}`);
          addCommand(ESC_POS.FEED_LINE);
        });
        addCommand(ESC_POS.NORMAL_TEXT);
      });
    }
  } else {
    // PEDIDO COMPLETO
    const items = order.pedido_items || order.currentOrder || [];

    // OPTIMIZACIÓN: Procesar items en lotes pequeños para no sobrecargar el buffer
    items.forEach((item, index) => {
      addCommand(ESC_POS.FEED_LINE);
      addCommand(ESC_POS.PRODUCT_TEXT);
      addText(`- ${item.quantity || item.cantidad} ${item.nombre || item.producto?.nombre}`);
      addCommand(ESC_POS.NORMAL_TEXT);
      addCommand(ESC_POS.FEED_LINE);

      // Notas
      const notes = getNotes(item);
      if (notes.length > 0) {
        notes.forEach(nota => {
          addCommand(ESC_POS.SMALL_TEXT);
          addText(`  * ${nota}`);
          addCommand(ESC_POS.FEED_LINE);
        });
        addCommand(ESC_POS.NORMAL_TEXT);
      }
    });
  }

  // LÍNEA FINAL
  addCommand(ESC_POS.FEED_LINE);
  addDashedLine();
  addCommand(ESC_POS.FEED_LINE);

  // Corte
  addCommand(ESC_POS.CUT);

  return comandaBuffer;
}

module.exports = {
  formatComanda
};
