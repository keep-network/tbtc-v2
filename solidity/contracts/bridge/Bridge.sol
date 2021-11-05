// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../bank/Bank.sol";

contract Bridge {
    struct UTXO {
        uint256 digest;
        uint256 amount;
        address owner;
        address vault; // optional
    }

    Bank public bank;
    mapping(uint256 => UTXO) public unswept;

    event Revealed(
        address indexed owner,
        uint256 utxoDigest,
        uint256 amount,
        address vault
    );

    event Swept(address indexed owner, uint256 utxoDigest, uint256 amount);

    event Redemeed(
        address indexed owner,
        uint256 amount,
        bytes8 outputValueBytes,
        bytes redeemerOutputScript
    );

    constructor(Bank _bank) {
        require(
            address(_bank) != address(0),
            "Bank can not be the zero address"
        );

        bank = _bank;
    }

    function reveal(UTXO calldata utxo) external {
        unswept[utxo.digest] = utxo;
    }

    function sweep(uint256 utxoDigest, uint256 amount) external {
        UTXO memory utxo = unswept[utxoDigest];
        bank.increaseBalance(utxo.owner, amount);

        emit Swept(utxo.owner, utxoDigest, amount);

        delete unswept[utxoDigest];
    }

    function redeem(
        uint256 amount,
        bytes8 outputValueBytes,
        bytes memory redeemerOutputScript
    ) external {
        bank.decreaseBalance(msg.sender, amount);
        emit Redemeed(
            msg.sender,
            amount,
            outputValueBytes,
            redeemerOutputScript
        );
    }
}
