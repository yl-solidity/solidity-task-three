// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // 注意：路径变
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title AuctionMarket - NFT 拍卖市场
/// @author YourName
/// @notice 支持 NFT 拍卖的交易市场
contract AuctionMarket is ReentrancyGuard, Ownable {
    uint256 private _auctionIdCounter = 1;

    // 支持的ERC20代币结构
    struct SupportedToken {
        address tokenAddress;
        address priceFeed; // Chainlink 价格预言机地址
        bool isActive;
    }

    // 拍卖结构
    struct Auction {
        uint256 auctionId;
        address nftContract;
        address seller;
        uint256 tokenId;
        address payable highestBidder;
        address bidToken; // 出价代币地址， address(0)表示ETH
        uint256 highestBid;
        uint256 startTime;
        uint256 endTime;
        bool ended;
    }

    // 手续费率（百分比， 100 = 1%）
    uint256 public feeRate = 250; // 2.5%
    address payable public feeRecipient;

    // 映射
    mapping(uint256 => Auction) public auctions;
    mapping(address => mapping(uint256 => uint256)) public nftToAuctionId; // NFT合约地址 + tokenId => 拍卖ID
    mapping(address => SupportedToken) supportedTokens;

    // 事件

    event AuctionCreated(uint256 indexed auctionId, address indexed nftContract, uint256 indexed tokenId, address seller, address bidToken, uint256 startTime, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, address bidToken, uint256 amount, uint256 usdAmount);
    event AuctionsEnded(uint256 indexed auctionId, address indexed winner, address bidToken, uint256 amount, uint256 usdAmount);

    event TokenSupported(address indexed tokenAddress, address priceFeed);
    event TokenRemoved(address indexed tokenAddress);
    event FeeRateUpdated(uint256 oldFeeRate, uint256 newFeeRate);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    constructor(address initialOwner) Ownable(initialOwner){
        feeRecipient = payable(initialOwner);

        // 支持ETH（使用 Sepolia 测试网的ETH/USD 预言机）

        supportedTokens[address(0)] = SupportedToken({
            tokenAddress: address(0),
            priceFeed: 0x694AA1769357215DE4FAC081bf1f309aDC325306, // Sepolia ETH/USD 预言机
            isActive: true
        });
    }

      // ========== 代币管理函数 ==========

    /**
    * @dev 添加支持的 ERC20 代币
    * @param tokenAddress ERC20 代币地址ss
    * @param priceFeed Chainlink 价格预言机地址
    */
    function addSupportedToken(address tokenAddress, address priceFeed) external onlyOwner {

      require(tokenAddress != address(0), "Invalid token address");
      require(priceFeed != address(0), "Invalid price feed");
      require(!supportedTokens[tokenAddress].isActive, "Token already supported");

        supportedTokens[tokenAddress] = SupportedToken({
          tokenAddress: tokenAddress,
          priceFeed: priceFeed, 
          isActive: true
      });

      emit TokenSupported(tokenAddress, priceFeed);
    }

    /**
      * @dev 移除支持的代币
      * @param tokenAddress ERC20 代币地址
      */
    function removeSupportedToken(address tokenAddress) external onlyOwner {
      require(supportedTokens[tokenAddress].isActive, "Token not supported");
      supportedTokens[tokenAddress].isActive = false;
      emit TokenRemoved(tokenAddress);
    }

    /**
      * @dev 创建拍卖
      * @param nftContract nft合约地址
      * @param tokenId NFT代币ID
      * @param bidToken 出价代币地址
      * @param duration 拍卖持续时间（秒
      */
      function createAuction(address nftContract, uint256 tokenId, address bidToken, uint256 duration) public {
      require(duration > 0 && duration <= 30 days, "Invalid duration");
      require(supportedTokens[bidToken].isActive, "Bid token not supported");

      IERC721 nft = IERC721(nftContract);
      require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
      require(nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)), "NFT not approved");

      // 转移NFT到合约
      nft.transferFrom(msg.sender, address(this), tokenId);

      _auctionIdCounter++;
      uint256 auctionId = _auctionIdCounter;
      uint256 startTime =  block.timestamp;
      uint256 endTime = startTime + duration;

      Auction storage auction = auctions[auctionId];
      auction.auctionId = auctionId;
      auction.nftContract = nftContract;
      auction.tokenId = tokenId;
      auction.seller = payable(msg.sender);
      auction.bidToken = bidToken;
      auction.startTime = startTime;
      auction.endTime = endTime;
      auction.ended = false;

      nftToAuctionId[nftContract][tokenId] = auctionId;

      emit AuctionCreated(auctionId, nftContract, tokenId, payable(msg.sender), bidToken, startTime, endTime);
      }

    /**
    * @dev 出价 
    */
    function placeBid(uint256 auctionId, uint256 amount) external payable nonReentrant {
      Auction storage auction = auctions[auctionId];
      require(auction.auctionId !=0, "Auction not found");
      require(!auction.ended, "Auction ended");
      require(block.timestamp < auction.endTime, "Auction expired");
      require(block.timestamp >= auction.startTime, "Auction ont started");

      // 检查出价是否高于当前最高出价
      uint256 minBid = auction.highestBid == 0 ? 0 : auction.highestBid + (auction.highestBid * 10/100); // 至少高出10%
      if(auction.bidToken == address(0)){
        // ETH出价
        require(msg.value >= minBid, "Bid too low");
        require(msg.value >= amount, "Insufficient ETH");

        // 退回前一个最高出价者的ETH
        if(auction.highestBidder != address(0)) {
          (bool success,) = auction.highestBidder.call{value: auction.highestBid}("");
          require(success, "ETH refund failed");
        }
        auction.highestBid = msg.value;
      }
      auction.highestBidder = payable(msg.sender);

      // 计算USD 价值
      uint256 usdAmount = getBidValueInUSD(auction.bidToken, auction.highestBid);

      emit BidPlaced(auctionId, msg.sender, auction.bidToken, amount, usdAmount);
    }

    /**
    * @dev 获取出价的USD价值
    */
    function getBidValueInUSD(address token, uint256 amount) public view returns(uint256) {
      SupportedToken storage supportedToken = supportedTokens[token];
      require(supportedToken.isActive, "Token not supported");

      AggregatorV3Interface priceFeed = AggregatorV3Interface(supportedToken.priceFeed);
      (,int256 price,,,) = priceFeed.latestRoundData();

      // price 通常有8位小数， amount 有18位小数
      // 计算： amount * price/1e8

      return (amount * uint256(price))/1e8;
    }

  /**
    * @dev 结束拍卖
    */
    function endAuction(uint256 auctionId) external nonReentrant {
    Auction storage auction = auctions[auctionId];
    require(auction.auctionId !=0, "Auction not fount");
    require(!auction.ended, "Auction already ended");
    require(block.timestamp >= auction.endTime || msg.sender == auction.seller, "Auction not ended");

    auction.ended = true;
    address bidToken = auction.bidToken;

    IERC721 nft = IERC721(auction.nftContract);
    
    if(auction.highestBidder != address(0)){
      // 有出价者
      uint256 fee = (auction.highestBid * feeRate) / 10000;
      uint256 sellerAmount = auction.highestBid - fee;

      // 转移资金
      if(bidToken == address(0)){
        //ETH
        (bool feSuccess,) = feeRecipient.call{value: fee}("");
        require(feSuccess, "Seller payment failed");
      } else {
        // ERC20
        IERC20 token = IERC20(bidToken);
        require(token.transfer(feeRecipient, fee), "Fee transfer failed");
        require(token.transfer(auction.seller, sellerAmount), "Seller payment failed");
      }

      // 转移Nft
      nft.safeTransferFrom(address(this), auction.highestBidder, auction.tokenId);
      // 计算USD 价值
      uint256 usdAmount = getBidValueInUSD(bidToken, auction.highestBid);

      emit BidPlaced(auctionId, msg.sender, bidToken, sellerAmount, usdAmount);
    } else {
      // 没有出价者，退回NFT
      nft.safeTransferFrom(address(this), auction.seller, auction.tokenId);

      emit AuctionsEnded(auctionId, address(0), bidToken, 0, 0);
    }

    // 清理隐射
    delete nftToAuctionId[auction.nftContract][auction.tokenId];
    }

    /**
    * @dev 获取拍卖信息
    */
    function getAuction(uint256 auctionId) external view returns(Auction memory){
      return auctions[auctionId];
    }

  /**
    * @dev 获取活跃拍卖数量
    */
    function getActiveAuctionsCount() external view returns(uint256) {
    uint256 count = 0;
    for(uint256 i=1; i<= _auctionIdCounter; i++){
      if(!auctions[i].ended && block.timestamp < auctions[i].endTime){
        count++;
      }
    }
    return count;
    }

    /**
    * @dev 设置手续费率 
    */
    function setFeeRate(uint256 newFeeRate) external onlyOwner {
      require(newFeeRate <= 1000, "Fee rate too hige"); // 最大10%
      feeRate = newFeeRate;
    }

  /**
    * 设置手续费接收者
    */
    function setFeeRecipient(address payable newRecipient) external onlyOwner{
    require(newRecipient != address(0), "Invalid recipient");
    feeRecipient = newRecipient;
    }

    /**
    * @dev 紧急取消拍卖（仅所有者）
    */
    function emergencyCancelAuction(uint256 auctionId) external onlyOwner {
      Auction storage auction = auctions[auctionId];
      require(!auction.ended, "Auction ended");

      auction.ended = true;

      // IERC721 nft = IERC721(auction.nftContract);

      // 退回NFT给卖家
      if(auction.highestBidder != address(0)){
        if(auction.bidToken == address(0)){
          (bool success,) = auction.highestBidder.call{value: auction.highestBid}("");
          require(success,"ETH refund failed");
        } else {
          IERC20 token = IERC20(auction.bidToken);
          require(token.transfer(auction.highestBidder, auction.highestBid), "Token refund failed");
        }
      }
      emit AuctionsEnded(auctionId, address(0), auction.bidToken, 0, 0);
    }

    // 接收ETH
    receive() external payable{}
}
