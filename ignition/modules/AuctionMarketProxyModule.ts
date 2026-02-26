import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuctionMarketProxyModule = buildModule("AuctionMarketProxyModule", (m) => {
  // 部署参数
  const initialOwner = m.getParameter(
    "initialOwner",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  );
  
  // 第一步：部署逻辑合约（V2）
  const auctionMarketImpl = m.contract("AuctionMarketV2");
  
  // 第二步：准备初始化数据
  // 注意：V2 的 initialize() 不需要参数
  const initData = m.encodeFunctionCall(auctionMarketImpl, "initialize", []);
  
  // 第三步：部署代理合约
  const proxy = m.contract("AuctionMarketProxy", [
    auctionMarketImpl,    // _logic: 逻辑合约地址
    initialOwner,         // initialOwner: 管理员地址
    initData              // _data: 初始化数据
  ]);
  
  // 只返回代理合约，不涉及 ProxyAdmin
  return { proxy };
});

export default AuctionMarketProxyModule;