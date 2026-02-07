// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuctionMarket.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AuctionMarketV2 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // 动态手续费结构

    struct DynamicFee {
        uint256 minAmount; // 最小金额（USD）
        uint256 maxAmount; // 最大金额（USD）
        uint256 feeRate; // 手续费率
    }

    DynamicFee[] public dynamicFees;
    uint256 public defaultFeeRate;

    /// @custom:oz-upgrates-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * 初始化
     */
    function initialize() initializer public {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        defaultFeeRate = 250; // 2.5%

        // 初始化动态手续费等级
        dynamicFees.push(DynamicFee({
            minAmount: 0,
            maxAmount: 1000 * 1e18; // $1000
            feeRate: 300 // 3%
        }))
        dynamicFees.push(DynamicFee({
            minAmount: 1000 * 1e18,
            maxAmount: 10000 * 1e18; // $10000
            feeRate: 250 // 2.5%
        }))
         dynamicFees.push(DynamicFee({
            minAmount: 10000 * 1e18,
            maxAmount: 100000 * 1e18; // $100000
            feeRate: 200 // 2%
        }))
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
        }))
      }

      /**
       * 更新动态手续费等级
       */

    function updateDynamicFeeLevel(uint256 index, uint256 minAmount, uint256 maxAmount, uint256 feeRate) onlyOwner {
         dynamicFees[index] = DynamicFee({
            minAmount: minAmount,
            maxAmount: maxAmount,
            feeRate: feeRate
        })
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

}