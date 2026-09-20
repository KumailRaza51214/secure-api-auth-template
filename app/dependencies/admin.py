from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import decode_access_token

security = HTTPBearer()

ADMIN_USERS = {"Kumail", "Abbas"}


def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict[str, Any]:
    """Dependency injection that ensures the user is an authenticated admin (Kumail or Abbas)."""
    token = credentials.credentials
    payload = decode_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if username not in ADMIN_USERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only admins (Kumail, Abbas) can access this resource.",
        )
    return {"username": username}
