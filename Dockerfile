# ── Etapa única — producción ──────────────────────────────────────────────────
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar manifiestos primero para aprovechar la caché de capas
COPY package*.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código fuente
COPY . .

# Puerto que expone la API (process.env.PORT || 3001)
EXPOSE 3001

# Comando de arranque
CMD ["node", "app.js"]
