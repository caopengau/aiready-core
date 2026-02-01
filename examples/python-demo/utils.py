"""
Utility Functions
Helper functions for the application
"""

import re
from typing import Any


# INTENTIONAL NAMING ISSUES FOR TESTING
def validateEmail(email: str) -> bool:  # ❌ Should be validate_email
    """Check if email is valid (camelCase - not PEP 8!)"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def FormatCurrency(amount: float, currency: str = "USD") -> str:  # ❌ Should be format_currency
    """Format amount as currency (PascalCase - not PEP 8!)"""
    symbols = {
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
    }
    symbol = symbols.get(currency, "$")
    return f"{symbol}{amount:.2f}"


MyConstant = 42  # ❌ Should be MY_CONSTANT


def calculate_tax(amount: float, tax_rate: float = 0.08) -> float:
    """Calculate tax amount (PEP 8 compliant ✅)"""
    return amount * tax_rate


def is_valid_id(id_value: Any) -> bool:
    """Check if ID is valid (PEP 8 compliant ✅)"""
    return isinstance(id_value, int) and id_value > 0
