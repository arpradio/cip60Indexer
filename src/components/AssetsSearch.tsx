import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Asset } from '../types';
import AssetModal from './AssetModal';

const AssetsSearch: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!searchTerm) {
        setAssets([]);
        return;
      }

      try {
        const response = await fetch(`/api/assets?search=${encodeURIComponent(searchTerm)}`);
        const data: Asset[] = await response.json();
        setAssets(data);
      } catch (error) {
        console.error('Error fetching assets:', error);
      }
    };

    const timeoutId = setTimeout(fetchAssets, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  return (
    <div>
      <div className="relative m-4">
        <input 
          type="text" 
          placeholder="Search asset name" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 pl-10 bg-slate-700 text-slate-200 rounded"
        />
        <Search 
          className="absolute left-3 top-3 text-slate-400" 
          size={20} 
        />
      </div>
      {assets.length > 0 && (
        <div className="bg-slate-800 rounded-lg border-[1px] border-neutral-500 shadow p-4">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            Search Results
          </h3>
          {assets.map((asset) => (
            <div 
              key={`${asset.policy_id}-${asset.asset_name}`} 
              className="mb-2 pb-2 border-b border-slate-700 last:border-b-0 cursor-pointer hover:bg-slate-700 rounded p-2 transition-colors"
              onClick={() => setSelectedAsset(asset)}
            >
              <p className="text-slate-200">{asset.asset_name}</p>
              <p className="text-slate-400 text-sm">
                Version: {asset.metadata_version}
              </p>
            </div>
          ))}
        </div>
      )}
      
      <AssetModal 
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </div>
  );
};

export default AssetsSearch;