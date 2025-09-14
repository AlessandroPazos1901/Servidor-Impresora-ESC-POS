# Servidor de Impresión Térmica

Servidor local HTTPS para impresión térmica de comandas a impresoras ESC/POS compatibles.

## Descripción

Este es un servidor Node.js que actúa como puente entre una aplicación web y una impresora térmica en la red local. Permite imprimir comandas y actualizaciones de pedidos con formato térmico optimizado.

## Características

- **Servidor HTTPS** con certificados autofirmados
- **Autenticación** mediante Bearer token
- **CORS** configurado para origen específico
- **Comunicación TCP/IP** con impresora térmica
- **Formato ESC/POS** con codificación CP850
- **Impresión de diferencias** para actualizaciones de pedidos
- **Soporte Docker** con auto-reinicio y monitoreo

## Requisitos Previos

1. **Node.js** versión 16 o superior
2. **npm** (incluido con Node.js)
3. Una impresora térmica compatible con ESC/POS conectada a la red
4. Sistema operativo: Windows, macOS o Linux

## Instalación Paso a Paso

### 1. Descargar e Instalar Node.js
- Visita https://nodejs.org
- Descarga la versión LTS (recomendada)
- Ejecuta el instalador y sigue las instrucciones
- Verifica la instalación abriendo terminal/cmd y ejecutando:
  ```bash
  node --version
  npm --version
  ```

### 2. Obtener el Código del Proyecto
- Descarga o clona el proyecto en tu computadora
- Navega a la carpeta del proyecto en la terminal:
  ```bash
  cd ruta/al/proyecto/print-server
  ```

### 3. Instalar Dependencias
```bash
npm install
```

### 4. Configurar Variables de Entorno
Edita el archivo `.env` con los siguientes valores:

```env
# IP de tu impresora térmica
PRINTER_IP=192.168.1.200

# Puerto de la impresora (generalmente 9100)
PRINTER_PORT=9100

# Token secreto para autenticación (cambia este valor)
PRINT_SERVER_SECRET=tu-token-secreto-aqui
```

### 5. Configurar Certificados SSL
El proyecto incluye certificados SSL para la IP `192.168.1.47`. Si tu computadora tiene una IP diferente:

**Opción A**: Cambiar la IP de tu computadora a `192.168.1.47`

**Opción B**: Generar nuevos certificados para tu IP actual:
```bash
# Instalar mkcert (opcional, para certificados confiables)
# Windows: choco install mkcert
# macOS: brew install mkcert
# Linux: apt install libnss3-tools && wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 && chmod +x mkcert && sudo mv mkcert /usr/local/bin/

# Generar certificados (reemplaza TU_IP con la IP de tu computadora)
mkcert TU_IP
```

### 6. Verificar Configuración de Red
- Asegúrate de que tu computadora y la impresora estén en la misma red
- Verifica que puedes hacer ping a la impresora:
  ```bash
  ping 192.168.1.200
  ```

### 7. Ejecutar el Servidor

**Para desarrollo (con auto-reinicio):**
```bash
npm run dev
```

**Para producción:**
```bash
npm start
```

**Ejecutar directamente:**
```bash
node server.js
```

### 8. Verificar Instalación
- El servidor debería iniciarse en `https://TU_IP:3001`
- Prueba el endpoint de salud: `GET https://TU_IP:3001/test`
- Prueba la impresión: `POST https://TU_IP:3001/test-print`

## Instalación con Docker

### 1. Instalar Docker
- Descarga Docker Desktop desde https://docker.com
- Sigue las instrucciones de instalación para tu sistema operativo

### 2. Construir y Ejecutar
```bash
# Construir la imagen
docker build -t thermal-printer-server .

# Ejecutar el contenedor
docker run --env-file .env -p 3001:3001 thermal-printer-server

# O usar docker-compose
docker-compose up -d
```

## API Endpoints

### `GET /test`
Endpoint de verificación de estado del servidor.

### `POST /test-print`
Imprime una página de prueba.

**Headers requeridos:**
```
Authorization: Bearer YOUR_SECRET_TOKEN
```

### `POST /print`
Imprime una comanda completa o actualización.

**Headers requeridos:**
```
Authorization: Bearer YOUR_SECRET_TOKEN
Content-Type: application/json
```

**Formato del cuerpo de la solicitud:**
```json
{
  "order": {
    "mesa": "número_de_mesa",
    "mozo": "nombre_del_mozo",
    "created_at": "timestamp",
    "pedido_items": []
  },
  "changes": {
    "agregados": [],
    "eliminados": [],
    "modificados": []
  }
}
```

## Comandos Disponibles

### Desarrollo
- `npm start` - Iniciar servidor en producción
- `npm run dev` - Iniciar servidor de desarrollo con nodemon
- `node server.js` - Ejecutar servidor directamente

### Docker
- `docker build -t thermal-printer-server .` - Construir imagen
- `docker run --env-file .env -p 3001:3001 thermal-printer-server` - Ejecutar contenedor
- `docker-compose up -d` - Iniciar con compose

## Estructura del Proyecto

```
print-server/
├── server.js              # Servidor principal con lógica ESC/POS
├── package.json           # Dependencias y scripts
├── .env                   # Variables de entorno
├── 192.168.1.47.pem       # Certificado SSL
├── 192.168.1.47-key.pem   # Clave privada SSL
├── Dockerfile             # Configuración de contenedor
├── docker-compose.yml     # Orquestación de contenedor
├── docker-entrypoint.sh   # Script de inicio con auto-reinicio
└── CLAUDE.md             # Instrucciones para Claude Code
```

## Solución de Problemas

### Error de Conexión a Impresora
- Verifica la IP y puerto de la impresora en `.env`
- Asegúrate de que la impresora esté encendida y conectada a la red
- Revisa que no haya firewall bloqueando el puerto 9100
- Prueba hacer ping a la IP de la impresora

### Error de Certificado SSL
- Acepta el certificado autofirmado en tu navegador
- O regenera los certificados para tu IP actual usando mkcert
- Verifica que los archivos .pem estén en el directorio raíz

### Puerto en Uso
- Si el puerto 3001 está ocupado, cambia el puerto en `server.js`
- O termina el proceso que está usando el puerto:
  ```bash
  # Windows
  netstat -ano | findstr :3001
  taskkill /F /PID <PID>

  # Linux/macOS
  lsof -ti:3001 | xargs kill -9
  ```

### Error de Autenticación
- Verifica que el token en `.env` coincida con el enviado en el header `Authorization: Bearer`
- El formato debe ser exactamente: `Authorization: Bearer tu-token-secreto`

### Problemas de Codificación
- El servidor usa codificación CP850 para caracteres especiales en español
- Si hay problemas con acentos, verifica la configuración de la impresora

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crea un Pull Request

## Licencia

ISC