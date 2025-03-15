import { Asset } from '../types';

export const getAssetImage = (asset: Asset): string | null => {
  try {
    if (!asset.metadata_json) return null;

    const metadata = typeof asset.metadata_json === 'string'
      ? JSON.parse(asset.metadata_json)
      : asset.metadata_json;

    const image = metadata.image ||
      (metadata.files && metadata.files[0]?.src) ||
      metadata.mediaUrl ||
      null;

    return image;
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return null;
  }
};

export const getAssetName = (asset: Asset): string => {
  try {
    if (!asset.metadata_json) return asset.asset_name;

    const metadata = typeof asset.metadata_json === 'string'
      ? JSON.parse(asset.metadata_json)
      : asset.metadata_json;

    return metadata.name || asset.asset_name;
  } catch (error) {
    return asset.asset_name;
  }
};

export const getMusicGenres = (asset: Asset): string[] => {
  try {
    if (!asset.metadata_json) return [];

    const metadata = typeof asset.metadata_json === 'string'
      ? JSON.parse(asset.metadata_json)
      : asset.metadata_json;

    if (metadata.release && Array.isArray(metadata.release.genres)) {
      return metadata.release.genres;
    }

    if (metadata.files && metadata.files[0]?.song?.genres) {
      return Array.isArray(metadata.files[0].song.genres)
        ? metadata.files[0].song.genres
        : [];
    }

    return [];
  } catch (error) {
    return [];
  }
};