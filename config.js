let dotenv = require("dotenv");

dotenv.config();

module.exports = {
    POLYGON_RPC: process.env.POLYGON_RPC,
    MAKER_PVT_KEY: process.env.MAKER_PVT_KEY,
    TAKER_PVT_KEY: process.env.TAKER_PVT_KEY,
    NFT_CONTRACT: process.env.NFT_CONTRACT,
    ERC20_CONTRACT: process.env.ERC20_CONTRACT
};
