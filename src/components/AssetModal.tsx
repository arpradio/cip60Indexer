import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import { IPFSMedia } from './ipfsMedia';
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Link as LinkIcon, X } from 'lucide-react';
import { 
  Asset, 
  AssetModalProps, 
  ParsedMetadata, 
  ProcessedMetadata,
  TrackData,
  TokenMetadata,
  Artist,
  SongData,
  SongFile,
  ReleaseInfo,
  CopyrightInfo
} from '../types';

const AssetModal = ({ asset, isOpen, onClose }: AssetModalProps) => {
  const [parsedData, setParsedData] = useState<ParsedMetadata | null>(null);

  useEffect(() => {
    if (!asset) return;
    try {
      const rawData: ParsedMetadata = typeof asset.metadata_json === 'string' 
        ? JSON.parse(asset.metadata_json)
        : asset.metadata_json;

      setParsedData(rawData);
    } catch (err) {
      console.error('Metadata parsing error:', err);
      setParsedData(null);
    }
  }, [asset]);

  if (!parsedData || !asset) return null;


  const songFile: SongFile = parsedData.files && parsedData.files.length > 0 
    ? parsedData.files[0] 
    : { name: '', mediaType: '', src: '', song: {} as SongData };
  
  const release: ReleaseInfo = parsedData.release || {} as ReleaseInfo;
  const songData: SongData = songFile.song || {} as SongData;

  const processArtists = (artistsArray: (string | Artist)[] | undefined): string[] => {
    if (!Array.isArray(artistsArray)) return [];
    
    return artistsArray.map(artist => {
      if (typeof artist === 'string') return artist;
      if (typeof artist === 'object' && artist !== null) {
        if (artist.name && typeof artist.name === 'string') return artist.name;
        if (Object.keys(artist).length > 0) return String(Object.keys(artist)[0]);
      }
      return '';
    }).filter(Boolean);
  };

  const processLinks = (artists?: (string | Artist)[]): Record<string, string | string[]> => {
    if (!Array.isArray(artists)) return {};
    
    return artists.reduce<Record<string, string | string[]>>((acc, artist) => {
      if (typeof artist !== 'object' || artist === null) return acc;

      if (artist.links && typeof artist.links === 'object') {
        return { ...acc, ...artist.links };
      }

      const artistKey = Object.keys(artist)[0];
      if (artistKey && artist[artistKey] && 
          typeof artist[artistKey] === 'object' && 
          artist[artistKey].links) {
        return { ...acc, ...artist[artistKey].links };
      }
      
      return acc;
    }, {});
  };

  const releaseArtists = Array.isArray(release.artists) ? processArtists(release.artists) : [];
  const songArtists = Array.isArray(songData.artists) ? processArtists(songData.artists) : [];

  const metadata: ProcessedMetadata = {
    title: parsedData.name || '',
    image: parsedData.image || '',
    version: parsedData.music_metadata_version || '',
    artists: [...releaseArtists, ...songArtists],
    genres: [
      ...(Array.isArray(release.genres) ? release.genres : []),
      ...(Array.isArray(songData.genres) ? songData.genres : [])
    ].filter(Boolean),
    links: {
      ...(release.links && typeof release.links === 'object' ? release.links : {}),
      ...processLinks(songData.artists)
    },
    releaseInfo: {
      type: release.release_type || 'Single',
      title: release.release_title || '',
      producer: release.producer || songData.producer || '',
      mix_engineer: release.mix_engineer || '',
      mastering_engineer: release.mastering_engineer || '',
      collection: release.collection || '',
      series: release.series || '',
      visual_artist: release.visual_artist || ''
    },
    copyright: null
  };

  const copyrightData: string | CopyrightInfo | undefined = songData.copyright || release.copyright;
  
  if (typeof copyrightData === 'string') {
    metadata.copyright = { text: copyrightData };
  } else if (copyrightData && typeof copyrightData === 'object') {
    metadata.copyright = {
      master: typeof copyrightData.master === 'string' ? copyrightData.master : '',
      composition: typeof copyrightData.composition === 'string' ? copyrightData.composition : ''
    };
  }

  const trackData: TrackData = {
    title: typeof songData.song_title === 'string' ? songData.song_title || '' : 
           (typeof songFile.name === 'string' ? songFile.name || '' : ''),
    duration: songData.song_duration || '',
    number: songData.track_number || '',
    src: songFile.src || '',
    mediaType: songFile.mediaType || '',
    isExplicit: (release.parental_advisory === 'Explicit') || false,
    isrc: songData.isrc || '',
    iswc: songData.iswc || ''
  };

  const tokenMetadata: TokenMetadata = {
    "721": {
      [asset.policy_id]: {
        [asset.asset_name]: parsedData
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-700 border-slate-800 flex flex-col items-center border border-neutral-400 w-[95vw] sm:w-[90vw] min-w-[50dvw] md:w-fit max-w-3xl p-4 sm:p-6">
        <DialogHeader className="w-full flex flex-row justify-between items-center mb-4">
          <DialogTitle className="text-lg sm:text-xl font-semibold text-slate-200 line-clamp-2">
            {metadata.title}
          </DialogTitle>
          <button 
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-600 transition-colors"
          >
          </button>
        </DialogHeader>

        <div className="w-full flex flex-col md:flex-row md:gap-6 items-center md:items-start">
          <div className="w-full md:w-2/5 mb-4 md:mb-0 border-[1px] items-center border-neutral-400 flex-shrink-0">
            <IPFSMedia
              src={metadata.image}
              type="image"
              className="w-full aspect-square object-cover rounded-lg"
              alt={metadata.title}
            />
          </div>

          <div className="w-full md:w-3/5">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="bg-black/30 text-neutral-300 w-full flex">
                <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
                <TabsTrigger value="track" className="flex-1">Track & Credits</TabsTrigger>
                <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[280px] sm:h-[350px] pr-4 mt-2">
                <TabsContent value="info">
                  <Card>
                    <CardContent className="space-y-4 pt-4">
                      {metadata.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {metadata.genres.map((genre, i) => (
                            <Badge key={i} variant="outline" className="bg-blue-900/50">
                              {String(genre)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {metadata.releaseInfo.collection && (
                        <div className="text-sm text-slate-300">
                          Collection: {metadata.releaseInfo.collection}
                        </div>
                      )}

                      {metadata.artists.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-400 mb-2">Artists</h4>
                          {metadata.artists.map((artist, i) => (
                            <div key={i} className="text-slate-200">{String(artist)}</div>
                          ))}
                        </div>
                      )}

                      {Object.keys(metadata.links).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-400 mb-2">Links</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(metadata.links).map(([platform, url]) => {
                              const href = typeof url === 'string' ? url : 
                                           Array.isArray(url) && url.length > 0 && typeof url[0] === 'string' ? url[0] : '#';
                              
                              return (
                                <a
                                  key={platform}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-sm text-blue-400 hover:bg-slate-700"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                  {platform}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="track">
                  <div className="space-y-4">
                    {trackData.src && (
                      <div className="w-full">
                        <IPFSMedia
                          src={trackData.src}
                          type="audio"
                          alt={trackData.title}
                          isrc={trackData.isrc}
                          iswc={trackData.iswc}
                          isExplicit={trackData.isExplicit}
                        />
                      </div>
                    )}

                    <Card>
                      <CardContent className="space-y-2 pt-4">
                        {metadata.releaseInfo.producer && (
                          <div className="text-sm text-slate-300">
                            Producer: {metadata.releaseInfo.producer}
                          </div>
                        )}
                        {metadata.releaseInfo.mix_engineer && (
                          <div className="text-sm text-slate-300">
                            Mix: {metadata.releaseInfo.mix_engineer}
                          </div>
                        )}
                        {metadata.releaseInfo.mastering_engineer && (
                          <div className="text-sm text-slate-300">
                            Master: {metadata.releaseInfo.mastering_engineer}
                          </div>
                        )}
                        {metadata.releaseInfo.visual_artist && (
                          <div className="text-sm text-slate-300">
                            Visual Artist: {metadata.releaseInfo.visual_artist}
                          </div>
                        )}
                        
                        {metadata.copyright && (
                          <div className="text-sm text-slate-300">
                            {metadata.copyright.text ? (
                              metadata.copyright.text
                            ) : (
                              <>
                                {metadata.copyright.master && <div>{metadata.copyright.master}</div>}
                                {metadata.copyright.composition && <div>{metadata.copyright.composition}</div>}
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="json">
                  <Card>
                    <CardContent className="space-y-4 pt-4">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(tokenMetadata));
                        }}
                        className="w-fit text-xs bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                      >
                        Copy JSON
                      </button>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto">
                        {JSON.stringify(tokenMetadata, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssetModal;