import WebSocket from 'ws';
import pg from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';

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

function renderSplashScreen() {
    // ANSI color codes
    const cyan = '\x1b[36m';
    const yellow = '\x1b[33m';
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';
    
    // Clear the console
    console.clear();
    
    // Create some spacing at the top
    console.log('\n');
    
    // Use template literal to preserve exact formatting
    const asciiArt = `
╔════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                            ║
║  _____ _   _ _____   ____  ____  _   _ _____ _   _  ____ _____   _        _    ____        ║
║ |_   _| | | | ____| |  _ \\/ ___|| | | | ____| \\ | |/ ___| ____| | |      / \\  | __ )       ║
║   | | | |_| |  _|   | |_) \\___ \\| | | |  _| |  \\| | |   |  _|   | |     / _ \\ |  _ \\       ║
║   | | |  _  | |___  |  __/ ___) | |_| | |___| |\\  | |___| |___  | |___ / ___ \\| |_) |      ║  
║   |_| |_| |_|_____| |_|   |____/ \\__, |_____|_| \\_|\\____|_____| |_____/_/   \\_\\____/       ║
║                                   |___/                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════════════╝                     
                                                                               
${yellow}♪${reset} ${blue}♫${reset} ${cyan}∿∿∿∿∿∿∿${reset} ${yellow}♪${reset} ${blue}♫${reset} Audio Engineering | Music Production | Publication ${yellow}♪${reset} ${blue}♫${reset} ${cyan}∿∿∿∿∿∿∿${reset} ${yellow}♪${reset} ${blue}♫${reset}                                                                               
                          ${cyan}https://psyencelab.media${reset}     
                          ${cyan}https://arpradio.media${reset}                                                                                   
                       ${yellow}🎹  🎸  🎼  🎵  🎶  🎚️  🎛️  🎧${reset} 

                     ${cyan}Pioneering the future of web3 Music${reset}
══════════════════════════════════════════════════════════════════════════════════════════════
                       
                           
                       ${blue}CIP 60 Indexer v0.1.0_alpha${reset} 
`;

    // Print the ASCII art
    console.log(asciiArt);
    
    // Add some spacing at the bottom
    console.log('\n');
}


class MusicTokenIndexer {
    private ws!: WebSocket;
    private pool: pg.Pool;
    private networkBlockHeight: number = 0;
    private latestProcessedSlot: number = 0;
    private latestProcessedHash: string = '';
    private isProcessing: boolean = false;

    constructor(
        private readonly ogmiosUrl: string,
        private readonly dbConfig: pg.PoolConfig
    ) {
        this.pool = new pg.Pool(dbConfig);
    }

    async start() {
        try {
            await this.pool.query('SELECT NOW()');
            const lastState = await this.loadLastState();
            if (lastState) {
                this.latestProcessedSlot = Number(lastState.slot);
                this.latestProcessedHash = lastState.hash;
                console.log(`Loaded last state from database - Slot: ${this.latestProcessedSlot}, Hash: ${lastState.hash}`);
            } else {
                this.latestProcessedSlot = 52876752;
                this.latestProcessedHash = "af192981f47a4150b4d4f96e2184050699febbbc31de18c3815bb5f338578ff6";
                console.log('No previous state found in database, using Allegra as starting point...');
            }
    
            if (!this.latestProcessedSlot || !this.latestProcessedHash) {
                throw new Error('Failed to initialize state');
            }
    
            this.connectToOgmios();
        } catch (error: unknown) {
            throw error;
        }
    }

    async stop() {
        this.isProcessing = false;
        if (this.latestProcessedSlot > 0 && this.latestProcessedHash) {
            try {
                await this.saveState(this.latestProcessedSlot, this.latestProcessedHash);
            } catch (error) {
                console.error('Error saving final state:', error);
            }
        }
        if (this.ws) {
            this.ws.close();
        }
        await this.pool.end();
    }

    

    private async loadLastState(): Promise<LastProcessedState | null> {
        renderSplashScreen();
        console.log(chalk.cyan('Loading last known state from database...'));
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

    private async saveState(slot: number, hash: string) {
        await this.pool.query(`
            INSERT INTO cip60.indexer_state (last_slot, last_block_hash)
            VALUES ($1::bigint, $2)
        `, [slot, hash]);
    }

    private async queryNetworkBlockHeight() {
        return new Promise<number>((resolve, reject) => {
            const message = {
                jsonrpc: "2.0",
                method: "queryNetwork/blockHeight",
                params: {},
                id: "query-height"
            };

            const timeoutId = setTimeout(() => {
                this.ws.removeListener('message', messageHandler);
                reject(new Error('Network height query timeout'));
            }, 5000);

            const messageHandler = (data: WebSocket.Data) => {
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

    private connectToOgmios() {
        this.ws = new WebSocket(this.ogmiosUrl);
        this.isProcessing = true;

        this.ws.on('open', async () => {
            try {
                this.networkBlockHeight = await this.queryNetworkBlockHeight();
                this.startChainSync();
            } catch (error) {
                this.ws.close();
            }
        });

        this.ws.on('message', async (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === 'find-intersection') {
                    console.log('Intersection found');
                    this.requestNext();
                } else if (response.result) {
                    await this.processBlock(response.result);
                    this.requestNext();
                }
            } catch (error: unknown) {
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

    private readonly ERA_BOUNDARIES = [
        { slot: 4492799, hash: "f8084c61b6a238acec985b59310b6ecec49c0ab8352249afd7268da5cff2a457" },
        { slot: 16588737, hash: "4e9bbbb67e3ae262133d94c3da5bffce7b1127fc436e7433b87668dba34c354a" },
        { slot: 23068793, hash: "69c44ac1dda2ec74646e4223bc804d9126f719b1c245dadc2ad65e8de1b276d7" },
        { slot: 39916796, hash: "e72579ff89dc9ed325b723a33624b596c08141c7bd573ecfff56a1f7229e4d09" },
        { slot: 72316796, hash: "c58a24ba8203e7629422a24d9dc68ce2ed495420bf40d9dab124373655161a20" },
        { slot: 133660799, hash: "e757d57eb8dc9500a61c60a39fadb63d9be6973ba96ae337fd24453d4d15c343" },
    ] as const;
    
    private async startChainSync() {
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
                
            this.sendMessage("findIntersection", { points }, "find-intersection");
        } catch (error) {
            console.error('Failed to start chain sync:', error);
            setTimeout(() => this.startChainSync(), 5000);
        }
    }

    private async processBlock(block: any) {
        const blockData = block.block;
        if (!blockData || !blockData.slot || !blockData.id) {
            return;
        }

        const currentSlot = Number(blockData.slot);
        if (isNaN(currentSlot)) {
            console.error('Invalid slot number received:', blockData.slot);
            return;
        }

        const foundMetadata: Array<{
            path: string[];
            metadata: any;
        }> = [];

        const findMusicMetadata = (obj: any, path: string[] = []): void => {
            if (!obj || typeof obj !== 'object') return;
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
                }
            } catch (error: unknown) {
                console.error('Error processing metadata:', error instanceof Error ? error.message : error);
            }
        }

        this.latestProcessedSlot = currentSlot;
        this.latestProcessedHash = blockData.id;

        if (block.tip) {
            const tipSlot = Number(block.tip.slot);
            if (!isNaN(tipSlot)) {
                const progress = (currentSlot / tipSlot);
                const barWidth = 30;
                const filled = Math.round(progress * barWidth);
                const empty = barWidth - filled;
                const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
                const percentage = (progress * 100).toFixed(2);

                process.stdout.cursorTo(0);
                process.stdout.clearLine(0);
                process.stdout.write(
                    `Syncing: [${progressBar}] ${percentage}% | ` +
                    `Block: ${this.networkBlockHeight.toLocaleString('en-US')} | ` +
                    `Slot: ${currentSlot.toLocaleString('en-US')}/${tipSlot.toLocaleString('en-US')}`
                );
            }
        }
    }

    private async handleMusicMetadata(policyId: string, assetName: string, metadata: any) {
        try {
            await this.storeAsset({
                policyId,
                assetName,
                metadata: JSON.stringify(metadata),
                metadataVersion: metadata.music_metadata_version
            });
        } catch (error: unknown) {
            if (error instanceof Error && (error as PostgresError).code === '23505') {
                await this.updateAsset({
                    policyId,
                    assetName,
                    metadata: JSON.stringify(metadata),
                    metadataVersion: metadata.music_metadata_version
                });
            } else {
                throw error;
            }
        }
    }

    private requestNext() {
        this.sendMessage("nextBlock", {}, Date.now().toString());
    }

    private sendMessage(method: string, params: any, id: string) {
        if (this.ws.readyState === WebSocket.OPEN) {
            const message = {
                jsonrpc: "2.0",
                method,
                params,
                id
            };
            this.ws.send(JSON.stringify(message));
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
    }) {
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
    }) {
        await this.pool.query(
            `UPDATE cip60.assets 
             SET metadata_json = $3,
                 metadata_version = $4
             WHERE policy_id = $1 
             AND asset_name = $2`,
            [policyId, assetName, metadata, metadataVersion]
        );
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

const indexer = new MusicTokenIndexer(
    config.ogmiosUrl,
    config.dbConfig
);

process.on('SIGINT', async () => {
    await indexer.stop();
    process.exit(0);
});

indexer.start().catch(error => {
    console.error('Failed to start indexer:', error instanceof Error ? error.message : error);
    process.exit(1);
});
