#!/bin/bash
# docker-entrypoint.sh - Script de inicio ultra-confiable para Docker con ngrok

set -e

echo "🐳 Iniciando Servidor de Impresión Térmica con ngrok..."
echo "📅 Fecha: $(date)"
echo " Timezone: $TZ"
echo "  IP Impresora: ${PRINTER_IP}:${PRINTER_PORT}"
echo "🔧 Puerto local: ${PORT:-3001}"

# Función para manejar señales de terminación
cleanup() {
    echo " Recibida señal de terminación, cerrando servicios..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    exit 0
}

# Configurar manejo de señales
trap cleanup SIGTERM SIGINT

# Crear logs si no existen
mkdir -p /usr/src/app/logs
touch /usr/src/app/logs/server.log
touch /usr/src/app/logs/errors.log

# Verificar si se debe usar ngrok
USE_NGROK=${USE_NGROK:-true}

if [ "$USE_NGROK" = "true" ] || [ "$USE_NGROK" = "1" ]; then
    # Verificar authtoken de ngrok
    if [ -z "$NGROK_AUTHTOKEN" ] || [ "$NGROK_AUTHTOKEN" = "tu_authtoken_aqui" ]; then
        echo "  ADVERTENCIA: NGROK_AUTHTOKEN no configurado!"
        echo " No se puede iniciar ngrok sin authtoken válido"
        echo " Iniciando solo servidor local HTTP en puerto ${PORT:-3001}..."
        echo ""
        USE_NGROK="false"
    else
        echo " ngrok configurado correctamente"
        if [ ! -z "$NGROK_DOMAIN" ]; then
            echo " Usando dominio estático: $NGROK_DOMAIN"
        else
            echo "  Sin dominio estático (URL cambiará en cada reinicio)"
        fi
    fi
fi

echo " Iniciando servidor principal..."

# Función para reiniciar el servidor si falla
restart_server() {
    local attempt=1
    local max_attempts=10

    while [ $attempt -le $max_attempts ]; do
        echo "🔄 Intento $attempt/$max_attempts - Iniciando servidor..."

        # Decidir qué iniciar: ngrok o solo servidor
        if [ "$USE_NGROK" = "true" ]; then
            echo " Iniciando con ngrok..."
            node start-ngrok.js >> /usr/src/app/logs/server.log 2>> /usr/src/app/logs/errors.log &
            SERVER_PID=$!
        else
            echo " Iniciando solo servidor HTTP local..."
            node server.js >> /usr/src/app/logs/server.log 2>> /usr/src/app/logs/errors.log &
            SERVER_PID=$!
        fi

        # Esperar un momento para ver si el servidor inicia correctamente
        sleep 5

        # Verificar si el proceso sigue vivo
        if kill -0 $SERVER_PID 2>/dev/null; then
            echo " Servidor iniciado exitosamente (PID: $SERVER_PID)"

            # Mostrar info según el modo
            if [ "$USE_NGROK" = "true" ]; then
                echo " Revisa los logs para ver tu URL pública de ngrok"
                echo " Logs: docker logs -f thermal-printer-server"
            else
                echo " Servidor disponible en: http://localhost:${PORT:-3001}"
            fi

            # Esperar a que termine el servidor
            wait $SERVER_PID
            SERVER_EXIT_CODE=$?

            echo "  Servidor terminó con código: $SERVER_EXIT_CODE"

        else
            echo " El servidor falló al iniciar"
        fi

        # Si llegamos aquí, el servidor terminó - reiniciar
        attempt=$((attempt + 1))
        if [ $attempt -le $max_attempts ]; then
            echo "⏳ Esperando 10 segundos antes del siguiente intento..."
            sleep 10
        fi
    done

    echo " FALLO CRÍTICO: No se pudo iniciar el servidor después de $max_attempts intentos"
    exit 1
}

# Mostrar información del sistema
echo " Información del sistema:"
echo "   • Usuario: $(whoami)"
echo "   • Node.js: $(node --version)"
echo "   • Memoria: $(free -h | grep Mem | awk '{print $2}') total"
echo "   • Espacio: $(df -h /usr/src/app | tail -1 | awk '{print $4}') disponible"

# Iniciar el sistema de reinicio
restart_server