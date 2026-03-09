from __future__ import annotations

from datetime import datetime, timezone

from flask import current_app
from redis import Redis


def _bl_key(jti: str) -> str:
    return f"bl:{jti}"


def revoke_jti_with_ttl(jti: str, exp_ts: int) -> None:
    """
    Mark this JWT (by jti) as revoked until its natural expiration time.
    exp_ts: unix timestamp from the token's "exp" claim.
    """
    try:
        now = int(datetime.now(timezone.utc).timestamp())
        ttl = max(1, exp_ts - now)

        r: Redis | None = current_app.extensions.get("redis")
        if r is None:
            current_app.logger.warning("JWT revoke skipped: Redis not initialized")
            return

        r.setex(_bl_key(jti), ttl, "1")
    except Exception as e:
        current_app.logger.warning("Failed to revoke jti in Redis: %r", e)
