// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AcademicIdentity is Ownable {

    string public identityId;

    uint256[] private credentialTokenIds;

    event CredentialLinked(
        uint256 indexed tokenId
    );

    event CredentialUnlinked(
        uint256 indexed tokenId
    );

    constructor(
        string memory _identityId,
        address initialOwner
    )
        Ownable(initialOwner)
    {
        identityId = _identityId;
    }

    function linkCredential(
        uint256 tokenId
    )
        external
        onlyOwner
    {
        credentialTokenIds.push(tokenId);

        emit CredentialLinked(tokenId);
    }

    function getCredentials()
        external
        view
        returns (uint256[] memory)
    {
        return credentialTokenIds;
    }

    function credentialCount()
        external
        view
        returns (uint256)
    {
        return credentialTokenIds.length;
    }
}