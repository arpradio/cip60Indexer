import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Database, Clock } from 'lucide-react';
import { NetworkStats, Asset } from '../types';
import StatCard from './StatCard';
import RecentAssetsModal from './RecentAssetsModal';
import AssetsSearch from './AssetsSearch';
import SyncStatus from './SyncStatus';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<NetworkStats>({
    blockHeight: 0,
    epoch: 0,
    slot: 0,
    processedAssets: 0,
    syncProgress: 0,
    lastProcessedBlock: '',
    networkTip: 0,
    currentSlot: 0,
    lastUpdated: new Date() 
  });
  
  const [showRecentAssets, setShowRecentAssets] = useState<boolean>(false);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(false);
  
  useEffect(() => {
  let isActive = true;
  
  const fetchStats = async () => {
    if (!isActive) return;
    
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error(`Error fetching stats: ${response.status}`);
      }
      
      const data: NetworkStats = await response.json();
      
      if (isActive) {
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
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  fetchStats();
  const interval = setInterval(fetchStats, 3000);
  
  return () => {
    isActive = false;
    clearInterval(interval);
  };
}, []);

  const fetchRecentAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const response = await fetch('/api/assets/recent');
      const data = await response.json();
      setRecentAssets(data);
      setShowRecentAssets(true);
    } catch (error) {
      console.error('Error fetching recent assets:', error);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  const progress = useMemo(() => {
    if (stats.networkTip === 0) return 0;  
    return (stats.slot / stats.networkTip) * 100;
  }, [stats.slot, stats.networkTip]);

  const statCards = useMemo(() => [
    { title: 'Block Height', value: stats.blockHeight.toLocaleString(), subtitle: 'Current blockchain height', icon: <Box size={20} /> },
    { title: 'Current Epoch', value: stats.epoch.toLocaleString(), subtitle: 'Cardano epoch', icon: <Clock size={20} /> },
    { 
      title: 'Processed Assets', 
      value: stats.processedAssets.toLocaleString(), 
      subtitle: 'Total indexed NFTs', 
      icon: <Database size={20} />,
      onClick: fetchRecentAssets
    }
  ], [stats, fetchRecentAssets]);

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {statCards.map((card, index) => (
            <StatCard key={index} {...card} />
          ))}
        </div>

        <SyncStatus stats={stats} progress={progress} />

        <AssetsSearch />
        
        <RecentAssetsModal
          isOpen={showRecentAssets}
          onClose={() => setShowRecentAssets(false)}
          assets={recentAssets}
          isLoading={isLoadingAssets}
        />
      </div>
    </main>
  );
};

export default Dashboard;