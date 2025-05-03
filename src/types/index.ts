export interface PostgresError extends Error {
    code?: string;
 }
 
 export interface BlockState {
    slot: number;
    hash: string;
 }
 
 export interface LastProcessedState extends BlockState {
    updated_at: Date;
 }
 
 export interface NetworkStats {
    blockHeight: number;
    epoch: number;
    slot: number;
    processedAssets: number;
    syncProgress: number;
    lastProcessedBlock: string;
    networkTip: number;
    lastUpdated: Date;
    currentSlot?: number; 
 }
 
 export interface Asset {
    policy_id: string;
    id: string | number;
    asset_name: string;
    metadata_version: string;
    created_at: string;
    metadata_json: string | Record<string, any>;
 }
 
 export interface OgmiosMessage {
    jsonrpc: '2.0';
    method: string;
    params?: any;
    id: string;
 }
 
 export interface OgmiosResponse {
    jsonrpc: '2.0';
    result?: any;
    error?: {
        code: number;
        message: string;
    };
    id: string;
 }
 
 export interface TokenMetadata {
    "721": {
        [policyId: string]: {
            [assetName: string]: any;
        };
    };
 }