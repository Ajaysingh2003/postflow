from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    name: Name


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
    verification_error: str | None = None
    retry_after: int = 0


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    email_verified: bool
    workspace_id: str
    onboarding_completed_at: datetime | None = None


class OnboardingResponse(BaseModel):
    completed_at: datetime | None
    workspace_id: str
    workspace_name: str
    can_connect: bool


class MessageResponse(BaseModel):
    message: str
    outcome: Literal["completed", "accepted", "verified", "password_updated"] = "completed"
    development_token: str | None = None
    retry_after: int = 0
    expires_in: int | None = None
    already_verified: bool = False
    delivery_status: Literal["accepted", "sent", "failed"] | None = None
    email: EmailStr | None = None


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
    name: Name
