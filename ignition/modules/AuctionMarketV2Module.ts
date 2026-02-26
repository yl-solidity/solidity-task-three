import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuctionMarketV2Module = buildModule("AuctionMarketV2Module", (m) => {
  
  // 部署主合约
  const auctionMarket = m.contract("AuctionMarketV2", []);
  
  // 返回部署结果
  return { auctionMarket };
});

export default AuctionMarketV2Module;