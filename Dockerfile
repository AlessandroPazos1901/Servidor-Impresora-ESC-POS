# Usa Node oficial
FROM node:18

# Crea carpeta de la app
WORKDIR /usr/src/app

# Copia dependencias
COPY package*.json ./
RUN npm install --production

# Instalar utilidades necesarias
RUN apt-get update && apt-get install -y \
    tzdata \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=America/Lima

# Copia código fuente
COPY server.js .
COPY start-ngrok.js .
COPY docker-entrypoint.sh .

# Hacer ejecutable el entrypoint
RUN chmod +x docker-entrypoint.sh

# Crear directorios para logs
RUN mkdir -p /usr/src/app/logs

# Expone puerto 3001 para HTTP (ngrok provee HTTPS)
EXPOSE 3001

# Usar el entrypoint personalizado
ENTRYPOINT ["./docker-entrypoint.sh"]