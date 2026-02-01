"""
Order Service Module
Handles order-related operations
"""

from typing import Optional, List
from .models import Order


def get_order_by_id(order_id: int) -> Optional[Order]:
    """
    Retrieve an order by its ID
    
    Args:
        order_id: The unique identifier for the order
        
    Returns:
        Order object if found, None otherwise
    """
    # Simulate database query (DUPLICATE PATTERN with user_service.get_user_by_id)
    orders = get_all_orders()
    for order in orders:
        if order.id == order_id:
            return order
    return None


def get_all_orders() -> List[Order]:
    """Get all orders from the database"""
    # Simulated data
    return [
        Order(id=1, user_id=1, product="Laptop", amount=999.99),
        Order(id=2, user_id=2, product="Phone", amount=699.99),
    ]


def create_order(user_id: int, product: str, amount: float) -> Order:
    """
    Create a new order
    
    Args:
        user_id: ID of the user placing the order
        product: Product name
        amount: Order amount in USD
        
    Returns:
        Newly created Order object
    """
    # Validate amount
    if amount <= 0:
        raise ValueError("Amount must be positive")
    
    # Create order
    order_id = len(get_all_orders()) + 1
    order = Order(id=order_id, user_id=user_id, product=product, amount=amount)
    
    return order


def cancel_order(order_id: int) -> bool:
    """Cancel an order by ID"""
    order = get_order_by_id(order_id)
    if not order:
        return False
    
    # Mark as cancelled
    order.status = "cancelled"
    return True
