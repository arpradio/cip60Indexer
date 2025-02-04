import { useState, useEffect, useRef } from 'react';
import { PlayCircle, PauseCircle, Bot, AlertTriangle } from 'lucide-react';
import { getIPFSUrl } from '../utils/ipfs';
import { audioManager } from '../utils/audioManager';

interface IPFSMediaProps {
  src: string;
  type: 'audio' | 'image' | 'video';
  className?: string;
  fill?: boolean;
  alt?: string;
  isrc?: string;
  iswc?: string;
  isExplicit?: boolean;
  isAIGenerated?: boolean;
  onError?: () => void;
}

export function IPFSMedia({
  src,
  type,
  className = '',
  fill,
  alt = '',
  isrc,
  iswc,
  isExplicit,
  isAIGenerated,
  onError
}: IPFSMediaProps) {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    try {
      const ipfsUrl = getIPFSUrl(src);
      setUrl(ipfsUrl);
      setError(false);
    } catch (err) {
      console.error('Error loading IPFS URL:', err);
      setError(true);
      onError?.();
    }
  }, [src, onError]);

  useEffect(() => {
    if (type === 'audio' && audioRef.current) {
      const handler = {
        play: () => setIsPlaying(true),
        pause: () => setIsPlaying(false),
        stop: () => {
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }
      };
      
      const unregister = audioManager.register(handler);
      return unregister;
    }
  }, [type]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioManager.play(audioRef.current, {
        play: () => setIsPlaying(true),
        pause: () => setIsPlaying(false),
        stop: () => {
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
        }
      });
      setIsPlaying(true);
    }
  };

  if (!url && !error) return null;

  switch (type) {
    case 'audio':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {isExplicit && (
              <div className="text-xs bg-red-700/60 text-gray-200 px-2 py-1 rounded border border-neutral-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>Explicit</span>
              </div>
            )}
            {isAIGenerated && (
              <div className="text-xs bg-purple-700/60 text-gray-200 px-2 py-1 rounded border border-neutral-400 flex items-center gap-1">
                <Bot size={12} />
                <span>AI Generated</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 border border-neutral-400 transition-colors">
            <button
              onClick={togglePlay}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isPlaying ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
            </button>
            <div className="flex-grow">
              <span className="font-medium">{alt}</span>
            </div>
            <audio
              ref={audioRef}
              src={error ? undefined : url}
              className="hidden"
              onEnded={() => setIsPlaying(false)}
              onError={() => {
                setError(true);
                onError?.();
              }}
            />
            <div className="flex gap-2">
              {isrc && (
                <a href={`https://musicbrainz.org/isrc/${isrc}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                  <div className="text-xs bg-blue-700/60 text-gray-200 px-2 py-1 rounded border border-neutral-400">
                    ISRC
                  </div>
                </a>
              )}
              {iswc && (
                <a href={`https://www.ascap.com/repertory#/ace/search/iswc/${iswc}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                  <div className="text-xs bg-orange-600/60 text-gray-200 px-2 py-1 rounded border border-neutral-400">
                    ISWC
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      );

    case 'video':
      return (
        <video
          src={error ? undefined : url}
          className={className}
          controls
          onError={() => {
            setError(true);
            onError?.();
          }}
        />
      );

    case 'image':
      return (
        <div className="relative">
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src="/album.gif"
                alt="Loading..."
                width={fill ? 300 : 160}
                height={fill ? 300 : 160}
                className={className}
              />
            </div>
          )}
          <img
            src={error ? '/default.png' : url}
            alt={alt}
            width={fill ? 300 : 160}
            height={fill ? 300 : 160}
            className={`${className} transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setIsImageLoading(false)}
            onError={() => {
              setError(true);
              setIsImageLoading(false);
              onError?.();
            }}
          />
        </div>
      );
  }
}