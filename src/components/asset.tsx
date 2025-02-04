import React, { useState, useEffect } from 'react';

interface Asset {
    policy_id: string;
    asset_name: string;
    metadata_version: string;
    created_at: string;
    metadata_json: string;
}

const AssetsView: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const searchParam = searchTerm 
                    ? `?search=${encodeURIComponent(searchTerm)}` 
                    : '';
                const response = await fetch(`/api/assets${searchParam}`);
                const data: Asset[] = await response.json();
                setAssets(data);
            } catch (error) {
                console.error('Error fetching assets:', error);
            }
        };

        fetchAssets();
    }, [searchTerm]);

    return (
        <div>
            <input 
                type="text" 
                placeholder="Search asset name" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 mb-4 bg-slate-700 text-slate-200 rounded"
            />
            {assets.map((asset) => (
                <div key={`${asset.policy_id}-${asset.asset_name}`}>
                    {/* Render asset details */}
                    <p>{asset.asset_name}</p>
                </div>
            ))}
        </div>
    );
};

export default AssetsView;