// SPDX-License-Identifier: MIT

// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
// ██████████████     ▐████▌     ██████████████
// ██████████████     ▐████▌     ██████████████
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌
//               ▐████▌    ▐████▌

pragma solidity ^0.8.9;

import "../maintainer/MaintainerProxy.sol";

/// @title Maintainer Proxy Stub
contract MaintainerProxyStub is MaintainerProxy {
    constructor(Bridge _bridge, ReimbursementPool _reimbursementPool)
        MaintainerProxy(_bridge, _reimbursementPool)
    {}

    function getAllMaintainers() external view returns (address[] memory) {
        return maintainers;
    }
}
