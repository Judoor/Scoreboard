FROM node:20-alpine
WORKDIR /app

# Dépendances
COPY package*.json ./
RUN npm install --production

# Code serveur
COPY server.js .

# Fichiers frontend
COPY public/ ./public/

# Données persistantes
RUN mkdir -p /data
VOLUME ["/data"]

ENV DB_PATH=/data/db.json
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
