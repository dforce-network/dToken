// Optional local configuration reference.
// The current dashboard stores chain and asset defaults in index.html asset buttons.
// Use this file as a template if you later move runtime config out of markup.

const CONFIG = {
    ethereumRpcUrl: 'https://ethereum.publicnode.com',
    bscRpcUrl: 'https://bsc-dataseed.binance.org',
    defaultAsset: {
        chain: 'ethereum',
        symbol: 'USDT',
        dToken: '0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
