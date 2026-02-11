import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuctionMarketV2Module = buildModule("AuctionMarketV2Module", (m) => {
  // 部署参数
  const initialOwner = m.getParameter(
    "initialOwner",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" // 默认部署者地址
  );
  
  // 部署主合约
  const auctionMarket = m.contract("AuctionMarketV2", [initialOwner]);
  
  // 返回部署结果
  return { auctionMarket };
});

export default AuctionMarketV2Module;