const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("AuctionMarket", function () {
  let myNFT;
  let auctionMarket;
  let owner;
  let seller;
  let bidder1;
  let bidder2;
  
  const TOKEN_URI = "https://example.com/token/1";
  
  beforeEach(async function () {
    [owner, seller, bidder1, bidder2] = await ethers.getSigners();
    
    // 部署 NFT 合约
    const MyNFT = await ethers.getContractFactory("MyNFT");
    myNFT = await MyNFT.deploy();
    
    // 部署拍卖市场合约
    const AuctionMarket = await ethers.getContractFactory("AuctionMarket");
    auctionMarket = await upgrades.deployProxy(AuctionMarket, [owner.address], {
      initializer: "initialize",
    });
    
    // 铸造 NFT
    await myNFT.safeMint(seller.address, TOKEN_URI);
  });
  
  describe("NFT Contract", function () {
    it("Should mint NFT successfully", async function () {
      const tokenId = await myNFT.getCurrentTokenId();
      expect(tokenId).to.equal(1);
      expect(await myNFT.ownerOf(1)).to.equal(seller.address);
      expect(await myNFT.tokenURI(1)).to.equal(TOKEN_URI);
    });
    
    it("Should transfer NFT", async function () {
      await myNFT.connect(seller).transferFrom(seller.address, bidder1.address, 1);
      expect(await myNFT.ownerOf(1)).to.equal(bidder1.address);
    });
  });
  
  describe("Auction Market", function () {
    beforeEach(async function () {
      // 卖家批准 NFT 给拍卖合约
      await myNFT.connect(seller).approve(await auctionMarket.getAddress(), 1);
    });
    
    it("Should create auction", async function () {
      const duration = 24 * 60 * 60; // 24小时
      
      await auctionMarket.connect(seller).createAuction(
        await myNFT.getAddress(),
        1,
        ethers.ZeroAddress, // ETH
        duration
      );
      
      const auction = await auctionMarket.getAuction(1);
      expect(auction.nftContract).to.equal(await myNFT.getAddress());
      expect(auction.tokenId).to.equal(1);
      expect(auction.seller).to.equal(seller.address);
      expect(auction.bidToken).to.equal(ethers.ZeroAddress);
      expect(auction.ended).to.be.false;
    });
    
    it("Should place bid with ETH", async function () {
      const duration = 24 * 60 * 60;
      
      await auctionMarket.connect(seller).createAuction(
        await myNFT.getAddress(),
        1,
        ethers.ZeroAddress,
        duration
      );
      
      // 出价 1 ETH
      await auctionMarket.connect(bidder1).placeBid(1, ethers.parseEther("1"), {
        value: ethers.parseEther("1")
      });
      
      const auction = await auctionMarket.getAuction(1);
      expect(auction.highestBidder).to.equal(bidder1.address);
      expect(auction.highestBid).to.equal(ethers.parseEther("1"));
    });
    
    it("Should end auction and transfer NFT", async function () {
      const duration = 24 * 60 * 60;
      
      await auctionMarket.connect(seller).createAuction(
        await myNFT.getAddress(),
        1,
        ethers.ZeroAddress,
        duration
      );
      
      // 出价
      await auctionMarket.connect(bidder1).placeBid(1, ethers.parseEther("1"), {
        value: ethers.parseEther("1")
      });
      
      // 增加时间以结束拍卖
      await ethers.provider.send("evm_increaseTime", [duration + 1]);
      await ethers.provider.send("evm_mine");
      
      // 结束拍卖
      await auctionMarket.connect(owner).endAuction(1);
      
      const auction = await auctionMarket.getAuction(1);
      expect(auction.ended).to.be.true;
      expect(await myNFT.ownerOf(1)).to.equal(bidder1.address);
    });
  });
});