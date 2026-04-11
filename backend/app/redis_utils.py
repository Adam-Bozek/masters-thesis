"""
# @ Author: Bc. Adam Božek
# @ Create Time: 2025-10-24 15:42:07
# @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
                It is designed to support the screening of children using the Slovak
                implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
# @ License: This program is free software: you can redistribute it and/or modify it under the terms of
                the GNU Affero General Public License as published by the Free Software Foundation, either
                version 3 of the License, or any later version. This program is distributed in the hope
                that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
                of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
                See the GNU Affero General Public License for more details.
                You should have received a copy of the GNU Affero General Public License along with this program.
                If not, see <https://www.gnu.org/licenses/>..
"""

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
