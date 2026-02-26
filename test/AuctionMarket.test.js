import { describe, it, beforeEach } from "node:test";
import { expect } from "chai";
import hre from "hardhat";

describe("AuctionMarket", () => {
  let myNFT;
  let auctionMarket;
  let owner, seller, bidder1, bidder2;
  
  const TOKEN_URI = "https://example.com/token/1";
  
  beforeEach(async () => {
    const { viem } = await hre.network.connect({ network: "hardhat" });
    const walletClients = await viem.getWalletClients();
    [owner, seller, bidder1, bidder2] = walletClients;
    
    // 部署合约
    myNFT = await viem.deployContract("MyNFT", [owner.account.address], {
      account: owner.account.address
    });
    
    auctionMarket = await viem.deployContract("AuctionMarket", [owner.account.address], {
      account: owner.account.address
    });
    
    // 铸造 NFT
    await myNFT.write.safeMint([seller.account.address, TOKEN_URI]);
  });
  
  it("Should mint NFT successfully", async () => {
    const tokenId = await myNFT.read.getCurrentTokenId();
    expect(tokenId).to.equal(1n);
    
    const ownerOf = await myNFT.read.ownerOf([1n]);
    expect(ownerOf.toLowerCase()).to.equal(seller.account.address.toLowerCase());
    
    const tokenURI = await myNFT.read.tokenURI([1n]);
    expect(tokenURI).to.equal(TOKEN_URI);
  });
  
  it("Should transfer NFT", async () => {
    await myNFT.write.transferFrom([seller.account.address, bidder1.account.address, 1n], {
      account: seller.account.address
    });
    
    const ownerOf = await myNFT.read.ownerOf([1n]);
    expect(ownerOf.toLowerCase()).to.equal(bidder1.account.address.toLowerCase());
  });
});