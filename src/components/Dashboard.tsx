import React, { useState, useEffect, useMemo } from 'react';
import {X, Box, Database, Clock, Search } from 'lucide-react';
import AssetModal from './AssetModal';


interface Asset {
    policy_id: string;
    id: string;
    asset_name: string;
    metadata_version: string;
    created_at: string;
    metadata_json: string;
}
interface NetworkStats {
  blockHeight: number;
  epoch: number;
  slot: number;
  processedAssets: number;
  syncProgress: number;
  lastProcessedBlock: string;
  networkTip: number;
  currentSlot: number;
}



export const AssetsSearch = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
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
          
          <>
      {/* Search UI */}
      <AssetModal 
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </>
      </div>
  );
};




const StatCard: React.FC<{
  title: string;
  value: string | number; 
  subtitle: string;
  icon: React.ReactNode;
}> = ({ title, value, subtitle, icon }) => (
  <article className="bg-slate-800 p-4 rounded-lg shadow border-[1px] border-neutral-500">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      <div className="text-slate-500">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-slate-200">{value}</div>
    <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
  </article>
);

const MemoizedStatCard = React.memo(StatCard);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<NetworkStats>({
    blockHeight: 0,
    epoch: 0,
    slot: 0,
    processedAssets: 0,
    syncProgress: 0,
    lastProcessedBlock: '',
    networkTip: 0,
    currentSlot: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data: NetworkStats = await response.json();
        setStats(prevStats => {
          if (
            data.currentSlot !== prevStats.currentSlot ||
            data.networkTip !== prevStats.networkTip ||
            data.blockHeight !== prevStats.blockHeight ||
            data.epoch !== prevStats.epoch
          ) {
            return data;
          }
          return prevStats;
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 100);
    return () => clearInterval(interval);
  }, []);

  const progress = useMemo(() => {
    if (stats.networkTip === 0) return 0;  
    return (stats.slot / stats.networkTip) * 100;
  }, [stats.slot, stats.networkTip]);


  const statCards = useMemo(() => [
    { title: 'Block Height', value: stats.blockHeight.toLocaleString(), subtitle: 'Current blockchain height', icon: <Box size={20} /> },
    { title: 'Current Epoch', value: stats.epoch.toLocaleString(), subtitle: 'Cardano epoch', icon: <Clock size={20} /> },
    { title: 'Processed Assets', value: stats.processedAssets.toLocaleString(), subtitle: 'Total indexed NFTs', icon: <Database size={20} /> }
  ], [stats]);

  return (
    <main className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-[1.8rem] font-bold text-slate-100 mb-2">
            CIP-60 Music Token Indexer  
          </h1>
          <hr className="w-96"/>
          <p className="text-slate-400">
            Monitoring Cardano blockchain music assets
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3  gap-6 mb-8">
          {statCards.map((card, index) => (
            <MemoizedStatCard key={index} {...card} />
          ))}
        </div>

        <article className="bg-slate-800 rounded-lg border-[1px] border-neutral-500 shadow p-4">
          <h2 className="text-lg font-semibold  text-slate-200 mb-4">
            Sync Status
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col w-full  m-8 md:flex-row md:justify-evenly">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">
                  Current Slot  
                </p>
                <p className="text-lg font-semibold text-slate-200">
                  {stats.slot.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">
                  Network Tip  
                </p>
                <p className="text-lg font-semibold text-slate-200">
                  {stats.networkTip.toLocaleString()}  
                </p>
              </div>
            </div>

            <div>
            <div className="flex items-center">
              <p className="text-sm font-medium mr-4 text-end text-slate-400">
                Sync Progress
              </p>
              <div className="text-lg font-bold w-96 text-slate-200">
                {progress.toFixed(2)}%
              </div>
            </div>
            <div className="h-2 bg-slate-700 rounded-full mt-2">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        </article>

        <AssetsSearch />
      </div>
    </main>
  );
};

export default Dashboard;