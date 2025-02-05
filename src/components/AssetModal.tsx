import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import { IPFSMedia } from './ipfsMedia';
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Music2, Link as LinkIcon } from 'lucide-react';

interface Asset {
  policy_id: string;
  asset_name: string;
  metadata_version: string;
  metadata_json: string | Record<string, any>;
}

interface AssetModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
}

const AssetModal = ({ asset, isOpen, onClose }: AssetModalProps) => {
  const [parsedData, setParsedData] = useState<any>(null);

  useEffect(() => {
    if (!asset) return;
    try {
      const rawData = typeof asset.metadata_json === 'string' 
        ? JSON.parse(asset.metadata_json) 
        : asset.metadata_json;

      setParsedData(rawData);
    } catch (err) {
      console.error('Metadata parsing error:', err);
      setParsedData(null);
    }
  }, [asset]);

  if (!parsedData || !asset) return null;

  const songFile = parsedData.files?.[0];
  const release = parsedData.release || {};
  const songData = songFile?.song || {};

  const metadata = {
    title: parsedData.name,
    image: parsedData.image,
    version: parsedData.music_metadata_version,
    artists: [
      ...(Array.isArray(release.artists) ? release.artists : []), 
      ...(songData.artists?.map((a: any) => typeof a === 'object' ? Object.keys(a)[0] : a) || [])
    ].filter(Boolean),
    genres: [
      ...(Array.isArray(release.genres) ? release.genres : []),
      ...(Array.isArray(songData.genres) ? songData.genres : [])
    ].filter(Boolean),
    links: {
      ...(release.links || {}),
      ...(songData.artists?.reduce((acc: any, artist: any) => ({
        ...acc,
        ...(typeof artist === 'object' && artist.links || {})
      }), {}))
    },
    releaseInfo: {
      type: release.release_type || 'Single',
      title: release.release_title,
      producer: release.producer || songData.producer,
      mix_engineer: release.mix_engineer,
      mastering_engineer: release.mastering_engineer,
      collection: release.collection,
      series: release.series,
      visual_artist: release.visual_artist
    },
    copyright: songData.copyright || release.copyright,
    track: {
      title: songData.song_title || songFile?.name,
      duration: songData.song_duration,
      number: songData.track_number,
      src: songFile?.src,
      mediaType: songFile?.mediaType,
      isExplicit: release.parental_advisory === 'Explicit',
      isrc: songData.isrc,
      iswc: songData.iswc
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-700 border-slate-800 flex flex-col items-center border border-neutral-400 w-fit align-center max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-200">
            {metadata.title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 items-center p-6">
          <div className="col-span-1 border-[1px] w-fit h-fit border-neutral-400">
            <IPFSMedia
              src={metadata.image}
              type="image"
              className="w-full h-full object-cover rounded-lg"
              alt={metadata.title}
            />
          </div>

          <div className="col-span-1">
          <Tabs defaultValue="info" className="w-72">
              <TabsList className='bg-black/30 text-neutral-300'>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="track">Track & Credits</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] pr-4">
                <TabsContent value="info">
                  <Card>
                    <CardContent className="space-y-4 pt-6">
                      {metadata.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {metadata.genres.map((genre, i) => (
                            <Badge key={i} variant="outline" className="bg-blue-900/50">
                              {genre}
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
                            <div key={i} className="text-slate-200">{artist}</div>
                          ))}
                        </div>
                      )}

                      {Object.keys(metadata.links).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-400 mb-2">Links</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(metadata.links).map(([platform, url]) => (
                              <a
                                key={platform}
                                href={typeof url === 'string' ? url : Array.isArray(url) ? url[0] : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-sm text-blue-400 hover:bg-slate-700"
                              >
                                <LinkIcon className="h-3 w-3" />
                                {platform}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="track" >
                  <div className="space-y-4">
                    {metadata.track.src && (
                      <IPFSMedia
                        src={metadata.track.src}
                        type="audio"
                        alt={metadata.track.title}
                        isrc={metadata.track.isrc}
                        iswc={metadata.track.iswc}
                        isExplicit={metadata.track.isExplicit}
                      />
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
                            {typeof metadata.copyright === 'string' ? 
                              metadata.copyright :
                              <>
                                {metadata.copyright.master}<br/>
                                {metadata.copyright.composition}
                              </>
                            }
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="json" className="w-72">
                  <Card>
                    <CardContent className="space-y-4 w-64 pt-6">
                      <button
                        onClick={() => {
                          const formattedJson = {
                            "721": {
                              [asset.policy_id]: {
                                [asset.asset_name]: parsedData
                              }
                            }
                          };
                          navigator.clipboard.writeText(JSON.stringify(formattedJson, null, 2));
                        }}
                        className=" w-fit text-xs bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                      >
                        Copy JSON
                      </button>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                        {JSON.stringify({
                          "721": {
                            [asset.policy_id]: {
                              [asset.asset_name]: parsedData
                            }
                          }
                        }, null, 2)}
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