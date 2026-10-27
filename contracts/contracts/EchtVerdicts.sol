// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @title EchtVerdicts
/// @notice Stores one payment verdict per run. Accepts reports only from the CRE forwarder
///         (PRD §9.4). Pattern follows the CRE receiver flow: the forwarder calls
///         `onReport(metadata, report)` and the report is ABI-decoded into a Verdict.
contract EchtVerdicts {
    struct Verdict {
        bytes32 runId;
        bytes32 evidenceHash;
        bytes32 tokenSymbolHash; // keccak256 of the converged symbol, e.g. "ETH"
        uint64 pinnedToBlock;
        uint8 paymentVerdict; // 0 ELIGIBLE, 1 REVIEW, 2 BLOCK
        uint8 convergingCount;
        uint8 linkedCount;
        bytes32 policyVersion; // keccak256("echt-policy@2")
        bytes32[] personaIdHashes;
    }

    /// @notice The only address allowed to deliver reports (set at deploy time).
    address public immutable forwarder;

    mapping(bytes32 => Verdict) private _verdicts;
    mapping(bytes32 => bool) private _recorded;

    event VerdictRecorded(bytes32 indexed runId, bytes32 evidenceHash, uint8 paymentVerdict);

    error NotForwarder(address sender);
    error AlreadyRecorded(bytes32 runId);
    error UnknownRun(bytes32 runId);
    error InvalidPaymentVerdict(uint8 paymentVerdict);

    constructor(address forwarderAddress) {
        require(forwarderAddress != address(0), "forwarder is zero");
        forwarder = forwarderAddress;
    }

    /// @notice Entry point for the CRE forwarder. `metadata` is unused: local simulation does not
    ///         provide workflow metadata, so the forwarder address is the only trust anchor.
    function onReport(bytes calldata metadata, bytes calldata report) external {
        metadata;
        if (msg.sender != forwarder) revert NotForwarder(msg.sender);

        Verdict memory v = abi.decode(report, (Verdict));
        if (_recorded[v.runId]) revert AlreadyRecorded(v.runId);
        if (v.paymentVerdict > 2) revert InvalidPaymentVerdict(v.paymentVerdict);

        _recorded[v.runId] = true;
        _verdicts[v.runId] = v;
        emit VerdictRecorded(v.runId, v.evidenceHash, v.paymentVerdict);
    }

    function getVerdict(bytes32 runId) external view returns (Verdict memory) {
        if (!_recorded[runId]) revert UnknownRun(runId);
        return _verdicts[runId];
    }
}
