
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
    producer?: string;
}

export interface Asset {
    policy_id: string;
    id: string | number;
    asset_name: string;
    metadata_version: string;
    created_at: string;
    metadata_json: string | Record<string, any>;
}

export interface SongFile {
    name?: string;
    mediaType?: string;
    src?: string;
    song?: SongData;
}

export interface ReleaseInfo {
    release_type: 'Single' | 'Multiple' | 'Album/EP';
    release_title: string;
    producer?: string;
    mix_engineer?: string;
    mastering_engineer?: string;
    collection?: string;
    series?: string;
    visual_artist?: string;
    artists?: (string | ArtistDetails)[];
    genres?: string[];
    links?: Record<string, string | string[]>;
    parental_advisory?: string;
    copyright?: string | CopyrightInfo;
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
        release: ReleaseInfo;
        files: SongFile[];
    };
}

export interface Artist {
    name?: string;
    isni?: string;
    links?: Record<string, string | string[]>;
    [key: string]: any; 
}

export interface CopyrightInfo {
    master?: string;
    composition?: string;
    text?: string;
    [key: string]: any;
}

export interface Artists {
    name?: string;
    isni?: string;
    links?: Record<string, string | string[]>;
    [key: string]: any; 
}

export interface SongData {
    song_title?: string;
    song_duration?: string | number;
    track_number?: string | number;
    producer?: string;
    artists?: (string | Artist)[];
    genres?: string[];
    isrc?: string;
    iswc?: string;
    copyright?: string | CopyrightInfo;
    explicit?: boolean;
    mastering_engineer?: string;
}

export interface ParsedMetadata {
    name?: string;
    image?: string;
    music_metadata_version?: string | number;
    files?: SongFile[];
    release?: ReleaseInfo;
    [key: string]: any;
}

export interface ProcessedMetadata {
    title: string;
    image: string;
    version: string | number;
    artists: string[];
    genres: string[];
    links: Record<string, string | string[]>;
    releaseInfo: {
        type: string;
        title: string;
        producer: string;
        mix_engineer: string;
        mastering_engineer: string;
        collection: string;
        series: string;
        visual_artist: string;
    };
    copyright: CopyrightInfo | null;
}

export interface SongData {
    song_title?: string;
    song_duration?: string | number;
    track_number?: string | number;
    producer?: string;
    artists?: (string | Artist)[];
    genres?: string[];
    isrc?: string;
    iswc?: string;
    copyright?: string | CopyrightInfo;
    explicit?: boolean;
    mastering_engineer?: string;
}


export interface TrackData {
    title: string;
    duration: string | number;
    number: string | number;
    src: string;
    mediaType: string;
    isExplicit: boolean;
    isrc: string;
    iswc: string;
}

export interface AssetModalProps {
    asset: Asset | null;
    isOpen: boolean;
    onClose: () => void;
}

export interface IPFSMediaProps {
    src: string;
    type: 'image' | 'audio' | 'video';
    className?: string;
    alt?: string;
    isrc?: string;
    iswc?: string;
    isExplicit?: boolean;
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

export interface TokenMetadata {
    "721": {
        [policyId: string]: {
            [assetName: string]: any;
        };
    };
}