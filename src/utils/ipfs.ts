export const getIPFSUrl = (src: unknown): string => {
    if (!src || typeof src !== 'string') return '';
    if (src.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${src.replace('ipfs://', '')}`;
    }
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44,}/.test(src)) {
        return `https://ipfs.io/ipfs/${src}`;
    }
    if (src.startsWith('ar://')) {
        return `https://permagate.io/${src.replace('ar://', '')}`;
    };

    return `${src}`;
};
