const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AuctionMarket - 单元测试", function () {
  let AuctionMarket, auctionMarket, MyNFT, myNFT;
  let MockERC20, mockERC20, MockPriceFeed, mockPriceFeed;
  let owner, addr1, addr2, addr3;
  
  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    // 部署 MyNFT
    MyNFT = await ethers.getContractFactory("MyNFT");
    myNFT = await MyNFT.deploy(owner.address);
    await myNFT.waitForDeployment();
    
    // 部署 MockERC20
    MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("MockUSDC", "MUSDC", 18);
    await mockERC20.waitForDeployment();
    
    // 部署 MockPriceFeed
    MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(200000000000); // $2000
    await mockPriceFeed.waitForDeployment();
    
    // 部署 AuctionMarket
    AuctionMarket = await ethers.getContractFactory("AuctionMarket");
    auctionMarket = await AuctionMarket.deploy(owner.address);
    await auctionMarket.waitForDeployment();
    
    // 添加支持的代币
    await auctionMarket.addSupportedToken(
      await mockERC20.getAddress(),
      await mockPriceFeed.getAddress()
    );
  });

  describe("构造函数测试", function () {
    it("应该正确设置初始所有者", async function () {
      expect(await auctionMarket.owner()).to.equal(owner.address);
    });

    it("应该正确设置手续费接收者", async function () {
      expect(await auctionMarket.feeRecipient()).to.equal(owner.address);
    });

    it("应该默认支持ETH", async function () {
      const supportedToken = await auctionMarket.supportedTokens(ethers.ZeroAddress);
      expect(supportedToken.isActive).to.be.true;
    });
  });

  describe("创建拍卖测试", function () {
    let tokenId;
    
    beforeEach(async function () {
      // 铸造 NFT 给 addr1
      await myNFT.connect(addr1).safeMint(addr1.address, "ipfs://test");
      tokenId = await myNFT.getCurrentTokenId();
      
      // 授权
      await myNFT.connect(addr1).approve(await auctionMarket.getAddress(), tokenId);
    });

    it("应该能创建ETH拍卖", async function () {
      const duration = 3600;
      
      await expect(
        auctionMarket.connect(addr1).createAuction(
          await myNFT.getAddress(),
          tokenId,
          ethers.ZeroAddress,
          duration
        )
      ).to.emit(auctionMarket, "AuctionCreated");
      
      const auction = await auctionMarket.auctions(1);
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(auction.seller).to.equal(addr1.address);
      expect(auction.bidToken).to.equal(ethers.ZeroAddress);
      expect(auction.ended).to.be.false;
      
      // 验证NFT已转移
      expect(await myNFT.ownerOf(tokenId)).to.equal(await auctionMarket.getAddress());
    });

    it("应该能创建ERC20拍卖", async function () {
      const duration = 3600;
      
      await expect(
        auctionMarket.connect(addr1).createAuction(
          await myNFT.getAddress(),
          tokenId,
          await mockERC20.getAddress(),
          duration
        )
      ).to.emit(auctionMarket, "AuctionCreated");
      
      const auction = await auctionMarket.auctions(1);
      expect(auction.bidToken).to.equal(await mockERC20.getAddress());
    });

    it("非所有者不能创建拍卖", async function () {
      const duration = 3600;
      await expect(
        auctionMarket.connect(addr2).createAuction(
          await myNFT.getAddress(),
          tokenId,
          ethers.ZeroAddress,
          duration
        )
      ).to.be.revertedWith("Not NFT owner");
    });
  });

  describe("ETH出价测试", function () {
    let tokenId;
    let auctionId = 1;
    
    beforeEach(async function () {
      // 创建拍卖
      await myNFT.connect(addr1).safeMint(addr1.address, "ipfs://test");
      tokenId = await myNFT.getCurrentTokenId();
      await myNFT.connect(addr1).approve(await auctionMarket.getAddress(), tokenId);
      
      await auctionMarket.connect(addr1).createAuction(
        await myNFT.getAddress(),
        tokenId,
        ethers.ZeroAddress,
        3600
      );
    });

    it("应该能出价ETH", async function () {
      const bidAmount = ethers.parseEther("1");
      
      await expect(
        auctionMarket.connect(addr2).placeBid(auctionId, bidAmount, { value: bidAmount })
      ).to.emit(auctionMarket, "BidPlaced");
      
      const auction = await auctionMarket.auctions(auctionId);
      expect(auction.highestBidder).to.equal(addr2.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("出价必须高于当前最高价10%", async function () {
      const firstBid = ethers.parseEther("1");
      await auctionMarket.connect(addr2).placeBid(auctionId, firstBid, { value: firstBid });
      
      const lowBid = ethers.parseEther("1.05");
      await expect(
        auctionMarket.connect(addr3).placeBid(auctionId, lowBid, { value: lowBid })
      ).to.be.revertedWith("Bid too low");
    });

    it("应该退回前一个出价者的ETH", async function () {
      const firstBid = ethers.parseEther("1");
      await auctionMarket.connect(addr2).placeBid(auctionId, firstBid, { value: firstBid });
      
      const beforeBalance = await ethers.provider.getBalance(addr2.address);
      const secondBid = ethers.parseEther("1.2");
      await auctionMarket.connect(addr3).placeBid(auctionId, secondBid, { value: secondBid });
      const afterBalance = await ethers.provider.getBalance(addr2.address);
      
      expect(afterBalance - beforeBalance).to.equal(firstBid);
    });
  });

  describe("ERC20出价测试", function () {
    let tokenId;
    let auctionId = 1;
    
    beforeEach(async function () {
      // 创建NFT和拍卖
      await myNFT.connect(addr1).safeMint(addr1.address, "ipfs://test");
      tokenId = await myNFT.getCurrentTokenId();
      await myNFT.connect(addr1).approve(await auctionMarket.getAddress(), tokenId);
      
      await auctionMarket.connect(addr1).createAuction(
        await myNFT.getAddress(),
        tokenId,
        await mockERC20.getAddress(),
        3600
      );
      
      // 给addr2和addr3转代币
      const amount = ethers.parseEther("10000");
      await mockERC20.transfer(addr2.address, amount);
      await mockERC20.transfer(addr3.address, amount);
      
      // 授权
      await mockERC20.connect(addr2).approve(await auctionMarket.getAddress(), amount);
      await mockERC20.connect(addr3).approve(await auctionMarket.getAddress(), amount);
    });

    it("应该能出价ERC20", async function () {
      const bidAmount = ethers.parseEther("500");
      
      await expect(
        auctionMarket.connect(addr2).placeBid(auctionId, bidAmount)
      ).to.emit(auctionMarket, "BidPlaced");
      
      const auction = await auctionMarket.auctions(auctionId);
      expect(auction.highestBidder).to.equal(addr2.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("应该退回前一个出价者的代币", async function () {
      const firstBid = ethers.parseEther("500");
      await auctionMarket.connect(addr2).placeBid(auctionId, firstBid);
      
      const beforeBalance = await mockERC20.balanceOf(addr2.address);
      const secondBid = ethers.parseEther("600");
      await auctionMarket.connect(addr3).placeBid(auctionId, secondBid);
      const afterBalance = await mockERC20.balanceOf(addr2.address);
      
      expect(afterBalance - beforeBalance).to.equal(firstBid);
    });
  });

  describe("结束拍卖测试", function () {
    let tokenId;
    let auctionId = 1;
    
    beforeEach(async function () {
      await myNFT.connect(addr1).safeMint(addr1.address, "ipfs://test");
      tokenId = await myNFT.getCurrentTokenId();
      await myNFT.connect(addr1).approve(await auctionMarket.getAddress(), tokenId);
      
      await auctionMarket.connect(addr1).createAuction(
        await myNFT.getAddress(),
        tokenId,
        ethers.ZeroAddress,
        3600
      );
    });

    it("卖家可以在拍卖结束后结束拍卖", async function () {
      await time.increase(3601);
      
      await expect(
        auctionMarket.connect(addr1).endAuction(auctionId)
      ).to.emit(auctionMarket, "AuctionEnded");
      
      const auction = await auctionMarket.auctions(auctionId);
      expect(auction.ended).to.be.true;
    });

    it("没有出价者时退回NFT", async function () {
      await time.increase(3601);
      await auctionMarket.connect(addr1).endAuction(auctionId);
      
      expect(await myNFT.ownerOf(tokenId)).to.equal(addr1.address);
    });

    it("有出价者时正确分配资金和NFT", async function () {
      const bidAmount = ethers.parseEther("10");
      await auctionMarket.connect(addr2).placeBid(auctionId, bidAmount, { value: bidAmount });
      
      await time.increase(3601);
      await auctionMarket.connect(addr1).endAuction(auctionId);
      
      // 验证NFT转移
      expect(await myNFT.ownerOf(tokenId)).to.equal(addr2.address);
      
      // 验证拍卖状态
      const auction = await auctionMarket.auctions(auctionId);
      expect(auction.ended).to.be.true;
    });
  });

  describe("紧急取消测试", function () {
    let tokenId;
    let auctionId = 1;
    
    beforeEach(async function () {
      await myNFT.connect(addr1).safeMint(addr1.address, "ipfs://test");
      tokenId = await myNFT.getCurrentTokenId();
      await myNFT.connect(addr1).approve(await auctionMarket.getAddress(), tokenId);
      
      await auctionMarket.connect(addr1).createAuction(
        await myNFT.getAddress(),
        tokenId,
        ethers.ZeroAddress,
        3600
      );
    });

    it("所有者可以紧急取消拍卖", async function () {
      const bidAmount = ethers.parseEther("1");
      await auctionMarket.connect(addr2).placeBid(auctionId, bidAmount, { value: bidAmount });
      
      await expect(
        auctionMarket.connect(owner).emergencyCancelAuction(auctionId)
      ).to.emit(auctionMarket, "AuctionEnded");
      
      // 验证NFT退回
      expect(await myNFT.ownerOf(tokenId)).to.equal(addr1.address);
      
      // 验证ETH退回
      const auction = await auctionMarket.auctions(auctionId);
      expect(auction.ended).to.be.true;
    });

    it("非所有者不能紧急取消", async function () {
      await expect(
        auctionMarket.connect(addr1).emergencyCancelAuction(auctionId)
      ).to.be.revertedWithCustomError(auctionMarket, "OwnableUnauthorizedAccount");
    });
  });

  describe("手续费管理测试", function () {
    it("所有者可以更新手续费率", async function () {
      await auctionMarket.connect(owner).setFeeRate(500);
      expect(await auctionMarket.feeRate()).to.equal(500);
    });

    it("非所有者不能更新手续费率", async function () {
      await expect(
        auctionMarket.connect(addr1).setFeeRate(500)
      ).to.be.revertedWithCustomError(auctionMarket, "OwnableUnauthorizedAccount");
    });

    it("手续费率不能超过10%", async function () {
      await expect(
        auctionMarket.connect(owner).setFeeRate(1001)
      ).to.be.revertedWith("Fee rate too hige");
    });
  });
});