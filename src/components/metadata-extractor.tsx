import { Pool } from 'pg';

// Type definitions for extracted data
export interface Artist {
  id?: string;
  name: string;
  isni?: string;
  links?: Record<string, string>;
}

export interface Song {
  title: string;
  duration?: string;
  trackNumber?: number;
  mediaType?: string;
  src?: string;
  isExplicit?: boolean;
  isAIGenerated?: boolean;
  isrc?: string;
  iswc?: string;
  genres?: string[];
}

export interface ExtractedMetadata {
  title: string;
  artists: Artist[];
  song: Song;
  releaseType?: string;
  releaseTitle?: string;
  coverImage?: string;
  copyright?: {
    master?: string;
    composition?: string;
  };
}

// Main extraction function
export async function extractMusicTokensFromAssets(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Get all CIP-60 music tokens that haven't been processed
    const result = await client.query(`
      SELECT id, policy_id, asset_name, metadata_json, metadata_version
      FROM cip60.assets 
      WHERE metadata_json ? 'music_metadata_version'
      AND NOT EXISTS (
        SELECT 1 FROM audio.songs s 
        JOIN cip60.assets_songs aso ON s.asset_id = aso.songs_asset_id
        WHERE aso.assets_id = cip60.assets.id
      )
      LIMIT 100
    `);
    
    // Process each asset
    for (const row of result.rows) {
      const metadata = typeof row.metadata_json === 'string' 
        ? JSON.parse(row.metadata_json) 
        : row.metadata_json;
      
      const extractedData = extractCIP60Metadata(metadata);
      
      if (extractedData && extractedData.song.title) {
        // Insert or update song
        const songResult = await client.query(`
          INSERT INTO audio.songs (asset_id, song_name, src)
          VALUES ($1, $2, $3)
          RETURNING song_id
        `, [row.id, extractedData.song.title, extractedData.song.src]);
        
        const songId = songResult.rows[0].song_id;
        
        // Insert song details
        await client.query(`
          INSERT INTO audio.song_details (
            song_id, artists, genres, duration, is_explicit, 
            is_ai_generated, release_type, release_title,
            copyright_master, copyright_composition, metadata_version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          songId,
          JSON.stringify(extractedData.artists),
          JSON.stringify(extractedData.song.genres || []),
          extractedData.song.duration,
          extractedData.song.isExplicit || false,
          extractedData.song.isAIGenerated || false,
          extractedData.releaseType,
          extractedData.releaseTitle,
          extractedData.copyright?.master,
          extractedData.copyright?.composition,
          row.metadata_version
        ]);
        
        // Link asset to song
        await client.query(`
          INSERT INTO cip60.assets_songs (assets_id, songs_asset_id)
          VALUES ($1, $2)
        `, [row.id, songId]);
        
        // Process artists
        for (const artist of extractedData.artists) {
          // Check if artist exists
          const artistResult = await client.query(`
            SELECT artist_id FROM audio.artists WHERE name = $1
          `, [artist.name]);
          
          let artistId: number;
          
          if (artistResult.rows.length === 0) {
            // Insert new artist
            const newArtistResult = await client.query(`
              INSERT INTO audio.artists (name, isni, links)
              VALUES ($1, $2, $3)
              RETURNING artist_id
            `, [artist.name, artist.isni, artist.links ? JSON.stringify(artist.links) : null]);
            
            artistId = newArtistResult.rows[0].artist_id;
          } else {
            artistId = artistResult.rows[0].artist_id;
          }
          
          // Link artist to song
          await client.query(`
            INSERT INTO audio.song_artists (song_id, artist_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (song_id, artist_id) DO NOTHING
          `, [songId, artistId, true]);
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log(`Processed ${result.rows.length} music tokens`);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error extracting music tokens:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Extract CIP-60 metadata based on version
export function extractCIP60Metadata(metadata: any): ExtractedMetadata | null {
  try {
    const version = metadata.music_metadata_version;
    
    if (!version) return null;
    
    // Initial structure
    const extractedData: ExtractedMetadata = {
      title: metadata.name || '',
      artists: [],
      song: {
        title: '',
        genres: []
      },
      coverImage: metadata.image
    };
    
    // Extract based on version
    if (version === 3) {
      return extractV3Metadata(metadata, extractedData);
    } else if (version === 2) {
      return extractV2Metadata(metadata, extractedData);
    } else if (version === 1) {
      return extractV1Metadata(metadata, extractedData);
    }
    
    return extractedData;
  } catch (error) {
    console.error('Error extracting CIP-60 metadata:', error);
    return null;
  }
}

// Extract version 3 metadata
function extractV3Metadata(metadata: any, extractedData: ExtractedMetadata): ExtractedMetadata {
  // Extract release information
  if (metadata.release) {
    extractedData.releaseType = metadata.release.release_type;
    extractedData.releaseTitle = metadata.release.release_title;
    
    // Extract release artists
    if (Array.isArray(metadata.release.artists)) {
      extractedData.artists = [
        ...extractedData.artists,
        ...metadata.release.artists.map(normalizeArtist)
      ];
    }
    
    // Extract copyright
    if (metadata.release.copyright) {
      extractedData.copyright = {
        master: typeof metadata.release.copyright === 'string' 
          ? metadata.release.copyright 
          : metadata.release.copyright.master,
        composition: typeof metadata.release.copyright === 'string' 
          ? metadata.release.copyright 
          : metadata.release.copyright.composition
      };
    }
    
    // Extract genres if release type is Album/EP
    if (metadata.release.release_type === "Album/EP" && Array.isArray(metadata.release.genres)) {
      extractedData.song.genres = metadata.release.genres;
    }
  }
  
  // Extract file and song information
  if (Array.isArray(metadata.files) && metadata.files.length > 0) {
    const file = metadata.files[0];
    const song = file.song || {};
    
    extractedData.song.title = song.song_title || file.name || '';
    extractedData.song.duration = song.song_duration || '';
    extractedData.song.trackNumber = song.track_number || 1;
    extractedData.song.mediaType = file.mediaType || '';
    extractedData.song.src = file.src || '';
    extractedData.song.isExplicit = !!song.explicit;
    extractedData.song.isAIGenerated = !!song.ai_generated;
    extractedData.song.isrc = song.isrc || '';
    extractedData.song.iswc = song.iswc || '';
    
    // Extract song genres if not already set
    if (Array.isArray(song.genres) && (!extractedData.song.genres || extractedData.song.genres.length === 0)) {
      extractedData.song.genres = song.genres;
    }
    
    // Extract song artists if not already set
    if (Array.isArray(song.artists)) {
      const songArtists = song.artists.map(normalizeArtist);
      extractedData.artists = mergeArtists(extractedData.artists, songArtists);
    }
    
    // Extract song copyright if not already set
    if (!extractedData.copyright && song.copyright) {
      extractedData.copyright = {
        master: typeof song.copyright === 'string' 
          ? song.copyright 
          : song.copyright.master,
        composition: typeof song.copyright === 'string' 
          ? song.copyright 
          : song.copyright.composition
      };
    }
  }
  
  return extractedData;
}

// Extract version 2 metadata (simplified for brevity)
function extractV2Metadata(metadata: any, extractedData: ExtractedMetadata): ExtractedMetadata {
  // Similar to V3 but with V2 structure differences
  
  // Extract release information
  if (metadata.release) {
    extractedData.releaseTitle = metadata.release.release_title;
    
    if (metadata.release.copyright) {
      extractedData.copyright = {
        master: metadata.release.copyright,
        composition: metadata.release.copyright
      };
    }
  }
  
  extractedData.releaseType = metadata.release_type || 'Single';
  
  // Extract file and song information
  if (Array.isArray(metadata.files) && metadata.files.length > 0) {
    const file = metadata.files[0];
    const song = file.song || {};
    
    extractedData.song.title = song.song_title || file.name || '';
    extractedData.song.duration = song.song_duration || '';
    extractedData.song.trackNumber = song.track_number || 1;
    extractedData.song.mediaType = file.mediaType || '';
    extractedData.song.src = Array.isArray(file.src) ? file.src[0] : file.src;
    extractedData.song.isExplicit = !!song.explicit;
    
    if (Array.isArray(song.genres)) {
      extractedData.song.genres = song.genres;
    }
    
    if (Array.isArray(song.artists)) {
      extractedData.artists = mergeArtists(extractedData.artists, 
        song.artists.map(normalizeArtist));
    }
    
    if (song.copyright) {
      extractedData.copyright = {
        master: song.copyright,
        composition: song.copyright
      };
    }
  }
  
  return extractedData;
}

// Extract version 1 metadata (simplified for brevity)
function extractV1Metadata(metadata: any, extractedData: ExtractedMetadata): ExtractedMetadata {
  // V1 has a different structure
  
  extractedData.releaseType = metadata.release_type || 'Single';
  extractedData.releaseTitle = metadata.album_title || '';
  
  if (metadata.copyright) {
    extractedData.copyright = {
      master: metadata.copyright,
      composition: metadata.copyright
    };
  }
  
  if (Array.isArray(metadata.artists)) {
    extractedData.artists = metadata.artists.map(normalizeArtist);
  }
  
  if (Array.isArray(metadata.genres)) {
    extractedData.song.genres = metadata.genres;
  }
  
  // For single type, some fields are at the top level
  if (metadata.release_type === 'Single') {
    extractedData.song.title = metadata.song_title || '';
    extractedData.song.duration = metadata.song_duration || '';
    extractedData.song.trackNumber = metadata.track_number || 1;
  }
  
  // Still check files
  if (Array.isArray(metadata.files) && metadata.files.length > 0) {
    const file = metadata.files[0];
    
    if (!extractedData.song.title) {
      extractedData.song.title = file.song_title || file.name || '';
    }
    
    extractedData.song.mediaType = file.mediaType || '';
    extractedData.song.src = Array.isArray(file.src) ? file.src[0] : file.src;
    
    if (Array.isArray(file.artists)) {
      extractedData.artists = mergeArtists(extractedData.artists, 
        file.artists.map(normalizeArtist));
    }
  }
  
  return extractedData;
}

// Helper function to normalize artist object
function normalizeArtist(artist: any): Artist {
  if (typeof artist === 'string') {
    return { name: artist };
  }
  
  if (typeof artist === 'object' && artist !== null) {
    if (artist.name) {
      return {
        name: artist.name,
        isni: artist.isni,
        links: artist.links || {}
      };
    }
    
    // If the structure is { "Artist Name": { "links": {...} } }
    const artistName = Object.keys(artist)[0];
    if (artistName) {
      return {
        name: artistName,
        links: artist[artistName].links || {}
      };
    }
  }
  
  return { name: 'Unknown Artist' };
}

// Helper function to merge artist arrays, avoiding duplicates
function mergeArtists(existingArtists: Artist[], newArtists: Artist[]): Artist[] {
  const combinedArtists = [...existingArtists];
  const existingNames = new Set(existingArtists.map(a => a.name));
  
  for (const artist of newArtists) {
    if (!existingNames.has(artist.name)) {
      combinedArtists.push(artist);
      existingNames.add(artist.name);
    }
  }
  
  return combinedArtists;
}