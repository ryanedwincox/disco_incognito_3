import hashlib


def compute_guest_user_id(display_name: str) -> str:
    """Compute deterministic guest user ID from display name."""
    name_key = display_name.strip().lower()
    return f'guest_{hashlib.sha256(name_key.encode()).hexdigest()[:12]}'
