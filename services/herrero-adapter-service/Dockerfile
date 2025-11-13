# Dockerfile para Herrero Adapter Service

# Usar una imagen base de Node.js
FROM node:18-alpine

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias de la aplicación
RUN npm install

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto que la aplicación usará (si aplica)
# No se exponen puertos ya que la comunicación es interna vía event-bus

# Comando para iniciar la aplicación
CMD [ "node", "index.js" ]
