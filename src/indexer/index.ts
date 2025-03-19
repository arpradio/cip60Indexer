import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import pg from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

dotenv.config();

interface PostgresError extends Error {
    code?: string;
}

interface MusicMetadataInfo {
    policyId: string;
    assetName: string;
    metadata: any;
}

interface BlockState {
    slot: number;
    hash: string;
}

interface LastProcessedState extends BlockState {
    updated_at: Date;
}

interface Handler {
    message: (data: WebSocket.Data) => void;
    open: () => void;
    error: (error: Error) => void;
    close: () => void;
}

interface WebSocketWithState extends WebSocket {
    isAlive?: boolean;
}

const requiredEnvVars: string[] = ['DB_HOST', 'DB_PASSWORD', 'DB_NAME', 'OGMIOS_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const config = {
    ogmios: {
        url: process.env.OGMIOS_URL || 'ws://localhost:1337',  
        reconnectInterval: parseInt(process.env.OGMIOS_RECONNECT_INTERVAL || '5000'),
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'postgres',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        ssl: process.env.DB_SSL === 'true'
    },
    api: {
        port: parseInt(process.env.API_PORT || '3000'),
        progressPort: parseInt(process.env.PROGRESS_PORT || '3001')
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'indexer.log',
        console: process.env.LOG_CONSOLE !== 'false'
    }
};

class Logger {
    private static logFile: string = config.logging.file;
    private static logLevel: number = {
        debug: 1,
        info: 2,
        warn: 3,
        error: 4,
        critical: 5
    }[config.logging.level] || 2;

    static debug(message: string, meta?: any): void {
        if (this.logLevel <= 1) this.log('DEBUG', message, meta);
    }

    static info(message: string, meta?: any): void {
        if (this.logLevel <= 2) this.log('INFO', message, meta);
    }

    static warn(message: string, meta?: any): void {
        if (this.logLevel <= 3) this.log('WARN', message, meta);
    }

    static error(message: string, meta?: any): void {
        if (this.logLevel <= 4) this.log('ERROR', message, meta);
    }

    static critical(message: string, meta?: any): void {
        if (this.logLevel <= 5) this.log('CRITICAL', message, meta);
    }

    private static log(level: string, message: string, meta?: any): void {
        const timestamp: string = new Date().toISOString();
        const logEntry = {
            level,
            timestamp,
            message,
            ...(meta && { meta })
        };

        if (config.logging.console) {
            let colorFn;
            switch (level) {
                case 'DEBUG': colorFn = chalk.gray; break;
                case 'INFO': colorFn = chalk.blue; break;
                case 'WARN': colorFn = chalk.yellow; break;
                case 'ERROR': colorFn = chalk.red; break;
                case 'CRITICAL': colorFn = chalk.bgRed.white; break;
                default: colorFn = chalk.white;
            }
            console.log(`${colorFn(`[${level}]`)} ${timestamp} ${message}`);
            if (meta) console.log(meta);
        }

        if (this.logFile) {
            try {
                const logDir: string = path.dirname(this.logFile);
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
                fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
            } catch (err) {
                console.error('Failed to write to log file:', err);
            }
        }
    }
}

class ProgressServer {
    private wss: WebSocketServer;
    private clients: Set<WebSocketWithState> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(port: number) {
        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws: WebSocketWithState) => {
            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });
            
            this.clients.add(ws);
            
            ws.on('error', () => {
                this.clients.delete(ws);
            });
            
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });
        
        this.pingInterval = setInterval(() => {
            this.clients.forEach(ws => {
                if (ws.isAlive === false) {
                    this.clients.delete(ws);
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        Logger.info(`Progress server listening on port ${port}`);
    }

    broadcastProgress(currentSlot: number, networkTip: number): void {
        const message: string = JSON.stringify({
            type: 'progress',
            data: { currentSlot, networkTip }
        });

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    close(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        this.clients.forEach(client => {
            try {
                client.terminate();
            } catch (err) {
                Logger.error('Error terminating client:', err);
            }
        });
        
        this.clients.clear();
        this.wss.close();
        Logger.info('Progress server closed');
    }
}

class MusicTokenIndexer {
    private ws!: WebSocket;
    private pool: pg.Pool;
    private networkBlockHeight: number = 0;
    private latestProcessedSlot: number = 0;
    private latestProcessedHash: string = '';
    private loadedSlot: number = 0;
    private isProcessing: boolean = false;
    private progressServer: ProgressServer;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private handlers: Handler | null = null;
    private retryCount: number = 0;

    private readonly ERA_BOUNDARIES = [
        { slot: 4492799, hash: "f8084c61b6a238acec985b59310b6ecec49c0ab8352249afd7268da5cff2a457" },
        { slot: 16588737, hash: "4e9bbbb67e3ae262133d94c3da5bffce7b1127fc436e7433b87668dba34c354a" },
        { slot: 23068793, hash: "69c44ac1dda2ec74646e4223bc804d9126f719b1c245dadc2ad65e8de1b276d7" },
        { slot: 39916796, hash: "e72579ff89dc9ed325b723a33624b596c08141c7bd573ecfff56a1f7229e4d09" },
        { slot: 72316796, hash: "c58a24ba8203e7629422a24d9dc68ce2ed495420bf40d9dab124373655161a20" },
        { slot: 133660799, hash: "e757d57eb8dc9500a61c60a39fadb63d9be6973ba96ae337fd24453d4d15c343" },
    ] as const;

    constructor(
        private readonly ogmiosUrl: string,
        private readonly dbConfig: pg.PoolConfig
    ) {
        this.pool = new pg.Pool({
            ...dbConfig,
            max: config.database.maxConnections,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });

        this.pool.on('error', (err) => {
            Logger.error('Unexpected database pool error', err);
        });

        this.progressServer = new ProgressServer(config.api.progressPort);
    }

    async start(): Promise<void> {
        try {
            await this.testDatabaseConnection();
            
            const ogmiosHealthy: boolean = await this.checkOgmiosHealth();
            if (!ogmiosHealthy) {
                throw new Error('Ogmios is not available. Indexer cannot start.');
            }
            
            const lastState: LastProcessedState | null = await this.loadLastState();
            if (lastState) {
                this.loadedSlot = Number(lastState.slot);
                this.latestProcessedSlot = this.loadedSlot;
                this.latestProcessedHash = lastState.hash;
                Logger.info(`Loaded last state from database - Slot: ${this.latestProcessedSlot}, Hash: ${lastState.hash}`);
            } else {
                this.loadedSlot = 52876752;
                this.latestProcessedSlot = this.loadedSlot;
                this.latestProcessedHash = "af192981f47a4150b4d4f96e2184050699febbbc31de18c3815bb5f338578ff6";
                Logger.info('No previous state found in database, using Allegra as starting point');
            }
    
            if (!this.latestProcessedSlot || !this.latestProcessedHash) {
                throw new Error('Failed to initialize state');
            }
    
            this.connectToOgmios();
        } catch (error: unknown) {
            Logger.critical('Failed to start indexer', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        Logger.info('Stopping indexer');
        this.isProcessing = false;

        if (this.latestProcessedSlot > this.loadedSlot && this.latestProcessedHash) {
            try {
                await this.saveState(this.latestProcessedSlot, this.latestProcessedHash);
            } catch (error) {
                Logger.error('Error saving final state:', error);
            }
        }

        this.cleanupWebsocket();

        try {
            await this.pool.end();
            Logger.info('Database pool closed');
        } catch (error) {
            Logger.error('Error closing database pool:', error);
        }

        if (this.progressServer) {
            this.progressServer.close();
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        Logger.info('Indexer stopped successfully');
    }

    private async testDatabaseConnection(): Promise<void> {
        try {
            Logger.info('Testing database connection');
            await this.pool.query('SELECT NOW()');
            Logger.info('Database connection successful');
        } catch (error) {
            Logger.critical('Cannot connect to database', error);
            throw new Error('Database connection failed: ' + (error instanceof Error ? error.message : String(error)));
        }
    }

    private async checkOgmiosHealth(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const ws: WebSocket = new WebSocket(this.ogmiosUrl);
            const timeout: NodeJS.Timeout = setTimeout(() => {
                ws.terminate();
                resolve(false);
            }, 5000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            });
            
            ws.on('error', () => {
                clearTimeout(timeout);
                ws.terminate();
                resolve(false);
            });
        });
    }

    private async loadLastState(): Promise<LastProcessedState | null> {
        Logger.info('Loading last known state from database');
        try {
            const result = await this.pool.query(`
                SELECT last_slot::bigint as slot, last_block_hash as hash, updated_at
                FROM audio.indexer_state 
                ORDER BY updated_at DESC 
                LIMIT 1
            `);
            return result.rows[0] ? {
                slot: Number(result.rows[0].slot),
                hash: result.rows[0].hash,
                updated_at: result.rows[0].updated_at
            } : null;
        } catch (error) {
            Logger.error('Error loading last state:', error);
            throw error;
        }
    }

    private async saveState(slot: number, hash: string): Promise<void> {
        try {
            await this.pool.query(`
                INSERT INTO audio.indexer_state (last_slot, last_block_hash)
                VALUES ($1::bigint, $2)
            `, [slot, hash]);
            Logger.info(`Saved state: Slot ${slot}, Hash ${hash}`);
        } catch (error) {
            Logger.error('Error saving state:', error);
            throw error;
        }
    }

    private cleanupWebsocket(): void {
        if (!this.ws) return;
        
        if (this.handlers) {
            this.ws.removeListener('message', this.handlers.message);
            this.ws.removeListener('open', this.handlers.open);
            this.ws.removeListener('error', this.handlers.error);
            this.ws.removeListener('close', this.handlers.close);
        }
        
        if (this.ws.readyState === WebSocket.OPEN || 
            this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.terminate();
        }
        
        this.ws = null as unknown as WebSocket;
        this.handlers = null;
    }

    private async queryNetworkBlockHeight(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            Logger.debug('Querying network block height');
            const message = {
                jsonrpc: "2.0",
                method: "queryNetwork/blockHeight",
                params: {},
                id: "query-height"
            };

            const timeoutId: NodeJS.Timeout = setTimeout(() => {
                this.ws.removeListener('message', messageHandler);
                reject(new Error('Network height query timeout'));
            }, 10000);

            const messageHandler = (data: WebSocket.Data): void => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === "query-height") {
                        clearTimeout(timeoutId);
                        this.ws.removeListener('message', messageHandler);
                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response.result);
                        }
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    this.ws.removeListener('message', messageHandler);
                    reject(error);
                }
            };

            this.ws.on('message', messageHandler);
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                clearTimeout(timeoutId);
                this.ws.removeListener('message', messageHandler);
                reject(error);
            }
        });
    }

    private connectToOgmios(): void {
        Logger.info(`Connecting to Ogmios at ${this.ogmiosUrl}`);
        
        this.cleanupWebsocket();
        this.ws = new WebSocket(this.ogmiosUrl);
        this.isProcessing = true;

        const connectionTimeout: NodeJS.Timeout = setTimeout(() => {
            if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                Logger.error('Ogmios connection timed out');
                this.ws.close();
            }
        }, 10000);

        const messageHandler = async (data: WebSocket.Data) => {
            try {
                clearTimeout(connectionTimeout);
                const response = JSON.parse(data.toString());
                
                if (response.id === 'find-intersection') {
                    Logger.info('Intersection found');
                    this.requestNext();
                } else if (response.id === 'query-height') {
                    Logger.debug('Received height query response');
                } else if (response.result) {
                    try {
                        await this.processBlock(response.result);
                    } catch (blockError) {
                        Logger.error('Error processing block:', blockError);
                    }
                    this.requestNext();
                } else {
                    Logger.debug(`Unhandled message: ${JSON.stringify(response).substring(0, 200)}...`);
                    this.requestNext();
                }
            } catch (error) {
                Logger.error('Error processing message:', error);
                this.requestNext();
            }
        };

        const openHandler = async () => {
            clearTimeout(connectionTimeout);
            Logger.info('Connected to Ogmios');
            this.retryCount = 0;
            try {
                this.networkBlockHeight = await this.queryNetworkBlockHeight();
                Logger.info(`Network block height: ${this.networkBlockHeight}`);
                this.startChainSync();
            } catch (error) {
                Logger.error('Failed to initialize chain after connection', error);
                this.ws.close();
            }
        };
        const errorHandler = (error: Error) => {
            clearTimeout(connectionTimeout);
            Logger.error('WebSocket error', error);
            this.scheduleReconnect();
        };

        const closeHandler = () => {
            clearTimeout(connectionTimeout);
            Logger.warn('WebSocket connection closed');
            this.scheduleReconnect();
        };
    
        this.handlers = {
            message: messageHandler,
            open: openHandler,
            error: errorHandler,
            close: closeHandler
        };
    
        this.ws.on('message', this.handlers.message);
        this.ws.on('open', this.handlers.open);
        this.ws.on('error', this.handlers.error);
        this.ws.on('close', this.handlers.close);
    }
    
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
    
        const backoffTime = Math.min(60000, 1000 * Math.pow(1.5, this.retryCount));
        this.retryCount++;
        
        Logger.info(`Scheduling reconnect in ${backoffTime}ms (attempt ${this.retryCount})`);
        this.reconnectTimer = setTimeout(() => {
            if (this.isProcessing) {
                this.connectToOgmios();
            }
        }, backoffTime);
    }
    
    private async startChainSync(retries: number = 0): Promise<void> {
        try {
            const points: Array<{ slot: number, id: string }> = [{
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
            Logger.info(`Starting chain sync with ${points.length} points, latest slot: ${points[0].slot}`);
            this.sendMessage("findIntersection", { points }, "find-intersection");
        } catch (error) {
            Logger.error('Failed to start chain sync:', error);
            if (retries < 3) {
                Logger.info(`Retrying chain sync in 5 seconds (${retries + 1}/3)`);
                setTimeout(() => this.startChainSync(retries + 1), 5000);
            } else {
                Logger.error('Failed to start chain sync after 3 retries');
                this.ws.close();
            }
        }
    }

    private async processBlock(block: any): Promise<void> {
        Logger.debug(`Processing block data: ${JSON.stringify(block).substring(0, 200)}...`);
      
        // Navigate through result structure to find block data
        let blockData: any = block;
        
        if (block.result?.block) {
          blockData = block.result.block;
        } else if (block.block) {
          blockData = block.block;
        }
      
        // Find slot and ID properties
        const slot: string | number | undefined = 
          blockData?.slot || 
          blockData?.header?.slot;
          
        const id: string | undefined = 
          blockData?.id || 
          blockData?.header?.id || 
          blockData?.hash;
      
        if (!slot || !id) {
          Logger.debug(`Missing slot/id in block data`);
          return;
        }
      
        const currentSlot: number = Number(slot);
        if (isNaN(currentSlot)) {
          Logger.error(`Invalid slot format: ${slot}`);
          return;
        }
      
        const foundMetadata: Array<{
          path: string[];
          metadata: any;
        }> = [];
        
        // Function to recursively find music metadata in transaction metadata
        const findMusicMetadata = (obj: any, path: string[] = []): void => {
          if (!obj || typeof obj !== 'object') return;
          
          // Check for CIP-60 identifier
          if ('music_metadata_version' in obj) {
            foundMetadata.push({ path, metadata: obj });
            return;
          }
      
          // Continue recursion for nested objects
          for (const key in obj) {
            findMusicMetadata(obj[key], [...path, key]);
          }
        };
      
        // Process transactions to find music metadata
        const transactions: any[] = blockData.transactions || [];
        for (const tx of transactions) {
          if (tx.metadata) {
            findMusicMetadata(tx.metadata);
          }
        }
      
        // Process found metadata
        for (const { path, metadata } of foundMetadata) {
          try {
            const index721: number = path.indexOf('721');
            if (index721 >= 0 && index721 + 3 < path.length) {
              const policyId: string = path[index721 + 2];
              const assetName: string = path[index721 + 3];
              await this.handleMusicMetadata(policyId, assetName, metadata);
              Logger.info(`Found CIP-60 Music Token: ${policyId.slice(0, 8)}...${policyId.slice(-8)} - ${assetName} (v${metadata.music_metadata_version})`);
            }
          } catch (error: unknown) {
            Logger.error('Error processing metadata:', error);
          }
        }
      
        // Update processing state
        if (currentSlot > this.loadedSlot) {
          this.latestProcessedSlot = currentSlot;
          this.latestProcessedHash = id.toString();
          
          // Save state periodically
          if (currentSlot % 1000000 === 0) {
            try {
              await this.saveState(currentSlot, id.toString());
            } catch (error) {
              Logger.error('Error saving periodic state:', error);
            }
          }
        }
      
        // Update progress
        if (block.tip) {
          const tipSlot: number = Number(block.tip.slot);
          if (!isNaN(tipSlot)) {
            const progress: number = (currentSlot / tipSlot) * 100;
            Logger.debug(`Sync progress: ${progress.toFixed(2)}% (${currentSlot}/${tipSlot})`);
            this.progressServer.broadcastProgress(currentSlot, tipSlot);
          }
        }
    }

    private async handleMusicMetadata(
        policyId: string, 
        assetName: string, 
        metadata: any
    ): Promise<void> {
        try {
            const metadataVersion: string = metadata.music_metadata_version.toString();
            
            await this.storeAsset({
                policyId,
                assetName,
                metadata: JSON.stringify(metadata),
                metadataVersion
            });
        } catch (error: unknown) {
            if (error instanceof Error && (error as PostgresError).code === '23505') {
                // Handle duplicate key violation by updating instead
                await this.updateAsset({
                    policyId,
                    assetName,
                    metadata: JSON.stringify(metadata),
                    metadataVersion: metadata.music_metadata_version.toString()
                });
            } else {
                throw error;
            }
        }
    }

    private requestNext(): void {
        this.sendMessage("nextBlock", {}, Date.now().toString());
    }

    private sendMessage(method: string, params: any, id: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                jsonrpc: "2.0",
                method,
                params,
                id
            };
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                Logger.error(`Failed to send message: ${method}`, error);
            }
        } else {
            Logger.warn(`Cannot send message: WebSocket not ready (${method})`);
        }
    }

    private async storeAsset({
        policyId,
        assetName,
        metadata,
        metadataVersion
    }: {
        policyId: string;
        assetName: string;
        metadata: string;
        metadataVersion: string;
    }): Promise<void> {
        await this.pool.query(
            `INSERT INTO cip60.assets 
            (policy_id, asset_name, metadata_json, metadata_version)
            VALUES ($1, $2, $3, $4)`,
            [policyId, assetName, metadata, metadataVersion]
        );
    }
    
    private async updateAsset({
        policyId,
        assetName,
        metadata,
        metadataVersion
    }: {
        policyId: string;
        assetName: string;
        metadata: string;
        metadataVersion: string;
    }): Promise<void> {
        await this.pool.query(
            `UPDATE cip60.assets 
             SET metadata_json = $3,
                 metadata_version = $4,
                 updated_at = NOW()
             WHERE policy_id = $1 
             AND asset_name = $2`,
            [policyId, assetName, metadata, metadataVersion]
        );
    }
}

async function gracefulShutdown(signal: string): Promise<void> {
    Logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    const forceExitTimeout: NodeJS.Timeout = setTimeout(() => {
        Logger.critical('Forcing exit after timeout');
        process.exit(1);
    }, 30000);
    
    try {
        await indexer.stop();
        Logger.info('Graceful shutdown completed');
        clearTimeout(forceExitTimeout);
        process.exit(0);
    } catch (error) {
        Logger.error('Error during shutdown:', error);
        clearTimeout(forceExitTimeout);
        process.exit(1);
    }
}

// Set up global error handlers
process.on('uncaughtException', (error: Error) => {
    Logger.critical('CRITICAL: Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
    Logger.critical('CRITICAL: Unhandled promise rejection:', reason);
    gracefulShutdown('unhandledRejection');
});

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize the indexer
const indexer: MusicTokenIndexer = new MusicTokenIndexer(
    config.ogmios.url,
    {
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database
    }
);

// Start the indexer
indexer.start().catch(error => {
    Logger.critical('Failed to start indexer:', error);
    process.exit(1);
});