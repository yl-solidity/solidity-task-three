// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPriceFeed {
    int256 private _price;

    constructor(int256 price) {
        _price = price;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (0, _price, block.timestamp, block.timestamp, 0);
    }

    function setPrice(int256 newPrice) external {
        _price = newPrice;
    }
}