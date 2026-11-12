// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MediQueueAnchor
/// @notice Anchors hashes of MediQueue's local audit blocks on Ethereum Sepolia.
/// @dev No patient names, phone numbers, prescriptions or other personal data are stored here.
contract MediQueueAnchor {
    address public immutable owner;
    uint256 public totalAnchors;

    mapping(bytes32 => bool) public anchored;

    event BlockAnchored(
        bytes32 indexed blockHash,
        uint256 indexed localIndex,
        string eventType,
        address indexed anchoredBy,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the deploying admin wallet can anchor");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function anchorBatch(
        bytes32[] calldata blockHashes,
        uint256[] calldata localIndexes,
        string[] calldata eventTypes
    ) external onlyOwner {
        uint256 length = blockHashes.length;
        require(length > 0, "No blocks supplied");
        require(
            length == localIndexes.length && length == eventTypes.length,
            "Array length mismatch"
        );
        require(length <= 10, "Maximum 10 blocks per transaction");

        for (uint256 i = 0; i < length; i++) {
            bytes32 blockHash = blockHashes[i];
            require(blockHash != bytes32(0), "Empty block hash");
            require(!anchored[blockHash], "Block already anchored");

            anchored[blockHash] = true;
            totalAnchors += 1;

            emit BlockAnchored(
                blockHash,
                localIndexes[i],
                eventTypes[i],
                msg.sender,
                block.timestamp
            );
        }
    }
}
