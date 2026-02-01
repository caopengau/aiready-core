"""
Data Models
Domain objects for the application
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    """User model"""
    id: int
    name: str
    email: str
    
    def __str__(self) -> str:
        return f"User({self.id}, {self.name}, {self.email})"


@dataclass
class Order:
    """Order model"""
    id: int
    user_id: int
    product: str
    amount: float
    status: str = "pending"
    
    def __str__(self) -> str:
        return f"Order({self.id}, {self.product}, ${self.amount}, {self.status})"


# Constants
MAX_ORDERS_PER_USER = 100
DEFAULT_CURRENCY = "USD"
