// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 0; // 从0或者1开始

    event Minted(address sender, address to, uint256 tokenId, uint256 timestamp);

    // 构造函数需要传递 initialOwner
    constructor(address initialOwner) ERC721("MyNFT","MyNFT") Ownable(initialOwner){
       
    }

    /**
     * 安全铸造
     */
    function safeMint(address to, string memory uri) public onlyOwner returns(uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        _safeMint(to, tokenId);
        _safeTokenURI(tokenId, uri);

        emit Minted(msg.sender, to, tokenId, timestamp);
        return tokenId;
    }

    /**
     * 批量铸造
     */
     function batchMint(address[] memory reciptients, string[] memory uris) public onlyOwner returns(uint256[] memory) {
        require(reciptients.length === uris.length, "Recipients and URIs length mismatch");

        uint256[] tokenIds = new uint256[](reciptients.length);
        unit256 length = reciptients.length;
        for(uint256 i=0; i<length; i++){
            tokenIds[i] = safeMint(reciptionts[i], uris[i]);
        }
        return tokenIds;
     }
    /**
     * 获取当前 tokenId
     */
     getCurrentTokenId() public view returns(uint256){
        return _nextTokenId - 1;
     }

    /**
     * 重写获取 NFT 的元数据链接函数，因为ERC721, ERC721URIStorage都有tokenURI函数
     */
     function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns(string memory) {
        return super.tokenURI(tokenId);
     }

    /**
     * 重写接口检测函数，因为ERC721, ERC721URIStorage都有supportsInterface函数
     */
     function supportsInterface(bytes interfaceId) public view override(ERC721, ERC721URIStorage) returns(bool) {
        return super.supportsInterface(interfaceId);
     }

     /**
      * 燃烧代币
      */
      function burn(uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "RC721: caller is not owner nor approved");
        _burn(tokenId);
      }
    /**
     * 重写 _burn 函数
     */
      function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
      }

}