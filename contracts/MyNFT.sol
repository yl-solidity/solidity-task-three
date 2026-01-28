// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MyNFT - 自定义 NFT 合约
/// @author YourName
/// @notice 支持铸造、批量铸造和销毁的 NFT 合约
contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 0;

    /// @notice NFT 铸造事件
    /// @param sender 铸造者地址
    /// @param to 接收者地址
    /// @param tokenId 铸造的 token ID
    /// @param timestamp 铸造时间戳
    event Minted(address indexed sender, address indexed to, uint256 indexed tokenId, uint256 timestamp);

    /// @notice 构造函数
    /// @param initialOwner 合约初始所有者
    constructor(address initialOwner) ERC721("MyNFT", "MyNFT") Ownable(initialOwner) {}

    /// @notice 安全铸造 NFT
    /// @param to NFT 接收者地址
    /// @param uri NFT 元数据 URI
    /// @return tokenId 铸造的 token ID
    function safeMint(address to, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit Minted(msg.sender, to, tokenId, block.timestamp);
        return tokenId;
    }

    /// @notice 批量铸造 NFT
    /// @param recipients 接收者地址数组
    /// @param uris 元数据 URI 数组
    /// @return tokenIds 铸造的 token ID 数组
    function batchMint(address[] memory recipients, string[] memory uris) public onlyOwner returns (uint256[] memory) {
        require(recipients.length == uris.length, "Length mismatch");

        uint256[] memory tokenIds = new uint256[](recipients.length);
        uint256 length = recipients.length;

        for (uint256 i = 0; i < length; ) {
            tokenIds[i] = safeMint(recipients[i], uris[i]);
            unchecked {
                ++i;
            }
        }
        return tokenIds;
    }

    /// @notice 获取当前 tokenId
    /// @return 当前 tokenId
    function getCurrentTokenId() public view returns (uint256) {
        return _nextTokenId > 0 ? _nextTokenId - 1 : 0;
    }

    /// @notice 获取 NFT 的元数据 URI
    /// @param tokenId token ID
    /// @return NFT 的元数据 URI
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /// @notice 检查是否支持接口
    /// @param interfaceId 接口 ID
    /// @return 是否支持该接口
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice 销毁 NFT
    /// @param tokenId 要销毁的 token ID
    function burn(uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(
            msg.sender == owner || getApproved(tokenId) == msg.sender || isApprovedForAll(owner, msg.sender),
            "Not owner nor approved"
        );
        _update(address(0), tokenId, address(0)); // v5.x 的销毁方式
    }

    // OpenZeppelin v5.x 中不需要重写 _burn 函数
    // ERC721URIStorage 会自动处理 URI 清理
}
