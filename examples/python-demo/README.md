# Example Python Project for Testing AIReady

A simple Python project demonstrating AIReady's Python support.

## Files

- `user_service.py` - User management (PEP 8 compliant)
- `order_service.py` - Order management (contains duplicate pattern)
- `models.py` - Data models
- `utils.py` - Utility functions (naming issues for testing)

## Run AIReady Analysis

```bash
aiready analyze examples/python-demo
```

## Expected Findings

1. **Consistency Issues**: `utils.py` has camelCase naming (should be snake_case)
2. **Duplicate Patterns**: `get_user_by_id` and `get_order_by_id` are similar
3. **Context Issues**: Deep import chains
