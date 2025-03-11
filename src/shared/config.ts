import dotenv from 'dotenv';

dotenv.config();

export const config = {
    ogmios: {
        url: process.env.OGMIOS_URL || 'ws://192.168.0.141:1337',
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: "ArpR@d101023!",
        database: process.env.DB_NAME || 'postgres'
    },
    api: {
        port: parseInt(process.env.API_PORT || '3000')
    }
};