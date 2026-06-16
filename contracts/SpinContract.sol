// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SpinContract — AI Manager FM Gacha
 * Deploy to Sepolia testnet.
 *
 * Workflow:
 *   1. User calls spin(tier) with correct ETH value
 *   2. Contract emits SpinRequested event with unique requestId
 *   3. Frontend captures txHash, sends to /api/gacha/verify-spin
 *   4. Backend assigns player, returns result
 *
 * Owner can withdraw ETH and update prices.
 */
contract SpinContract {
    address public owner;

    uint256 public standardPrice = 0.001 ether;  // testnet: ~$2-3
    uint256 public premiumPrice  = 0.005 ether;  // testnet: ~$10-15

    enum Tier { STANDARD, PREMIUM }

    event SpinRequested(
        address indexed player,
        Tier tier,
        uint256 requestId,
        uint256 timestamp
    );

    event PriceUpdated(Tier tier, uint256 newPrice);

    uint256 private _nextRequestId;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev User calls this function with ETH to spin the gacha.
     * @param tier 0 = STANDARD (star 1-3), 1 = PREMIUM (star 3-5)
     */
    function spin(Tier tier) external payable returns (uint256 requestId) {
        if (tier == Tier.STANDARD) {
            require(msg.value >= standardPrice, "Insufficient ETH for STANDARD spin");
        } else {
            require(msg.value >= premiumPrice, "Insufficient ETH for PREMIUM spin");
        }

        requestId = _nextRequestId++;

        emit SpinRequested(msg.sender, tier, requestId, block.timestamp);

        // Refund excess ETH
        uint256 price = tier == Tier.STANDARD ? standardPrice : premiumPrice;
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }

        return requestId;
    }

    function setStandardPrice(uint256 price) external onlyOwner {
        standardPrice = price;
        emit PriceUpdated(Tier.STANDARD, price);
    }

    function setPremiumPrice(uint256 price) external onlyOwner {
        premiumPrice = price;
        emit PriceUpdated(Tier.PREMIUM, price);
    }

    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
