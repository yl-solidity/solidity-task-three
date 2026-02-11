// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuctionMarket.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract AuctionMarketV2 is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    // 动态手续费结构

    struct DynamicFee {
        uint256 minAmount; // 最小金额（USD）
        uint256 maxAmount; // 最大金额（USD）
        uint256 feeRate; // 手续费率
    }

    DynamicFee[] public dynamicFees;
    uint256 public defaultFeeRate;
    uint256 public minBidIncreasePercentage; // 最小出价增加百分比
    uint256 public auctionExtensionTime; // 拍卖结束前出价自动延长时间

    // 事件
    event DynamicFeeAdded(uint256 minAmount, uint256 maxAmount, uint256 feeRate);
    event DynamicFeeUpdated(uint256 index, uint256 minAmount, uint256 maxAmount, uint256 feeRate);
    event MinBidIncreasePercentageUpdated(uint256 newPercentage);
    event AuctionExtensionTimeUpdated(uint256 newExtensionTime);

    /// @custom:oz-upgrates-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * 初始化
     */
    function initialize() initializer public {
        __Ownable_init((msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        defaultFeeRate = 250; // 2.5%
        minBidIncreasePercentage = 10; // 10%
        auctionExtensionTime = 15 minutes;

        // 初始化动态手续费等级
        dynamicFees.push(DynamicFee({
            minAmount: 0,
            maxAmount: 1000 * 1e18, // $1000
            feeRate: 300 // 3%
        }));
        dynamicFees.push(DynamicFee({
            minAmount: 1000 * 1e18,
            maxAmount: 10000 * 1e18, // $10000
            feeRate: 250 // 2.5%
        }));
         dynamicFees.push(DynamicFee({
            minAmount: 10000 * 1e18,
            maxAmount: 100000 * 1e18, // $100000
            feeRate: 200 // 2%
        }));
        dynamicFees.push(DynamicFee({
            minAmount: 100000 * 1e18,
            maxAmount: type(uint256).max,
            feeRate: 150 // 1.5%
        }));
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * 根据金额获取动态手续费
     */
     function getDynamicFeeRate(uint256 usdAmount) public view returns(uint256) {
        for(uint256 i=0; i< dynamicFees.length; i++){
            if(usdAmount >= dynamicFees[i].minAmount && usdAmount < dynamicFees[i].maxAmount){
                return dynamicFees[i].feeRate;
            }
        }
        return defaultFeeRate;
     }

     /**
      * 添加动态手续费等级
      */
      function addDynamicFeeLevel(uint256 minAmount, uint256 maxAmount, uint256 feeRate) external onlyOwner {
        dynamicFees.push(DynamicFee({
            minAmount: minAmount,
            maxAmount: maxAmount,
            feeRate: feeRate
        }));
        emit DynamicFeeAdded(minAmount, maxAmount, feeRate);
      }

      /**
       * 更新动态手续费等级
       */

    function updateDynamicFeeLevel(uint256 index, uint256 minAmount, uint256 maxAmount, uint256 feeRate) public onlyOwner {
         dynamicFees[index] = DynamicFee({
            minAmount: minAmount,
            maxAmount: maxAmount,
            feeRate: feeRate
        });
        emit DynamicFeeUpdated(index, minAmount, maxAmount, feeRate);
    }

    /**
     * 设置默认手续费率
     */
     function setDefaultFeeRate(uint256 newFeeRate) external onlyOwner{
        require(newFeeRate <= 1000, "Fee rate too hige");

        defaultFeeRate = newFeeRate;
     }

     /**
      * 获取动态手续等级数量
      */

      function getDynamicFeeLevelsCount() external view returns(uint256) {
        return dynamicFees.length;
      }

      // ========== 拍卖增强功能 ==========

      /**
       * @dev 设置最小出价增加百分比
       * @param percentage 百分比 (100=1%)
       */
       function setMinBidIncreasePercentage(uint256 percentage) external onlyOwner {
        require(percentage <= 50, "Percentage too hige"); //最大50%
        minBidIncreasePercentage = percentage;
        emit MinBidIncreasePercentageUpdated(percentage);
       }

       /**
        * @dev 设置拍卖延长时间
        * @param time 延长时间(秒)
        */
        function setAuctionExtensionTime(uint256 time) external onlyOwner{
            require(time <= 1 hours, "Extension time too long");
            auctionExtensionTime = time;
            emit AuctionExtensionTimeUpdated(time);
        }

        /**
         * @dev 获取最小出价增加百分比
         * @return 百分比
         */
         function getMinBidIncreasePercentage() external view returns (uint256) {
            return minBidIncreasePercentage;
         }

         /**
          * @dev 获取拍卖延长时间
          * @return 延长时间
          */
          function getAuctionExtensionTime() external view returns(uint256) {
            return auctionExtensionTime;
          }

            // ========== 工具函数 ==========

        /**
         * @dev 计算最小出价金额
         * @param currentBid 当前最高出价
         * @return 最小出价金额
         */
         function calculateMinBid(uint256 currentBid) public view returns(uint256) {
            if(currentBid ==0 ){
                return 0;
            }
            return currentBid + (currentBid * minBidIncreasePercentage / 100);
         }

         /**
          * @dev 批量获取动态手续费信息
          * @return 动态手续费信息
          */
          function getAllDynamicFees() external view returns(DynamicFee[] memory) {
            return dynamicFees;
          }

          /**
           * @dev 获取合约版本
           * @return 版本字符串
           */
           function version() external pure returns( string memory){
            return "2.0.0";
           }

}