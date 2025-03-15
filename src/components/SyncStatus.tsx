import React from 'react';
import { NetworkStats } from '../types';

interface SyncStatusProps {
  stats: NetworkStats;
  progress: number;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ stats, progress }) => {
  return (
    <article className="bg-slate-800 rounded-lg border-[1px] border-neutral-500 shadow p-4">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">
        Sync Status
      </h2>
      <div className="space-y-4">
        <div className="flex flex-col w-full m-8 md:flex-row md:justify-evenly">
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
  );
};

export default SyncStatus;