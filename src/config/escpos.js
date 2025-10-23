// Comandos ESC/POS para impresora térmica
const ESC_POS = {
  INIT: Buffer.from([0x1B, 0x40]), // Inicializar impresora
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]), // Negrita ON
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]), // Negrita OFF
  CENTER: Buffer.from([0x1B, 0x61, 0x01]), // Centrar
  LEFT: Buffer.from([0x1B, 0x61, 0x00]), // Alinear izquierda
  FEED_LINE: Buffer.from([0x0A]), // Nueva línea
  CUT: Buffer.from([0x1D, 0x56, 0x42, 0x00]), // Corte parcial

  // Tamaños de texto
  TITLE_TEXT: Buffer.from([0x1B, 0x21, 0x30]), // Títulos principales (doble altura y ancho)
  HEADER_TEXT: Buffer.from([0x1B, 0x21, 0x20]), // Encabezados (doble altura)
  NORMAL_TEXT: Buffer.from([0x1B, 0x21, 0x00]), // Texto normal
  PRODUCT_TEXT: Buffer.from([0x1B, 0x21, 0x20]), // Nombres de productos (doble ancho)
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

module.exports = ESC_POS;
