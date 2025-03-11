"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
const cors_1 = __importDefault(require("cors"));
const ws_1 = __importDefault(require("ws"));
const express_2 = require("express");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const router = (0, express_2.Router)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.static('public'));
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres'
});
class OgmiosConnection {
    constructor(url) {
        this.ws = null;
        this.reconnectTimer = null;
        this.isConnecting = false;
        this.connectionPromise = null;
        this.messageCallbacks = new Set();
        this.url = url;
    }
    async initialize() {
        if (!this.connectionPromise) {
            this.connectionPromise = this.connect();
        }
        return this.connectionPromise;
    }
    connect() {
        if (this.isConnecting) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            try {
                this.isConnecting = true;
                this.ws = new ws_1.default(this.url);
                this.ws.on('open', () => {
                    this.isConnecting = false;
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = null;
                    }
                    this.ws.on('message', (data) => {
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
            }
            catch (error) {
                this.isConnecting = false;
                this.connectionPromise = null;
                this.scheduleReconnect();
                reject(error);
            }
        });
    }
    scheduleReconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(async () => {
                this.isConnecting = false;
                try {
                    await this.initialize();
                }
                catch (error) {
                    console.error('Reconnection attempt failed:', error);
                }
            }, 5000);
        }
    }
    async sendMessage(message) {
        try {
            await this.initialize();
            if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
                throw new Error('WebSocket is not ready');
            }
            this.ws.send(JSON.stringify(message));
        }
        catch (error) {
            throw error;
        }
    }
    onMessage(callback) {
        this.messageCallbacks.add(callback);
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.on('message', callback);
        }
    }
    removeMessageCallback(callback) {
        this.messageCallbacks.delete(callback);
    }
    isConnected() {
        return this.ws !== null && this.ws.readyState === ws_1.default.OPEN;
    }
    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
class IndexerProgressConnection {
    constructor(url) {
        this.ws = null;
        this.reconnectTimer = null;
        this.isConnecting = false;
        this.url = url;
        this.connect();
    }
    connect() {
        if (this.isConnecting)
            return;
        this.isConnecting = true;
        this.ws = new ws_1.default(this.url);
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
                    networkStats.slot = message.data.currentSlot;
                    networkStats.networkTip = message.data.networkTip;
                    networkStats.syncProgress = (message.data.currentSlot / message.data.networkTip) * 100;
                    networkStats.lastUpdated = new Date();
                    const statsMessage = JSON.stringify({
                        type: 'stats',
                        data: networkStats
                    });
                    clients.forEach(client => {
                        if (client.readyState === ws_1.default.OPEN) {
                            client.send(statsMessage);
                        }
                    });
                }
            }
            catch (error) {
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
    scheduleReconnect() {
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
    lastUpdated: new Date(),
    isConnected: false,
    dbConnected: true
};
ogmiosConnection.onMessage(async (data) => {
    try {
        const response = JSON.parse(data.toString());
        if (response.id === "query-height") {
            networkStats.blockHeight = response.result;
            networkStats.lastUpdated = new Date();
            const message = JSON.stringify({
                type: 'stats',
                data: networkStats
            });
            clients.forEach(client => {
                if (client.readyState === ws_1.default.OPEN) {
                    client.send(message);
                }
            });
        }
        else if (response.id === "query-epoch") {
            networkStats.epoch = response.result;
            networkStats.lastUpdated = new Date();
            const message = JSON.stringify({
                type: 'stats',
                data: networkStats
            });
            clients.forEach(client => {
                if (client.readyState === ws_1.default.OPEN) {
                    client.send(message);
                }
            });
        }
    }
    catch (error) {
        console.error('Error processing Ogmios message:', error);
    }
});
router.get('/stats', async (req, res) => {
    try {
        networkStats.isConnected = ogmiosConnection.isConnected();
        res.json(networkStats);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
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
        }
        else {
            result = await pool.query(recentAssetsQuery);
        }
        res.json(result.rows);
    }
    catch (error) {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent assets' });
    }
});
app.use('/api', router);
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../public/index.html'));
});
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const wss = new ws_1.default.Server({ server });
const clients = new Set();
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({
        type: 'stats',
        data: networkStats
    }));
    ws.on('close', () => {
        clients.delete(ws);
    });
});
async function updateStats() {
    try {
        const assetCount = await pool.query('SELECT COUNT(*) FROM cip60.assets');
        networkStats.processedAssets = parseInt(assetCount.rows[0].count);
        networkStats.isConnected = ogmiosConnection.isConnected();
        networkStats.lastUpdated = new Date();
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
        const message = JSON.stringify({
            type: 'stats',
            data: networkStats
        });
        clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(message);
            }
        });
    }
    catch (error) {
        console.error('Error updating stats:', error);
    }
}
async function startServer() {
    try {
        await ogmiosConnection.initialize();
        updateStats();
        setInterval(updateStats, 5000);
    }
    catch (error) {
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
