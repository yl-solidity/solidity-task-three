import { describe, it, beforeEach } from "node:test";
import { expect } from "chai";
import hre from "hardhat";

describe("AuctionMarket Unit Tests", () => {
  let auctionMarket, myNFT;
  let mockERC20, mockPriceFeed;
  let owner, addr1, addr2, addr3;
  let publicClient;
  
  beforeEach(async () => {
    const { viem } = await hre.network.connect({ network: "hardhat" });
    const walletClients = await viem.getWalletClients();
    publicClient = await viem.getPublicClient();
    [owner, addr1, addr2, addr3] = walletClients;
    
    // 部署所有合约
    myNFT = await viem.deployContract("MyNFT", [owner.account.address], {
      account: owner.account.address
    });
    
    mockERC20 = await viem.deployContract("MockERC20", ["MockUSDC", "MUSDC", 18], {
      account: owner.account.address
    });
    
    mockPriceFeed = await viem.deployContract("MockPriceFeed", [200000000000n], {
      account: owner.account.address
    });
    
    auctionMarket = await viem.deployContract("AuctionMarket", [owner.account.address], {
      account: owner.account.address
    });
    
    // 添加支持的代币
    await auctionMarket.write.addSupportedToken([mockERC20.address, mockPriceFeed.address], {
      account: owner.account.address
    });
  });

  describe("Constructor", () => {
    it("should set correct owner", async () => {
      const ownerAddr = await auctionMarket.read.owner();
      expect(ownerAddr.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("should set correct fee recipient", async () => {
      const feeRecipient = await auctionMarket.read.feeRecipient();
      expect(feeRecipient.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("should support ETH by default", async () => {
      const supportedToken = await auctionMarket.read.supportedTokens([
        "0x0000000000000000000000000000000000000000"
      ]);
      expect(supportedToken[2]).to.be.true;
    });
  });

  describe("Create Auction", () => {
    let tokenId;
    
    beforeEach(async () => {
      // 铸造 NFT 给 addr1
      const mintTx = await myNFT.write.safeMint([addr1.account.address, "ipfs://test"], {
        account: owner.account.address
      });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      tokenId = await myNFT.read.getCurrentTokenId();
      
      // 授权
      const approveTx = await myNFT.write.approve([auctionMarket.address, tokenId], {
        account: addr1.account.address
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    });

    it("should create ETH auction", async () => {
      const tx = await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        "0x0000000000000000000000000000000000000000",
        3600n
      ], { account: addr1.account.address });
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 获取刚创建的 auctionId（应该是 1 或 2）
      let auctionId = 1n;
      let auction = await auctionMarket.read.auctions([auctionId]);
      
      // 如果 auctionId=1 的 seller 不是 addr1，尝试 auctionId=2
      if (auction[2].toLowerCase() !== addr1.account.address.toLowerCase()) {
        auctionId = 2n;
        auction = await auctionMarket.read.auctions([auctionId]);
      }
      
      expect(auction[2].toLowerCase()).to.equal(addr1.account.address.toLowerCase());
      expect(auction[4]).to.equal("0x0000000000000000000000000000000000000000");
      expect(auction[9]).to.be.false;
      
      // 验证 NFT 已转移
      const ownerOf = await myNFT.read.ownerOf([tokenId]);
      expect(ownerOf.toLowerCase()).to.equal(auctionMarket.address.toLowerCase());
    });

    it("should create ERC20 auction", async () => {
      const tx = await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        mockERC20.address,
        3600n
      ], { account: addr1.account.address });
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 获取刚创建的 auctionId
      let auctionId = 1n;
      let auction = await auctionMarket.read.auctions([auctionId]);
      
      if (auction[4].toLowerCase() !== mockERC20.address.toLowerCase()) {
        auctionId = 2n;
        auction = await auctionMarket.read.auctions([auctionId]);
      }
      
      expect(auction[4].toLowerCase()).to.equal(mockERC20.address.toLowerCase());
    });

    it("should not allow non-owner to create auction", async () => {
      try {
        await auctionMarket.write.createAuction([
          myNFT.address,
          tokenId,
          "0x0000000000000000000000000000000000000000",
          3600n
        ], { account: addr2.account.address });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error.message).to.include("Not NFT owner");
      }
    });
  });

  describe("ETH Bidding", () => {
    let tokenId;
    let auctionId;
    
    beforeEach(async () => {
      // 铸造 NFT 给 addr1
      const mintTx = await myNFT.write.safeMint([addr1.account.address, "ipfs://test"], {
        account: owner.account.address
      });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      tokenId = await myNFT.read.getCurrentTokenId();
      
      // 授权
      const approveTx = await myNFT.write.approve([auctionMarket.address, tokenId], {
        account: addr1.account.address
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      
      // 创建拍卖
      const createTx = await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        "0x0000000000000000000000000000000000000000",
        3600n
      ], { account: addr1.account.address });
      
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      
      // 确定 auctionId
      auctionId = 1n;
      let auction = await auctionMarket.read.auctions([auctionId]);
      
      if (auction[2].toLowerCase() !== addr1.account.address.toLowerCase()) {
        auctionId = 2n;
        auction = await auctionMarket.read.auctions([auctionId]);
      }
      
      console.log(`Using auctionId: ${auctionId} for bidding tests`);
    });

    it("should place ETH bid", async () => {
      const bidAmount = 10n ** 18n; // 1 ETH
      
      const bidTx = await auctionMarket.write.placeBid([auctionId, bidAmount], {
        account: addr2.account.address,
        value: bidAmount
      });
      await publicClient.waitForTransactionReceipt({ hash: bidTx });
      
      const auction = await auctionMarket.read.auctions([auctionId]);
      
      expect(auction[3].toLowerCase()).to.equal(addr2.account.address.toLowerCase());
      expect(auction[6]).to.equal(bidAmount);
    });

    it("should require bid 10% higher", async () => {
      const firstBid = 10n ** 18n;
      const firstTx = await auctionMarket.write.placeBid([auctionId, firstBid], {
        account: addr2.account.address,
        value: firstBid
      });
      await publicClient.waitForTransactionReceipt({ hash: firstTx });
      
      const lowBid = 1050000000000000000n; // 1.05 ETH
      try {
        await auctionMarket.write.placeBid([auctionId, lowBid], {
          account: addr3.account.address,
          value: lowBid
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error.message).to.include("Bid too low");
      }
    });

    it("should refund previous bidder", async () => {
      const firstBid = 10n ** 18n;
      const firstTx = await auctionMarket.write.placeBid([auctionId, firstBid], {
        account: addr2.account.address,
        value: firstBid
      });
      await publicClient.waitForTransactionReceipt({ hash: firstTx });
      
      const beforeBalance = await publicClient.getBalance({ 
        address: addr2.account.address 
      });
      
      const secondBid = 12n * 10n ** 17n; // 1.2 ETH
      const secondTx = await auctionMarket.write.placeBid([auctionId, secondBid], {
        account: addr3.account.address,
        value: secondBid
      });
      await publicClient.waitForTransactionReceipt({ hash: secondTx });
      
      const afterBalance = await publicClient.getBalance({ 
        address: addr2.account.address 
      });
      
      expect(afterBalance - beforeBalance).to.equal(firstBid);
    });
  });
});