FROM node:20-alpine

WORKDIR /app

# Copy package files first for caching
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install --prefix server
RUN npm install --prefix client

# Copy all source code
COPY . .

# Generate Prisma Client & Build React app
RUN npm run postinstall --prefix server
RUN npm run build --prefix client

# Expose the standard port
EXPOSE 3000

# Start the server
CMD ["npm", "start", "--prefix", "server"]
