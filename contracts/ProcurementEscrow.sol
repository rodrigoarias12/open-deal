// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProcurementEscrow
/// @notice Minimal procurement escrow for autonomous B2B agent trade.
/// Buyer creates an order locking native ETH; seller confirms shipment;
/// buyer (or anyone after the dispute window) releases funds. If the
/// seller does not confirm by the deadline, anyone may refund the buyer.
///
/// In production this would be USDC (or any stablecoin) and would carry
/// signed shipment proofs from a logistics oracle. For the hackathon
/// demo we keep the surface to the four state transitions every party
/// needs and the events a frontend would index.
contract ProcurementEscrow {
    enum Status {
        None,
        Pending,
        Shipped,
        Released,
        Refunded,
        Disputed
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        bytes32 skuHash;       // keccak256 of the agreed SKU+qty payload
        uint64 deadline;       // seller must confirm shipment before this
        uint64 disputeWindow;  // after Shipped, buyer has this many seconds to dispute before release becomes permissionless
        bytes32 trackingHash;  // set on confirmShipment
        Status status;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        bytes32 skuHash,
        uint64 deadline,
        uint64 disputeWindow
    );
    event ShipmentConfirmed(uint256 indexed orderId, bytes32 trackingHash, uint64 at);
    event Released(uint256 indexed orderId, address to, uint256 amount);
    event Refunded(uint256 indexed orderId, address to, uint256 amount);
    event Disputed(uint256 indexed orderId, address by, string reason);

    error NotBuyer();
    error NotSeller();
    error WrongStatus();
    error DeadlineNotReached();
    error DisputeWindowOpen();
    error TransferFailed();

    function createOrder(
        address seller,
        bytes32 skuHash,
        uint64 deliveryDeadline,
        uint64 disputeWindow
    ) external payable returns (uint256 orderId) {
        require(msg.value > 0, "amount=0");
        require(seller != address(0), "seller=0");
        require(deliveryDeadline > block.timestamp, "deadline past");

        orderId = ++nextOrderId;
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            skuHash: skuHash,
            deadline: deliveryDeadline,
            disputeWindow: disputeWindow,
            trackingHash: bytes32(0),
            status: Status.Pending
        });

        emit OrderCreated(orderId, msg.sender, seller, msg.value, skuHash, deliveryDeadline, disputeWindow);
    }

    function confirmShipment(uint256 orderId, bytes32 trackingHash) external {
        Order storage o = orders[orderId];
        if (msg.sender != o.seller) revert NotSeller();
        if (o.status != Status.Pending) revert WrongStatus();
        o.trackingHash = trackingHash;
        o.status = Status.Shipped;
        // restart the dispute clock from "now" by repurposing deadline
        o.deadline = uint64(block.timestamp) + o.disputeWindow;
        emit ShipmentConfirmed(orderId, trackingHash, uint64(block.timestamp));
    }

    /// Buyer can release immediately. Anyone can release after dispute window.
    function release(uint256 orderId) external {
        Order storage o = orders[orderId];
        if (o.status != Status.Shipped) revert WrongStatus();
        if (msg.sender != o.buyer && block.timestamp < o.deadline) revert DisputeWindowOpen();
        o.status = Status.Released;
        (bool ok, ) = o.seller.call{value: o.amount}("");
        if (!ok) revert TransferFailed();
        emit Released(orderId, o.seller, o.amount);
    }

    /// If the seller never ships by the deadline, anyone can refund the buyer.
    function refund(uint256 orderId) external {
        Order storage o = orders[orderId];
        if (o.status != Status.Pending) revert WrongStatus();
        if (block.timestamp < o.deadline) revert DeadlineNotReached();
        o.status = Status.Refunded;
        (bool ok, ) = o.buyer.call{value: o.amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(orderId, o.buyer, o.amount);
    }

    function dispute(uint256 orderId, string calldata reason) external {
        Order storage o = orders[orderId];
        if (msg.sender != o.buyer) revert NotBuyer();
        if (o.status != Status.Shipped) revert WrongStatus();
        o.status = Status.Disputed;
        emit Disputed(orderId, msg.sender, reason);
    }
}
