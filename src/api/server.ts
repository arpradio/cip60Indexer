import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import WebSocket from 'ws';
import { Router } from 'express';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const router = Router();
const app = express();

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres'
});

class OgmiosConnection {
    private ws: WebSocket | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private readonly url: string;
    private isConnecting: boolean = false;
    private connectionPromise: Promise<void> | null = null;
    private messageCallbacks: Set<(data: WebSocket.Data) => void> = new Set();

    constructor(url: string) {
        this.url = url;
    }

    async initialize(): Promise<void> {
        if (!this.connectionPromise) {
            this.connectionPromise = this.connect();
        }
        return this.connectionPromise;
    }

    private connect(): Promise<void> {
        if (this.isConnecting) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                this.isConnecting = true;
                this.ws = new WebSocket(this.url);

                this.ws.on('open', () => {
                    this.isConnecting = false;
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = null;
                    }

                    this.ws!.on('message', (data) => {
                        this.messageCallbacks.forEach(callback => callback(data));
                    });

                    resolve();
                });

                this.ws.on('close', () => {
                    this.connectionPromise = null;
                    this.scheduleReconnect();
                });

                this.ws.on('error', (error) => {
                    this.connectionPromise = null;
                    this.scheduleReconnect();
                    reject(error);
                });

            } catch (error) {
                this.isConnecting = false;
                this.connectionPromise = null;
                this.scheduleReconnect();
                reject(error);
            }
        });
    }

    private scheduleReconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(async () => {
                this.isConnecting = false;
                try {
                    await this.initialize();
                } catch (error) {
                    console.error('Reconnection attempt failed:', error);
                }
            }, 5000);
        }
    }

    async sendMessage(message: any): Promise<void> {
        try {
            await this.initialize();

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket is not ready');
            }

            this.ws.send(JSON.stringify(message));
        } catch (error) {
            throw error;
        }
    }

    onMessage(callback: (data: WebSocket.Data) => void): void {
        this.messageCallbacks.add(callback);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.on('message', callback);
        }
    }

    removeMessageCallback(callback: (data: WebSocket.Data) => void): void {
        this.messageCallbacks.delete(callback);
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

class IndexerProgressConnection {
    private ws: WebSocket | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private readonly url: string;
    private isConnecting: boolean = false;

    constructor(url: string) {
        this.url = url;
        this.connect();
    }

    private connect() {
        if (this.isConnecting) return;

        this.isConnecting = true;
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            this.isConnecting = false;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            console.log('Connected to Indexer Progress WebSocket');
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'progress') {
                    const currentSlot = message.data.currentSlot;
                    const tipSlot = message.data.networkTip;
                    networkStats.slot = currentSlot;
                    networkStats.networkTip = tipSlot;
                    networkStats.syncProgress = (currentSlot / tipSlot) * 100;
                    networkStats.lastUpdated = new Date();
                }
            } catch (error) {
                console.error('Error processing progress message:', error);
            }
        });

        this.ws.on('close', () => {
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            console.error('Progress WebSocket error:', error);
            this.ws?.close();
        });
    }

    private scheduleReconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                console.log('Attempting to reconnect to Progress WebSocket...');
                this.isConnecting = false;
                this.connect();
            }, 5000);
        }
    }

    close() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.ws?.close();
    }
}

const ogmiosConnection = new OgmiosConnection(process.env.OGMIOS_URL || 'ws://localhost:1337');
const progressConnection = new IndexerProgressConnection('ws://localhost:3001');

let networkStats = {
    blockHeight: 0,
    epoch: 0,
    slot: 0,
    processedAssets: 0,
    syncProgress: 0,
    lastProcessedBlock: '',
    networkTip: 0,
    lastUpdated: new Date()
};

ogmiosConnection.onMessage(async (data) => {
    try {
        const response = JSON.parse(data.toString());

        if (response.id === "query-height") {
            networkStats.blockHeight = response.result;
            networkStats.lastUpdated = new Date();
        }
        else if (response.id === "query-epoch") {
            networkStats.epoch = response.result;
            networkStats.lastUpdated = new Date();
        }
    } catch (error) {
        console.error('Error processing Ogmios message:', error);
    }
});

router.get('/stats', async (req, res) => {
    try {
        res.json(networkStats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

router.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        const ogmiosStatus = ogmiosConnection.isConnected() ? 'connected' : 'disconnected';
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            components: {
                database: 'healthy',
                ogmios: ogmiosStatus
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.get('/assets', async (req, res) => {
    try {
        const { search } = req.query;
        const searchTerm = search ? String(search).trim() : null;


        const recentAssetsQuery = `
            SELECT
                policy_id,
                asset_name,
                metadata_version,
                metadata_json
            FROM cip60.assets 
            ORDER BY id DESC 
           
        `;

        const searchQuery = `
            SELECT 

                policy_id,
                asset_name,
                metadata_version,
                metadata_json
            FROM cip60.assets 
            WHERE LOWER(asset_name::text) LIKE LOWER($1)
            or LOWER(metadata_json::text) LIKE LOWER($1)
            ORDER BY id DESC 
            
        `;

        let result;
        if (searchTerm) {
            result = await pool.query(searchQuery, [`%${searchTerm}%`]);
        } else {
            result = await pool.query(recentAssetsQuery);
        }

        res.json(result.rows);
    } catch (error) {
        console.error('Error in /assets route:', error);
        res.status(500).json({
            error: 'Failed to fetch assets',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

router.get('/assets/recent', async (req, res) => {
    try {
        const result = await pool.query(`
  WITH ranked_assets AS (
    SELECT
        policy_id,
        id,
        asset_name,
        metadata_version,
        metadata_json,
        ROW_NUMBER() OVER (PARTITION BY policy_id ORDER BY id DESC) AS rn
    FROM cip60.assets 
)
SELECT
    policy_id,
    id,
    asset_name,
    metadata_version,
    metadata_json
FROM ranked_assets
WHERE rn = 1
ORDER BY id DESC limit 10
            
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent assets' });
    }
});

app.use('/api', router);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        const updateStats = async () => {
            try {
                const assetCount = await pool.query('SELECT COUNT(*) FROM cip60.assets');
                networkStats.processedAssets = parseInt(assetCount.rows[0].count);

                await Promise.all([
                    ogmiosConnection.sendMessage({
                        jsonrpc: "2.0",
                        method: "queryNetwork/blockHeight",
                        params: {},
                        id: "query-height"
                    }),
                    ogmiosConnection.sendMessage({
                        jsonrpc: "2.0",
                        method: "queryLedgerState/epoch",
                        params: {},
                        id: "query-epoch"
                    })
                ]);
            } catch (error) {
                console.error('Error updating stats:', error);
            }
        };

        await ogmiosConnection.initialize();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            updateStats();
            setInterval(updateStats, 3000);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    progressConnection.close();
    ogmiosConnection.close();
    process.exit(0);
});

startServer();