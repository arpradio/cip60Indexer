
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, onClick }) => (
  <article 
    className={`bg-slate-800 p-4 rounded-lg shadow border-[1px] border-neutral-500 ${onClick ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      <div className="text-slate-500">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-slate-200">{value}</div>
    <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
  </article>
);

export default React.memo(StatCard);
=======
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, onClick }) => (
  <article 
    className={`bg-slate-800 p-4 rounded-lg shadow border-[1px] border-neutral-500 ${onClick ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      <div className="text-slate-500">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-slate-200">{value}</div>
    <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
  </article>
);

export default React.memo(StatCard);

