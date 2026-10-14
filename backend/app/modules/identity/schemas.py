from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    name: str = Field(min_length=2, max_length=160)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=20, max_length=8192)


class XLoginStartRequest(BaseModel):
    browser_token: str = Field(min_length=32, max_length=128)


class XLoginCompleteRequest(XLoginStartRequest):
    state: str = Field(min_length=32, max_length=128)
    code: str = Field(min_length=1, max_length=2048)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    workspace_id: str
    email: EmailStr
    name: str
    email_verified: bool
    verification_required: bool
    verification_sent: bool = False
    retry_after: int = 0


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    email_verified: bool
    workspace_id: str


class MessageResponse(BaseModel):
    message: str
    development_token: str | None = None
    retry_after: int = 0
    expires_in: int | None = None
    already_verified: bool = False


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)


class VerifyEmailRequest(BaseModel):
    email: EmailStr | None = None
    token: str = Field(min_length=6, max_length=500)


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
