// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CampusVehicleLog is AccessControl {
    bytes32 public constant GUARD_ROLE = keccak256("GUARD_ROLE");
    enum Action { ENTRY, EXIT }

    struct Vehicle { bool registered; bool inside; }
    struct LogEntry {
        bytes32 plateHash;
        Action action;
        uint8 gateId;
        uint256 timestamp;
        address guard;
    }

    mapping(bytes32 => Vehicle) public vehicles;
    LogEntry[] private logs;

    event VehicleRegistered(bytes32 indexed plateHash);
    event VehicleLogged(uint256 indexed logId, bytes32 indexed plateHash, Action action, uint8 gateId, uint256 timestamp);

    constructor() { _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); }

    function registerVehicle(bytes32 plateHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!vehicles[plateHash].registered, "Already registered");
        vehicles[plateHash].registered = true;
        emit VehicleRegistered(plateHash);
    }

    function addGuard(address guard) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GUARD_ROLE, guard);
    }

    function logEntry(bytes32 plateHash, uint8 gateId) external onlyRole(GUARD_ROLE) {
        require(vehicles[plateHash].registered, "Vehicle not registered");
        require(!vehicles[plateHash].inside, "Already inside campus");
        vehicles[plateHash].inside = true;
        _addLog(plateHash, Action.ENTRY, gateId);
    }

    function logExit(bytes32 plateHash, uint8 gateId) external onlyRole(GUARD_ROLE) {
        require(vehicles[plateHash].registered, "Vehicle not registered");
        require(vehicles[plateHash].inside, "Vehicle is not inside");
        vehicles[plateHash].inside = false;
        _addLog(plateHash, Action.EXIT, gateId);
    }

    function _addLog(bytes32 plateHash, Action action, uint8 gateId) private {
        logs.push(LogEntry(plateHash, action, gateId, block.timestamp, msg.sender));
        emit VehicleLogged(logs.length - 1, plateHash, action, gateId, block.timestamp);
    }

    function getLogCount() external view returns (uint256) { return logs.length; }
    function getLog(uint256 id) external view returns (LogEntry memory) { return logs[id]; }
}
