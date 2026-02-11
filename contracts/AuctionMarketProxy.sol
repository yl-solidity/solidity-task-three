// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract AuctionMarketProxy is TransparentUpgradeableProxy {
    constructor( address _logic, address initalOwner, bytes memory _data) TransparentUpgradeableProxy(_logic, initalOwner, _data){}
}