from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    password: str
    department: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    role: str
    department: str | None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse