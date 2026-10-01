from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    created_at: datetime


class MemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    name: str
    role: str


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(admin|editor|viewer|billing)$")


class InvitationCreateBulk(BaseModel):
    invitations: list[InvitationCreate] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of invitations to process in a single batch",
    )

    @field_validator("invitations")
    @classmethod
    def validate_unique_emails(cls, value: list[InvitationCreate]) -> list[InvitationCreate]:
        emails = [inv.email.lower() for inv in value]
        if len(emails) != len(set(emails)):
            duplicates = {email for email in emails if emails.count(email) > 1}
            raise ValueError(f"Duplicate emails found in bulk payload: {', '.join(duplicates)}")
        return value


class InvitationResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    expires_at: datetime
    development_token: str | None = None


class InvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=500)


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|editor|viewer|billing)$")
