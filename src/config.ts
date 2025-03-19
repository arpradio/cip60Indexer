import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['DB_HOST', 'DB_PASSWORD', 'DB_NAME', 'OGMIOS_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const config = {
  ogmios: {
    url: process.env.OGMIOS_URL,
    reconnectInterval: parseInt(process.env.OGMIOS_RECONNECT_INTERVAL || '5000'),
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    ssl: process.env.DB_SSL === 'true',
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000'),
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  },
  // Other configuration...
};