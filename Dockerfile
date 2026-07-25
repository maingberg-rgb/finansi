FROM node:20-alpine

# Install openssl for Prisma client runtime compatibility in Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files first for caching
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies (ignoring scripts so Prisma doesn't run prematurely before code is copied)
RUN npm install --prefix server --ignore-scripts
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
