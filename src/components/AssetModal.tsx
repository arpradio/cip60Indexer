import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";
import { IPFSMedia } from './ipfsMedia';
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Bot, Music2, Info, Link as LinkIcon, Hash } from 'lucide-react';



interface Asset {
    id: string;
    policy_id: string;
    asset_name: string;
    metadata_version: string;
    metadata_json: string | Record<string, any>;
  }
  
  interface AssetModalProps {
    asset: Asset | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
  export default function AssetModal({ asset, open, onOpenChange }: AssetModalProps) {
    const [metadata, setMetadata] = useState<any>(null);
  

    useEffect(() => {
        if (!asset) return;
        try {
          const parsed = typeof asset.metadata_json === 'string' 
            ? JSON.parse(asset.metadata_json) 
            : asset.metadata_json;
    
          const data = parsed["721"] 
            ? Object.values(parsed["721"])[0]
            : parsed;
    
          setMetadata(data);
        } catch (err) {
          console.error('Metadata parsing error:', err);
          setMetadata(null);
        }
      }, [asset]);
    
      if (!metadata || !asset) return null;
    

  const assetData = Object.values(metadata)[0] as any;
  const files = assetData.files || [];
  const release = assetData.release || {};
  const musicData = {
    artists: release.artists || assetData.artists || [],
    genres: release.genres || assetData.genres || [],
    title: release.release_title || assetData.album_title || assetData.name,
    type: release.release_type || assetData.release_type || 'Single',
    copyright: release.copyright || assetData.copyright,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-200 flex items-center gap-2">
            <Hash className="h-5 w-5" />
            {musicData.title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <div className="p-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card className="border-0 bg-slate-800">
                  <CardContent className="pt-6">
                    <div className="relative w-64 h-64 mx-auto mb-4">
                      <IPFSMedia
                        src={assetData.image}
                        type="image"
                        className="w-full h-full object-cover rounded-lg"
                        alt={musicData.title}
                      />
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-sm text-slate-400">{musicData.type}</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {musicData.genres.map((genre: string, i: number) => (
                          <Badge key={i} variant="outline" className="bg-blue-900/50">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                {files.map((file: any, i: number) => (
                  <Card key={i} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <IPFSMedia
                        src={file.src}
                        type="audio"
                        alt={file.song?.song_title || file.name}
                        isrc={file.song?.isrc}
                        iswc={file.song?.iswc}
                        isExplicit={file.song?.explicit}
                        isAIGenerated={file.song?.ai_generated}
                      />
                      {(file.song?.producer || file.song?.mix_engineer || file.song?.mastering_engineer) && (
                        <div className="mt-2 pt-2 border-t border-slate-700 text-sm text-slate-400 flex flex-wrap gap-x-4">
                          {file.song.producer && <span>Producer: {file.song.producer}</span>}
                          {file.song.mix_engineer && <span>Mix: {file.song.mix_engineer}</span>}
                          {file.song.mastering_engineer && <span>Master: {file.song.mastering_engineer}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <Card className="bg-slate-800">
                  <CardContent className="p-4 space-y-4">
                    {musicData.artists.map((artist: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <h4 className="text-lg font-medium text-slate-200">{artist.name}</h4>
                        {artist.links && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(artist.links).map(([platform, url]: [string, any]) => (
                              <a
                                key={platform}
                                href={typeof url === 'string' ? url : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded text-sm text-blue-400 hover:bg-slate-600"
                              >
                                <LinkIcon className="h-3 w-3" />
                                {platform}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {musicData.copyright && (
                      <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-medium text-slate-400 mb-2">Rights</h4>
                        {typeof musicData.copyright === 'string' ? (
                          <p className="text-slate-200">{musicData.copyright}</p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-slate-200">℗ {musicData.copyright.master}</p>
                            <p className="text-slate-200">© {musicData.copyright.composition}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}