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
}

export interface ArtistDetails {
    name: string;
    isni?: string;
    links?: Record<string, string>;
}

export interface AuthorDetails {
    name: string;
    ipi?: string;
    share?: string;
}

export interface SongDetails {
    song_title: string;
    song_duration: string;
    track_number: number;
    artists?: ArtistDetails[];
    genres?: string[];
    copyright?: {
        master: string;
        composition: string;
    };
    isrc?: string;
    iswc?: string;
    explicit?: boolean;
    mastering_engineer?: string;
}

export interface MusicAsset {
    id: number;
    policy_id: string;
    asset_name: string;
    metadata_version: string;
    created_at: Date;
    metadata_json: {
        name: string;
        image: string;
        music_metadata_version: number;
        release: {
            release_type: 'Single' | 'Multiple' | 'Album/EP';
            release_title: string;
        };
        files: Array<{
            name: string;
            mediaType: string;
            src: string;
            song: SongDetails;
        }>;
    };
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
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