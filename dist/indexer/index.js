"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const ws_2 = require("ws");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
const chalk_1 = __importDefault(require("chalk"));
const ConsoleLogger_1 = require("../utils/ConsoleLogger");
dotenv_1.default.config();
class ProgressServer {
    constructor(port) {
        this.clients = new Set();
        this.wss = new ws_2.WebSocketServer({ port });
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });
    }
    broadcastProgress(currentSlot, networkTip) {
        const message = JSON.stringify({
            type: 'progress',
            data: { currentSlot, networkTip }
        });
        this.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(message);
            }
        });
    }
}
class MusicTokenIndexer {
    constructor(ogmiosUrl, dbConfig) {
        this.ogmiosUrl = ogmiosUrl;
        this.dbConfig = dbConfig;
        this.networkBlockHeight = 0;
        this.latestProcessedSlot = 0;
        this.latestProcessedHash = '';
        this.loadedSlot = 0;
        this.isProcessing = false;
        this.ERA_BOUNDARIES = [
            { slot: 4492799, hash: "f8084c61b6a238acec985b59310b6ecec49c0ab8352249afd7268da5cff2a457" },
            { slot: 16588737, hash: "4e9bbbb67e3ae262133d94c3da5bffce7b1127fc436e7433b87668dba34c354a" },
            { slot: 23068793, hash: "69c44ac1dda2ec74646e4223bc804d9126f719b1c245dadc2ad65e8de1b276d7" },
            { slot: 39916796, hash: "e72579ff89dc9ed325b723a33624b596c08141c7bd573ecfff56a1f7229e4d09" },
            { slot: 72316796, hash: "c58a24ba8203e7629422a24d9dc68ce2ed495420bf40d9dab124373655161a20" },
            { slot: 133660799, hash: "e757d57eb8dc9500a61c60a39fadb63d9be6973ba96ae337fd24453d4d15c343" },
        ];
        this.pool = new pg_1.default.Pool(dbConfig);
        this.progressServer = new ProgressServer(3001);
    }
    async start() {
        try {
            await this.pool.query('SELECT NOW()');
            const lastState = await this.loadLastState();
            if (lastState) {
                this.loadedSlot = Number(lastState.slot);
                this.latestProcessedSlot = this.loadedSlot;
                this.latestProcessedHash = lastState.hash;
                console.log(`Loaded last state from database - Slot: ${this.latestProcessedSlot}, Hash: ${lastState.hash}`);
            }
            else {
                this.loadedSlot = 52876752;
                this.latestProcessedSlot = this.loadedSlot;
                this.latestProcessedHash = "af192981f47a4150b4d4f96e2184050699febbbc31de18c3815bb5f338578ff6";
                console.log('No previous state found in database, using Allegra as starting point...');
            }
            if (!this.latestProcessedSlot || !this.latestProcessedHash) {
                throw new Error('Failed to initialize state');
            }
            this.connectToOgmios();
        }
        catch (error) {
            throw error;
        }
    }
    async stop() {
        this.isProcessing = false;
        if (this.latestProcessedSlot > this.loadedSlot && this.latestProcessedHash) {
            try {
                await this.saveState(this.latestProcessedSlot, this.latestProcessedHash);
            }
            catch (error) {
                console.error('Error saving final state:', error);
            }
        }
        if (this.ws) {
            this.ws.close();
        }
        await this.pool.end();
    }
    async loadLastState() {
        console.log(chalk_1.default.cyan('Loading last known state from database...'));
        const result = await this.pool.query(`
            SELECT last_slot::bigint as last_slot, last_block_hash, updated_at
            FROM cip60.indexer_state 
            ORDER BY updated_at DESC 
            LIMIT 1
        `);
        return result.rows[0] ? {
            slot: Number(result.rows[0].last_slot),
            hash: result.rows[0].last_block_hash,
            updated_at: result.rows[0].updated_at
        } : null;
    }
    async saveState(slot, hash) {
        await this.pool.query(`
            INSERT INTO cip60.indexer_state (last_slot, last_block_hash)
            VALUES ($1::bigint, $2)
        `, [slot, hash]);
    }
    async queryNetworkBlockHeight() {
        return new Promise((resolve, reject) => {
            const message = {
                jsonrpc: "2.0",
                method: "queryNetwork/blockHeight",
                params: {},
                id: "query-height"
            };
            const timeoutId = setTimeout(() => {
                this.ws.removeListener('message', messageHandler);
                reject(new Error('Network height query timeout'));
            }, 10000);
            const messageHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === "query-height") {
                        clearTimeout(timeoutId);
                        this.ws.removeListener('message', messageHandler);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        }
                        else {
                            resolve(response.result);
                        }
                    }
                }
                catch (error) {
                    clearTimeout(timeoutId);
                    this.ws.removeListener('message', messageHandler);
                    reject(error);
                }
            };
            this.ws.on('message', messageHandler);
            try {
                this.ws.send(JSON.stringify(message));
            }
            catch (error) {
                clearTimeout(timeoutId);
                this.ws.removeListener('message', messageHandler);
                reject(error);
            }
        });
    }
    connectToOgmios() {
        this.ws = new ws_1.default(this.ogmiosUrl);
        this.isProcessing = true;
        this.ws.on('open', async () => {
            try {
                this.networkBlockHeight = await this.queryNetworkBlockHeight();
                this.startChainSync();
            }
            catch (error) {
                this.ws.close();
            }
        });
        this.ws.on('message', async (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === 'find-intersection') {
                    console.log('Intersection found');
                    this.requestNext();
                }
                else if (response.result) {
                    await this.processBlock(response.result);
                    this.requestNext();
                }
            }
            catch (error) {
                this.requestNext();
            }
        });
        this.ws.on('error', () => {
            setTimeout(() => this.connectToOgmios(), 5000);
        });
        this.ws.on('close', () => {
            setTimeout(() => this.connectToOgmios(), 5000);
        });
    }
    async startChainSync(retries = 0) {
        try {
            const points = [{
                    slot: Number(this.latestProcessedSlot),
                    id: this.latestProcessedHash
                }];
            for (const eraBoundary of this.ERA_BOUNDARIES) {
                if (eraBoundary.slot < this.latestProcessedSlot) {
                    points.push({
                        slot: Number(eraBoundary.slot),
                        id: eraBoundary.hash
                    });
                }
            }
            points.sort((a, b) => b.slot - a.slot);
            this.sendMessage("findIntersection", { points }, "find-intersection");
        }
        catch (error) {
            console.error('Failed to start chain sync:', error);
            if (retries < 3) {
                setTimeout(() => this.startChainSync(retries + 1), 5000);
            }
            else {
                this.ws.close();
            }
        }
    }
    async processBlock(block) {
        const blockData = block.block;
        if (!blockData || !blockData.slot || !blockData.id) {
            return;
        }
        const currentSlot = Number(blockData.slot);
        if (isNaN(currentSlot)) {
            ConsoleLogger_1.ConsoleLogger.logError('Invalid slot number received', blockData.slot);
            return;
        }
        const foundMetadata = [];
        const findMusicMetadata = (obj, path = []) => {
            if (!obj || typeof obj !== 'object')
                return;
            if ('music_metadata_version' in obj) {
                foundMetadata.push({ path, metadata: obj });
                return;
            }
            for (const key in obj) {
                findMusicMetadata(obj[key], [...path, key]);
            }
        };
        if (blockData.transactions) {
            for (const tx of blockData.transactions) {
                if (tx.metadata) {
                    findMusicMetadata(tx.metadata);
                }
            }
        }
        for (const { path, metadata } of foundMetadata) {
            try {
                const index721 = path.indexOf('721');
                if (index721 >= 0 && index721 + 3 < path.length) {
                    const policyId = path[index721 + 2];
                    const assetName = path[index721 + 3];
                    await this.handleMusicMetadata(policyId, assetName, metadata);
                    ConsoleLogger_1.ConsoleLogger.logMetadataFound(policyId, assetName, metadata.music_metadata_version);
                }
            }
            catch (error) {
                ConsoleLogger_1.ConsoleLogger.logError('Error processing metadata', error);
            }
        }
        if (currentSlot > this.loadedSlot) {
            this.latestProcessedSlot = currentSlot;
            this.latestProcessedHash = blockData.id;
        }
        if (block.tip) {
            const tipSlot = Number(block.tip.slot);
            if (!isNaN(tipSlot)) {
                ConsoleLogger_1.ConsoleLogger.updateProgress(currentSlot, tipSlot, this.networkBlockHeight);
                this.progressServer.broadcastProgress(currentSlot, tipSlot);
            }
        }
    }
    async handleMusicMetadata(policyId, assetName, metadata) {
        try {
            await this.storeAsset({
                policyId,
                assetName,
                metadata: JSON.stringify(metadata),
                metadataVersion: metadata.music_metadata_version
            });
        }
        catch (error) {
            if (error instanceof Error && error.code === '23505') {
                await this.updateAsset({
                    policyId,
                    assetName,
                    metadata: JSON.stringify(metadata),
                    metadataVersion: metadata.music_metadata_version
                });
            }
            else {
                throw error;
            }
        }
    }
    requestNext() {
        this.sendMessage("nextBlock", {}, Date.now().toString());
    }
    sendMessage(method, params, id) {
        if (this.ws.readyState === ws_1.default.OPEN) {
            const message = {
                jsonrpc: "2.0",
                method,
                params,
                id
            };
            this.ws.send(JSON.stringify(message));
        }
    }
    async storeAsset({ policyId, assetName, metadata, metadataVersion }) {
        await this.pool.query(`INSERT INTO cip60.assets 
            (policy_id, asset_name, metadata_json, metadata_version)
            VALUES ($1, $2, $3, $4)`, [policyId, assetName, metadata, metadataVersion]);
    }
    async updateAsset({ policyId, assetName, metadata, metadataVersion }) {
        await this.pool.query(`UPDATE cip60.assets 
             SET metadata_json = $3,
                 metadata_version = $4
             WHERE policy_id = $1 
             AND asset_name = $2`, [policyId, assetName, metadata, metadataVersion]);
    }
}
const config = {
    ogmiosUrl: process.env.OGMIOS_URL || 'ws://192.168.0.141:1337',
    dbConfig: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'postgres'
    }
};
const indexer = new MusicTokenIndexer(config.ogmiosUrl, config.dbConfig);
process.on('SIGINT', async () => {
    await indexer.stop();
    process.exit(0);
});
indexer.start().catch(error => {
    console.error('Failed to start indexer:', error instanceof Error ? error.message : error);
    process.exit(1);
});
