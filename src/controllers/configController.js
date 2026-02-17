const getWalletAddress = async (req, res) => {
    try {
        const walletAddress = process.env.USDT_TRC20_WALLET_ADDRESS;

        if (!walletAddress) {
            return res.status(500).json({
                success: false,
                message: 'Wallet address not configured'
            });
        }

        res.json({
            success: true,
            data: {
                address: walletAddress,
                network: 'TRC20',
                currency: 'USDT'
            }
        });
    } catch (error) {
        console.error('Error fetching wallet address:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch wallet address'
        });
    }
};

module.exports = {
    getWalletAddress
};
