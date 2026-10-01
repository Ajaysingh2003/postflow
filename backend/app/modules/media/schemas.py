from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=100)
    size: int = Field(gt=0)


class UploadResponse(BaseModel):
    asset_id: str
    upload_url: str
    method: str = "PUT"
    headers: dict[str, str]
    expires_in: int


class MediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    original_filename: str
    content_type: str
    actual_size: int | None
    status: str
    rejection_reason: str | None
    created_at: datetime


class DownloadResponse(BaseModel):
    download_url: str
    expires_in: int
