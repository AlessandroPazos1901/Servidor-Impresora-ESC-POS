# Usa Node oficial
FROM node:18

# Crea carpeta de la app
WORKDIR /usr/src/app

# Copia dependencias
COPY package*.json ./
RUN npm install

RUN apt-get update && apt-get install -y tzdata
ENV TZ=America/Lima

# Copia código fuente
COPY server.js .

# Copia certificados SSL
COPY 192.168.1.47.pem .
COPY 192.168.1.47-key.pem .
        
# Expone puerto 3001 para HTTPS
EXPOSE 3001

# Arranca el server
CMD ["node", "server.js"]