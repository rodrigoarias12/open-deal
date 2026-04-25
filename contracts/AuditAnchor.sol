// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AuditAnchor
/// @notice Anchors agent audit records on 0G Chain. Each anchor commits a
/// 0G Storage root hash plus the keccak256 of the policy bytes that
/// authorized the action. The chain is the index; 0G Storage holds the
/// full audit JSON. Reading any anchor lets a third party fetch the
/// original record off-chain and verify the policy snapshot bit-for-bit.
contract AuditAnchor {
    struct Anchor {
        bytes32 cidRoot;       // 0G Storage root hash of the audit JSON
        bytes32 policyHash;    // keccak256 of the policy bytes used at decision time
        uint64 timestamp;      // block timestamp at anchor
        address agent;         // wallet that signed the anchor
    }

    Anchor[] public anchors;

    event Anchored(
        uint256 indexed index,
        bytes32 indexed cidRoot,
        bytes32 indexed policyHash,
        address agent,
        uint64 timestamp
    );

    function anchor(bytes32 cidRoot, bytes32 policyHash) external returns (uint256) {
        uint256 idx = anchors.length;
        anchors.push(
            Anchor({
                cidRoot: cidRoot,
                policyHash: policyHash,
                timestamp: uint64(block.timestamp),
                agent: msg.sender
            })
        );
        emit Anchored(idx, cidRoot, policyHash, msg.sender, uint64(block.timestamp));
        return idx;
    }

    function count() external view returns (uint256) {
        return anchors.length;
    }

    function get(uint256 index) external view returns (Anchor memory) {
        return anchors[index];
    }
}
