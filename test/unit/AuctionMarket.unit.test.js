import { describe, it, beforeEach } from "node:test";
import { expect } from "chai";
import hre from "hardhat";

describe("AuctionMarket - 单元测试", function () {
  let auctionMarket, myNFT;
  let mockERC20, mockPriceFeed;
  let owner, addr1, addr2, addr3;
  let publicClient;
  
  beforeEach(async function () {
    const { viem } = await hre.network.connect({
      network: "hardhat", // 使用 hardhat 网络
    });
    const clients = await viem.getWalletClients();
    [owner, addr1, addr2, addr3] = clients;
     // 获取公共客户端
     publicClient = await viem.getPublicClient();
    // 部署 MyNFT
    myNFT = await viem.deployContract("MyNFT", [owner.account.address]);
    
    // 部署 MockERC20
    mockERC20 = await viem.deployContract("MockERC20", ["MockUSDC", "MUSDC", 18]);
    
    // 部署 MockPriceFeed
    mockPriceFeed = await viem.deployContract("MockPriceFeed", [200000000000n]); // $2000
    
    // 部署 AuctionMarket
    auctionMarket = await viem.deployContract("AuctionMarket", [owner.account.address]);
    
    // 添加支持的代币
    await auctionMarket.write.addSupportedToken([
      mockERC20.address,
      mockPriceFeed.address
    ], {
      account: owner.account.address
    });
  });

  describe("构造函数测试", function () {
    it("应该正确设置初始所有者", async function () {
      const ownerAddr = await auctionMarket.read.owner();
      expect(ownerAddr.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("应该正确设置手续费接收者", async function () {
      const feeRecipient = await auctionMarket.read.feeRecipient();
      expect(feeRecipient.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("应该默认支持ETH", async function () {
      const supportedToken = await auctionMarket.read.supportedTokens(["0x0000000000000000000000000000000000000000"]);
      expect(supportedToken.isActive).to.be.true;
    });
  });

  describe("创建拍卖测试", function () {
    let tokenId;
    
    beforeEach(async function () {
      // 铸造 NFT 给 addr1
      await myNFT.write.safeMint([addr1.account.address, "ipfs://test"], {
        account: owner.account.address
      });
      tokenId = await myNFT.read.getCurrentTokenId();
      
      // 授权
      await myNFT.write.approve([auctionMarket.address, tokenId], {
        account: addr1.account.address
      });
    });

    it("应该能创建ETH拍卖", async function () {
      const duration = 3600;
      
      await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        "0x0000000000000000000000000000000000000000",
        BigInt(duration)
      ], {
        account: addr1.account.address
      });
      
      const auction = await auctionMarket.read.auctions([1n]);
      expect(auction.nftContract.toLowerCase()).to.equal(myNFT.address.toLowerCase());
      expect(auction.seller.toLowerCase()).to.equal(addr1.account.address.toLowerCase());
      expect(auction.bidToken).to.equal("0x0000000000000000000000000000000000000000");
      expect(auction.ended).to.be.false;
      
      // 验证NFT已转移
      const ownerOf = await myNFT.read.ownerOf([tokenId]);
      expect(ownerOf.toLowerCase()).to.equal(auctionMarket.address.toLowerCase());
    });

    it("应该能创建ERC20拍卖", async function () {
      const duration = 3600;
      
      await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        mockERC20.address,
        BigInt(duration)
      ], {
        account: addr1.account.address
      });
      
      const auction = await auctionMarket.read.auctions([1n]);
      expect(auction.bidToken.toLowerCase()).to.equal(mockERC20.address.toLowerCase());
    });

    it("非所有者不能创建拍卖", async function () {
      const duration = 3600;
      
      try {
        await auctionMarket.write.createAuction([
          myNFT.address,
          tokenId,
          "0x0000000000000000000000000000000000000000",
          BigInt(duration)
        ], {
          account: addr2.account.address
        });
        expect.fail("应该抛出错误");
      } catch (error) {
        expect(error.message).to.include("Not NFT owner");
      }
    });
  });

  describe("ETH出价测试", function () {
    let tokenId;
    let auctionId = 1n;
    
    beforeEach(async function () {
      // 铸造 NFT 给 addr1
      await myNFT.write.safeMint([addr1.account.address, "ipfs://test"], {
        account: owner.account.address
      });
      tokenId = await myNFT.read.getCurrentTokenId();
      
      // 授权
      await myNFT.write.approve([auctionMarket.address, tokenId], {
        account: addr1.account.address
      });
      
      // 创建拍卖
      await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        "0x0000000000000000000000000000000000000000",
        3600n
      ], {
        account: addr1.account.address
      });
    });

    it("应该能出价ETH", async function () {
      const bidAmount = ethers.parseEther("1");
      
      await auctionMarket.write.placeBid([auctionId, bidAmount], {
        account: addr2.account.address,
        value: bidAmount
      });
      
      const auction = await auctionMarket.read.auctions([auctionId]);
      expect(auction.highestBidder.toLowerCase()).to.equal(addr2.account.address.toLowerCase());
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("出价必须高于当前最高价10%", async function () {
      const firstBid = ethers.parseEther("1");
      await auctionMarket.write.placeBid([auctionId, firstBid], {
        account: addr2.account.address,
        value: firstBid
      });
      
      const lowBid = ethers.parseEther("1.05");
      try {
        await auctionMarket.write.placeBid([auctionId, lowBid], {
          account: addr3.account.address,
          value: lowBid
        });
        expect.fail("应该抛出错误");
      } catch (error) {
        expect(error.message).to.include("Bid too low");
      }
    });

    it("应该退回前一个出价者的ETH", async function () {
      const firstBid = ethers.parseEther("1");
      await auctionMarket.write.placeBid([auctionId, firstBid], {
        account: addr2.account.address,
        value: firstBid
      });
      
      const beforeBalance = await viem.getBalance({ address: addr2.account.address });
      
      const secondBid = ethers.parseEther("1.2");
      await auctionMarket.write.placeBid([auctionId, secondBid], {
        account: addr3.account.address,
        value: secondBid
      });
      
      const afterBalance = await viem.getBalance({ address: addr2.account.address });
      expect(afterBalance).to.be.closeTo(beforeBalance + firstBid, 1000000000000000n); // 允许微小误差
    });
  });

  describe("ERC20出价测试", function () {
    let tokenId;
    let auctionId = 1n;
    
    beforeEach(async function () {
      // 铸造 NFT 给 addr1
      await myNFT.write.safeMint([addr1.account.address, "ipfs://test"], {
        account: owner.account.address
      });
      tokenId = await myNFT.read.getCurrentTokenId();
      
      // 授权 NFT
      await myNFT.write.approve([auctionMarket.address, tokenId], {
        account: addr1.account.address
      });
      
      // 创建拍卖
      await auctionMarket.write.createAuction([
        myNFT.address,
        tokenId,
        mockERC20.address,
        3600n
      ], {
        account: addr1.account.address
      });
      
      // 给 addr2 和 addr3 转代币
      const amount = ethers.parseEther("10000");
      await mockERC20.write.transfer([addr2.account.address, amount], {
        account: owner.account.address
      });
      await mockERC20.write.transfer([addr3.account.address, amount], {
        account: owner.account.address
      });
      
      // 授权
      await mockERC20.write.approve([auctionMarket.address, amount], {
        account: addr2.account.address
      });
      await mockERC20.write.approve([auctionMarket.address, amount], {
        account: addr3.account.address
      });
    });

    it("应该能出价ERC20", async function () {
      const bidAmount = ethers.parseEther("500");
      
      await auctionMarket.write.placeBid([auctionId, bidAmount], {
        account: addr2.account.address
      });
      
      const auction = await auctionMarket.read.auctions([auctionId]);
      expect(auction.highestBidder.toLowerCase()).to.equal(addr2.account.address.toLowerCase());
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("应该退回前一个出价者的代币", async function () {
      const firstBid = ethers.parseEther("500");
      await auctionMarket.write.placeBid([auctionId, firstBid], {
        account: addr2.account.address
      });
      
      const beforeBalance = await mockERC20.read.balanceOf([addr2.account.address]);
      
      const secondBid = ethers.parseEther("600");
      await auctionMarket.write.placeBid([auctionId, secondBid], {
        account: addr3.account.address
      });
      
      const afterBalance = await mockERC20.read.balanceOf([addr2.account.address]);
      expect(afterBalance - beforeBalance).to.equal(firstBid);
    });
  });

  // 其他测试类似，需要增加 try-catch 来处理错误...
});