import bcrypt
import jwt

from app.core.config import JWT_SECRET


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")

    return bcrypt.checkpw(password_bytes, hash_bytes)


def create_access_token(user_id: int) -> str:
    payload = {
        "user_id": user_id
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> int:
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=["HS256"],
    )

    return payload["user_id"]