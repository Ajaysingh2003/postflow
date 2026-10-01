from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    name: str = Field(min_length=1, max_length=160)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=20)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    workspace_id: str


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    email_verified: bool
    workspace_id: str


class MessageResponse(BaseModel):
    message: str
    development_token: str | None = None


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(TokenRequest):
    password: str = Field(min_length=10, max_length=200)


class SessionResponse(BaseModel):
    id: str
    created_at: datetime
    expires_at: datetime
    current: bool = False


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)

