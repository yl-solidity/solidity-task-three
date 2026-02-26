import { describe, it, beforeEach } from "node:test";
import { expect } from "chai";
import hre from "hardhat";

describe("AuctionMarket", function () {
  let myNFT;
  let auctionMarket;
  let owner;
  let seller;
  let bidder1;
  let bidder2;
  
  const TOKEN_URI = "https://example.com/token/1";
  
  beforeEach(async function () {
    const { viem } = await hre.network.connect({
      network: "hardhat", // 使用 hardhat 网络
    });
     // 获取测试账户
     const [ownerClient, sellerClient, bidder1Client, bidder2Client] = await viem.getWalletClients();
     owner = ownerClient;
     seller = sellerClient;
     bidder1 = bidder1Client;
     bidder2 = bidder2Client;

     // 获取公共客户端（用于查询余额等）
    const publicClient  = await viem.getWalletClients();
    [owner, seller, bidder1, bidder2] = publicClient ;
    
    // 部署 NFT 合约
    myNFT = await viem.deployContract("MyNFT", [owner.account.address]);
    
    // 部署拍卖市场合约
    auctionMarket = await viem.deployContract("AuctionMarket", [owner.account.address]);
    
    // 铸造 NFT
    await myNFT.write.safeMint([seller.account.address, TOKEN_URI]);
  });
  
  describe("NFT Contract", function () {
    it("Should mint NFT successfully", async function () {
      const tokenId = await myNFT.read.getCurrentTokenId();
      expect(tokenId).to.equal(1n);
      
      const ownerOf = await myNFT.read.ownerOf([1n]);
      expect(ownerOf.toLowerCase()).to.equal(seller.account.address.toLowerCase());
      
      const tokenURI = await myNFT.read.tokenURI([1n]);
      expect(tokenURI).to.equal(TOKEN_URI);
    });
    
    it("Should transfer NFT", async function () {
      await myNFT.write.transferFrom([seller.account.address, bidder1.account.address, 1n], {
        account: seller.account.address
      });
      
      const ownerOf = await myNFT.read.ownerOf([1n]);
      expect(ownerOf.toLowerCase()).to.equal(bidder1.account.address.toLowerCase());
    });
  });
  
  describe("Auction Market", function () {
    beforeEach(async function () {
      // 卖家批准 NFT 给拍卖合约
      await myNFT.write.approve([auctionMarket.address, 1n], {
        account: seller.account.address
      });
    });
    
    it("Should create auction", async function () {
      const duration = 24 * 60 * 60; // 24小时
      
      await auctionMarket.write.createAuction([
        myNFT.address,
        1n,
        "0x0000000000000000000000000000000000000000", // ETH
        BigInt(duration)
      ], {
        account: seller.account.address
      });
      
      const auction = await auctionMarket.read.getAuction([1n]);
      expect(auction.nftContract.toLowerCase()).to.equal(myNFT.address.toLowerCase());
      expect(auction.tokenId).to.equal(1n);
      expect(auction.seller.toLowerCase()).to.equal(seller.account.address.toLowerCase());
      expect(auction.bidToken).to.equal("0x0000000000000000000000000000000000000000");
      expect(auction.ended).to.be.false;
    });
    
    it("Should place bid with ETH", async function () {
      const duration = 24 * 60 * 60;
      
      await auctionMarket.write.createAuction([
        myNFT.address,
        1n,
        "0x0000000000000000000000000000000000000000",
        BigInt(duration)
      ], {
        account: seller.account.address
      });
      
      // 出价 1 ETH
      const bidAmount = ethers.parseEther("1");
      await auctionMarket.write.placeBid([1n, bidAmount], {
        account: bidder1.account.address,
        value: bidAmount
      });
      
      const auction = await auctionMarket.read.getAuction([1n]);
      expect(auction.highestBidder.toLowerCase()).to.equal(bidder1.account.address.toLowerCase());
      expect(auction.highestBid).to.equal(bidAmount);
    });
    
    it("Should end auction and transfer NFT", async function () {
      const duration = 24 * 60 * 60;
      
      await auctionMarket.write.createAuction([
        myNFT.address,
        1n,
        "0x0000000000000000000000000000000000000000",
        BigInt(duration)
      ], {
        account: seller.account.address
      });
      
      // 出价
      const bidAmount = ethers.parseEther("1");
      await auctionMarket.write.placeBid([1n, bidAmount], {
        account: bidder1.account.address,
        value: bidAmount
      });
      
      // 增加时间以结束拍卖
      await network.provider.send("evm_increaseTime", [duration + 1]);
      await network.provider.send("evm_mine");
      
      // 结束拍卖
      await auctionMarket.write.endAuction([1n], {
        account: owner.account.address
      });
      
      const auction = await auctionMarket.read.getAuction([1n]);
      expect(auction.ended).to.be.true;
      
      const ownerOf = await myNFT.read.ownerOf([1n]);
      expect(ownerOf.toLowerCase()).to.equal(bidder1.account.address.toLowerCase());
    });
  });
});