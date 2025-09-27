from __future__ import annotations
from datetime import datetime, timezone
from flask import current_app
from redis import Redis


def revoke_jti_with_ttl(jti: str, exp_ts: int) -> None:
    """Store JTI in Redis with TTL until token expiry."""
    r: Redis = current_app.extensions["redis"]
    key = f"jwt:blocklist:{jti}"
    now = int(datetime.now(timezone.utc).timestamp())
    ttl = max(1, exp_ts - now)
    r.setex(key, ttl, "1")
