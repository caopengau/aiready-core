"""
User Service Module
Handles user-related operations
"""

from typing import Optional, List
from .models import User


def get_user_by_id(user_id: int) -> Optional[User]:
    """
    Retrieve a user by their ID
    
    Args:
        user_id: The unique identifier for the user
        
    Returns:
        User object if found, None otherwise
    """
    # Simulate database query
    users = get_all_users()
    for user in users:
        if user.id == user_id:
            return user
    return None


def get_all_users() -> List[User]:
    """Get all users from the database"""
    # Simulated data
    return [
        User(id=1, name="Alice", email="alice@example.com"),
        User(id=2, name="Bob", email="bob@example.com"),
    ]


def create_user(name: str, email: str) -> User:
    """
    Create a new user
    
    Args:
        name: User's full name
        email: User's email address
        
    Returns:
        Newly created User object
    """
    # Validate email
    if not email or '@' not in email:
        raise ValueError("Invalid email address")
    
    # Create user
    user_id = len(get_all_users()) + 1
    user = User(id=user_id, name=name, email=email)
    
    return user


def update_user(user_id: int, name: Optional[str] = None, email: Optional[str] = None) -> Optional[User]:
    """Update user information"""
    user = get_user_by_id(user_id)
    if not user:
        return None
    
    if name:
        user.name = name
    if email:
        user.email = email
    
    return user


def delete_user(user_id: int) -> bool:
    """Delete a user by ID"""
    user = get_user_by_id(user_id)
    return user is not None
