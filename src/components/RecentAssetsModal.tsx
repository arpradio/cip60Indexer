import React, { useState, useEffect } from 'react';
import { X, Music } from 'lucide-react';
import { Asset } from '../types';
import AssetModal from './AssetModal';
import { getAssetImage, getAssetName, getMusicGenres } from '../utils/AssetHelpers';

interface RecentAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  isLoading: boolean;
}

const RecentAssetsModal: React.FC<RecentAssetsModalProps> = ({ isOpen, onClose, assets, isLoading }) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAsset(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg border-[1px] border-neutral-500 shadow p-4 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-200">Recent Assets</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
              <X size={20} />
            </button>
          </div>
          
          {isLoading ? (
            <div className="text-center p-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-slate-400">Loading recent assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <p className="text-slate-400 text-center p-4">No recent assets found</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {assets.map((asset) => {
                const imageUrl = getAssetImage(asset);
                const displayName = getAssetName(asset);
                const genres = getMusicGenres(asset);
                
                return (
                  <div 
                    key={`${asset.policy_id}-${asset.asset_name}`} 
                    className="bg-slate-700 rounded-lg p-4 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="w-auto h-[75px] object-cover rounded mb-2"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "./default.png";
                        }}
                      />
                    ) : (
                      <div className="w-full h-40 bg-slate-600 rounded mb-2 flex items-center justify-center">
                        <Music size={40} className="text-slate-400" />
                      </div>
                    )}
                    <p className="text-slate-200 font-medium truncate">{displayName}</p>
                    
                    {genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {genres.slice(0, 2).map((genre, i) => (
                          <span key={i} className="text-xs bg-slate-800 text-blue-400 px-2 py-0.5 rounded">
                            {genre}
                          </span>
                        ))}
                        {genres.length > 2 && (
                          <span className="text-xs bg-slate-800 text-blue-400 px-2 py-0.5 rounded">
                            +{genres.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <p className="text-slate-400 text-xs truncate mt-2">
                      Policy: {asset.policy_id.slice(0, 8)}...{asset.policy_id.slice(-8)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedAsset && (
        <AssetModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </>
  );
};

export default RecentAssetsModal;