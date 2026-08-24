// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AcademicCertificate is ERC721, AccessControl {

    bytes32 public constant ISSUER_ROLE =
        keccak256("ISSUER_ROLE");

    uint256 private _nextTokenId;

    struct AcademicCredential {
        string ipfsCID;
        string credentialType;
        uint256 issuedAt;
        bool revoked;
    }

    mapping(uint256 => AcademicCredential) private credentials;

    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed student,
        string ipfsCID,
        string credentialType
    );

    event CredentialRevoked(
        uint256 indexed tokenId,
        uint256 revokedAt
    );

    constructor()
        ERC721("Academic Certificate", "ACERT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);

        _nextTokenId = 1;
    }

    function issueCredential(
        address student,
        string calldata ipfsCID,
        string calldata credentialType
    )
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256)
    {
        require(
            student != address(0),
            "Invalid student address"
        );

        require(
            bytes(ipfsCID).length > 0,
            "IPFS CID required"
        );

        require(
            bytes(credentialType).length > 0,
            "Credential type required"
        );

        uint256 tokenId = _nextTokenId;

        _nextTokenId++;

        _safeMint(student, tokenId);

        credentials[tokenId] = AcademicCredential({
            ipfsCID: ipfsCID,
            credentialType: credentialType,
            issuedAt: block.timestamp,
            revoked: false
        });

        emit CredentialIssued(
            tokenId,
            student,
            ipfsCID,
            credentialType
        );

        return tokenId;
    }

    function getCredential(
        uint256 tokenId
    )
        external
        view
        returns (
            string memory ipfsCID,
            string memory credentialType,
            uint256 issuedAt,
            bool revoked
        )
    {
        require(
            _ownerOf(tokenId) != address(0),
            "Credential does not exist"
        );

        AcademicCredential memory credential =
            credentials[tokenId];

        return (
            credential.ipfsCID,
            credential.credentialType,
            credential.issuedAt,
            credential.revoked
        );
    }

    function isValid(
        uint256 tokenId
    )
        external
        view
        returns (bool)
    {
        if (_ownerOf(tokenId) == address(0)) {
            return false;
        }

        return !credentials[tokenId].revoked;
    }

    function revokeCredential(
        uint256 tokenId
    )
        external
        onlyRole(ISSUER_ROLE)
    {
        require(
            _ownerOf(tokenId) != address(0),
            "Credential does not exist"
        );

        require(
            !credentials[tokenId].revoked,
            "Credential already revoked"
        );

        credentials[tokenId].revoked = true;

        emit CredentialRevoked(
            tokenId,
            block.timestamp
        );
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override
        returns (string memory)
    {
        require(
            _ownerOf(tokenId) != address(0),
            "Credential does not exist"
        );

        return string.concat(
            "ipfs://",
            credentials[tokenId].ipfsCID
        );
    }

    /*
     * ERC-721 is transferable by default.
     * Academic credentials must not be transferable.
     *
     * In OpenZeppelin 5.x, transfer behavior is controlled
     * by overriding _update().
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // Allow mint:
        // from == address(0)
        //
        // Block transfers:
        // from != 0 && to != 0
        if (
            from != address(0) &&
            to != address(0)
        ) {
            revert(
                "Academic credential is non-transferable"
            );
        }

        return super._update(
            to,
            tokenId,
            auth
        );
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721,
            AccessControl
        )
        returns (bool)
    {
        return super.supportsInterface(
            interfaceId
        );
    }
}