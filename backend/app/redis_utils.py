# app/redis_utils.py
from __future__ import annotations

from datetime import datetime, timezone

from .__init__ import r, _bl_key  # reuse the same Redis client & key builder


def revoke_jti_with_ttl(jti: str, exp_ts: int) -> None:
    """
    Mark this JWT (by jti) as revoked until its natural expiration time.
    exp_ts: unix timestamp from the token's "exp" claim.
    """
    try:
        now = int(datetime.now(timezone.utc).timestamp())
        ttl = max(1, exp_ts - now)  # at least 1 second
        r.setex(_bl_key(jti), ttl, "1")
    except Exception as e:
        print("Failed to revoke jti in Redis: %r", e)
