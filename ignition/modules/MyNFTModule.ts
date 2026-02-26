import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MyNFTModule = buildModule("MyNFTModule", (m) => {
  // 部署参数
  const initialOwner = m.getParameter(
    "initialOwner",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" // 默认部署者地址
  );
  
  const myNFT = m.contract("MyNFT", [initialOwner]);
  // 返回部署结果
  return { myNFT };
});

export default MyNFTModule;