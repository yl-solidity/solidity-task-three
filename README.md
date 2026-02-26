# NFT 拍卖市场 - 项目文档

## 项目概述

一个基于以太坊的 NFT 拍卖市场，支持使用 ETH 或 ERC20 代币进行竞价，集成 Chainlink 预言机获取实时价格，并支持合约升级。

### 技术栈
- **Solidity**: ^0.8.20
- **框架**: Hardhat
- **合约标准**: ERC721, ERC20
- **代理模式**: UUPS (Universal Upgradeable Proxy Standard)
- **预言机**: Chainlink Price Feeds
- **测试**: Mocha/Chai

## 功能特性

### 1. NFT 合约 (MyNFT.sol)
- 支持铸造单个或多个 NFT
- 支持销毁 NFT
- 符合 ERC721 标准

### 2. 拍卖市场核心功能
- **创建拍卖**: NFT 持有者可以将 NFT 上架拍卖
- **出价功能**: 支持 ETH 和 ERC20 代币出价
- **结束拍卖**: 拍卖结束后自动转移 NFT 和资金
- **动态手续费**: 根据成交金额自动调整手续费率

### 3. 价格预言机集成
- 使用 Chainlink Price Feeds 获取 ETH/USD 价格
- 支持自定义 ERC20 代币价格查询
- 将出价金额实时转换为美元价值

### 4. 合约升级功能
- 使用 UUPS 代理模式
- 支持添加新功能而不丢失状态
- V2 版本增加了动态手续费和拍卖增强功能

## 合约架构

```
├── MyNFT.sol                 # NFT 基础合约
├── AuctionMarket.sol         # 拍卖市场 V1
├── AuctionMarketV2.sol       # 拍卖市场 V2 (升级版)
├── AuctionMarketProxy.sol    # 透明代理合约
└── mocks/
    └── MockPriceFeed.sol     # 模拟预言机(测试用)
```

## 部署步骤

### 1. 环境配置
```bash
# 安装依赖
npm install

# 生成hardhat 部署的keystore
npx hardhat keystore set SEPOLIA_RPC_URL

# 根据提示输入密码，和RPC URL。输入完成后，示例
    npx hardhat keystore set SEPOLIA_RPC_URL   
    #密码
    [hardhat-keystore] Enter the password: ***************
    # RPC URL
    [hardhat-keystore] Enter secret to store in the production keystore: *************************************************************
# 生成PRIVATE_KEY
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
    # 示例
    npx hardhat keystore set SEPOLIA_PRIVATE_KEY
    [hardhat-keystore] Enter the password: ***************
    [hardhat-keystore] Enter secret to store in the production keystore: ****************************************************************

# 完成RPC URL格式
Infura: https://sepolia.infura.io/v3/你的项目ID
Alchemy: https://eth-sepolia.g.alchemy.com/v2/你的API密钥

#查看keystore路径
npx hardhat keystore path

```

### 2. 编译合约
```bash
npx hardhat compile
```

### 3. 运行测试
```bash
# 运行所有测试
npx hardhat test

# 生成测试覆盖率报告
npx hardhat coverage
```

### 4. 部署到 Sepolia 测试网

#### 部署 MyNFT
```bash
npm run deploy:mynft
```

#### 部署 AuctionMarket V1
```bash
npm run deploy:market
```

#### 升级到 V2
```bash
npm run deploy:marketv2
```

## 部署地址

### Sepolia 测试网部署地址
- **MyNFT**: `0x...` (部署后更新)
- **AuctionMarket Proxy**: `0x...` (部署后更新)
- **AuctionMarket V1 Implementation**: `0x...` (部署后更新)
- **AuctionMarket V2 Implementation**: `0x...` (部署后更新)

## 使用指南

### 创建拍卖
```javascript
// 1. 授权
await myNFT.approve(auctionMarketAddress, tokenId);

// 2. 创建拍卖
await auctionMarket.createAuction(
  nftContractAddress,
  tokenId,
  bidTokenAddress, // 0x0 表示ETH
  durationInSeconds
);
```

### 出价
```javascript
// ETH 出价
await auctionMarket.placeBid(auctionId, bidAmount, {
  value: bidAmount
});

// ERC20 出价（需要先授权）
await erc20Token.approve(auctionMarketAddress, bidAmount);
await auctionMarket.placeBid(auctionId, bidAmount);
```

### 结束拍卖
```javascript
await auctionMarket.endAuction(auctionId);
```

## 合约接口说明

### MyNFT.sol
| 函数名 | 参数 | 返回值 | 权限 |
|--------|------|--------|------|
| safeMint | to, uri | tokenId | onlyOwner |
| batchMint | recipients, uris | tokenIds[] | onlyOwner |
| burn | tokenId | - | 所有者或授权地址 |
| getCurrentTokenId | - | uint256 | public |

### AuctionMarket.sol (V1)
| 函数名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| createAuction | nftContract, tokenId, bidToken, duration | auctionId | 创建拍卖 |
| placeBid | auctionId, bidAmount | - | 出价 |
| endAuction | auctionId | - | 结束拍卖 |
| emergencyCancelAuction | auctionId | - | 紧急取消 |
| addSupportedToken | token, priceFeed | - | 添加支持的代币 |
| setFeeRate | newFeeRate | - | 设置手续费率 |

### AuctionMarketV2.sol (新增功能)
| 函数名 | 参数 | 返回值 | 说明 |
|--------|------|------|------|
| getDynamicFeeRate | usdAmount | feeRate | 获取动态手续费 |
| addDynamicFeeLevel | min, max, feeRate | - | 添加手续费等级 |
| setMinBidIncreasePercentage | percentage | - | 设置最小加价幅度 |
| setAuctionExtensionTime | time | - | 设置拍卖延长时间 |
| calculateMinBid | currentBid | minBid | 计算最小出价 |

## 事件日志

### MyNFT
- `Minted(address sender, address to, uint256 tokenId, uint256 timestamp)`

### AuctionMarket
- `AuctionCreated(uint256 indexed auctionId, address indexed seller, address nftContract, uint256 tokenId, address bidToken, uint256 endTime)`
- `BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 usdAmount)`
- `AuctionEnded(uint256 indexed auctionId, address winner, uint256 finalPrice)`
- `TokenSupported(address indexed token, address indexed priceFeed)`

### AuctionMarketV2
- `DynamicFeeAdded(uint256 minAmount, uint256 maxAmount, uint256 feeRate)`
- `MinBidIncreasePercentageUpdated(uint256 newPercentage)`
- `AuctionExtensionTimeUpdated(uint256 newExtensionTime)`

## 安全考虑

### 已实现的安全措施
1. **重入攻击防护**: 使用 ReentrancyGuard
2. **访问控制**: Ownable 权限管理
3. **整数溢出检查**: Solidity 0.8+ 内置检查
4. **资金锁定防护**: 拍卖期间 NFT 锁定在合约中
5. **紧急停止**: 支持紧急取消拍卖

### 建议的额外安全措施
1. 部署前进行专业审计
2. 设置合理的费率上限
3. 添加时间锁机制
4. 多签钱包管理

## 依赖版本

```json
{
  "@openzeppelin/contracts": "^5.4.0",
  "@openzeppelin/contracts-upgradeable": "^5.4.0",
  "@chainlink/contracts": "^1.5.0",
  "hardhat": "^3.1.5"
}
```

## 故障排除

### 常见问题

**Q: 创建拍卖失败**
A: 检查是否已授权 NFT 给拍卖合约

**Q: 出价失败**
A: 确认代币余额充足且已授权

**Q: 合约升级失败**
A: 确保只有所有者可以升级，且新合约继承自相同接口

### 错误代码
- `Not NFT owner`: 只有 NFT 所有者可以创建拍卖
- `Bid too low`: 出价低于最低要求
- `Auction not ended`: 拍卖仍在进行中
- `Auction already ended`: 拍卖已结束
- `Token not supported`: 代币未添加到支持列表

## 版本历史

| 版本 | 日期 | 主要更新 |
|------|------|----------|
| v1.0.0 | 2024-03-20 | 基础拍卖功能 |
| v2.0.0 | 2024-03-20 | 添加动态手续费、拍卖增强功能 |