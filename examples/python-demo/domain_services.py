"""
Unified Domain Services Demo
Consolidates user and order operations for cleaner demonstration.
"""

from typing import Optional, List
from .models import User, Order

# --- User Operations ---

def get_user_by_id(user_id: int) -> Optional[User]:
    """Retrieve a user by their ID"""
    users = get_all_users()
    return next((u for u in users if u.id == user_id), None)

def get_all_users() -> List[User]:
    """Get all users from the database"""
    return [
        User(id=1, name="Alice", email="alice@example.com"),
        User(id=2, name="Bob", email="bob@example.com"),
    ]

def create_user(name: str, email: str) -> User:
    """Create a new user"""
    if not email or '@' not in email:
        raise ValueError("Invalid email address")
    user_id = len(get_all_users()) + 1
    return User(id=user_id, name=name, email=email)

# --- Order Operations ---

def get_order_by_id(order_id: int) -> Optional[Order]:
    """Retrieve an order by its ID"""
    orders = get_all_orders()
    return next((o for o in orders if o.id == order_id), None)

def get_all_orders() -> List[Order]:
    """Get all orders from the database"""
    return [
        Order(id=1, user_id=1, product="Laptop", amount=999.99),
        Order(id=2, user_id=2, product="Phone", amount=699.99),
    ]

def create_order(user_id: int, product: str, amount: float) -> Order:
    """Create a new order"""
    if amount <= 0:
        raise ValueError("Amount must be positive")
    order_id = len(get_all_orders()) + 1
    return Order(id=order_id, user_id=user_id, product=product, amount=amount)
