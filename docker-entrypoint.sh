#!/bin/bash
# docker-entrypoint.sh - Script de inicio ultra-confiable para Docker

set -e

echo "🐳 Iniciando Servidor de Impresión Térmica Ultra-Confiable..."
echo "📅 Fecha: $(date)"
echo "🌐 Timezone: $TZ"
echo "🖨️  IP Impresora: ${PRINTER_IP}:${PRINTER_PORT}"

# Función para manejar señales de terminación
cleanup() {
    echo "🛑 Recibida señal de terminación, cerrando servicios..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    if [ ! -z "$WATCHDOG_PID" ]; then
        kill $WATCHDOG_PID 2>/dev/null || true
    fi
    exit 0
}

# Configurar manejo de señales
trap cleanup SIGTERM SIGINT

# Verificar certificados
if [ ! -f "/usr/src/app/certs/192.168.1.47.pem" ] || [ ! -f "/usr/src/app/certs/192.168.1.47-key.pem" ]; then
    echo "⚠️  Certificados SSL no encontrados en /usr/src/app/certs/"
    echo "💡 Montando volumen con certificados o generando certificados temporales..."
fi

# Crear logs si no existen
touch /usr/src/app/logs/server.log
touch /usr/src/app/logs/errors.log
touch /usr/src/app/logs/watchdog.log

echo "🚀 Iniciando servidor principal..."

# Función para reiniciar el servidor si falla
restart_server() {
    local attempt=1
    local max_attempts=10

    while [ $attempt -le $max_attempts ]; do
        echo "🔄 Intento $attempt/$max_attempts - Iniciando servidor..."
        
        # Iniciar servidor en segundo plano
        node server.js &
        SERVER_PID=$!
        
        # Esperar un momento para ver si el servidor inicia correctamente
        sleep 5
        
        # Verificar si el proceso sigue vivo
        if kill -0 $SERVER_PID 2>/dev/null; then
            echo "✅ Servidor iniciado exitosamente (PID: $SERVER_PID)"
            
            # Iniciar watchdog en segundo plano
            echo "🐕 Iniciando watchdog monitor..."
            node watchdog.js &
            WATCHDOG_PID=$!
            echo "✅ Watchdog iniciado (PID: $WATCHDOG_PID)"
            
            # Esperar a que termine el servidor
            wait $SERVER_PID
            SERVER_EXIT_CODE=$?
            
            echo "⚠️  Servidor terminó con código: $SERVER_EXIT_CODE"
            
            # Detener watchdog
            if [ ! -z "$WATCHDOG_PID" ]; then
                kill $WATCHDOG_PID 2>/dev/null || true
                wait $WATCHDOG_PID 2>/dev/null || true
            fi
            
        else
            echo "❌ El servidor falló al iniciar"
        fi
        
        # Si llegamos aquí, el servidor terminó - reiniciar
        attempt=$((attempt + 1))
        if [ $attempt -le $max_attempts ]; then
            echo "⏳ Esperando 10 segundos antes del siguiente intento..."
            sleep 10
        fi
    done
    
    echo "❌ FALLO CRÍTICO: No se pudo iniciar el servidor después de $max_attempts intentos"
    exit 1
}

# Mostrar información del sistema
echo "📊 Información del sistema:"
echo "   • Usuario: $(whoami)"
echo "   • Node.js: $(node --version)"
echo "   • Memoria: $(free -h | grep Mem | awk '{print $2}') total"
echo "   • Espacio: $(df -h /usr/src/app | tail -1 | awk '{print $4}') disponible"

# Iniciar el sistema de reinicio
restart_server