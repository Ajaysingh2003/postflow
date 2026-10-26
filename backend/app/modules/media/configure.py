from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.modules.media.service import client

UPLOAD_RULE_ID = "draftva-browser-uploads"


def configure_cors() -> None:
    settings = get_settings()
    storage = client(settings)
    # Preserve unrelated rules. If credentials cannot read bucket configuration,
    # stop rather than overwriting a policy we could not inspect.
    try:
        rules = storage.get_bucket_cors(Bucket=settings.r2_bucket_name).get("CORSRules", [])
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "NoSuchCORSConfiguration":
            raise
        rules = []
    rule = {
        "ID": UPLOAD_RULE_ID,
        "AllowedOrigins": settings.cors_origin_list,
        "AllowedMethods": ["GET", "PUT", "HEAD"],
        "AllowedHeaders": ["Content-Type", "x-amz-meta-purpose", "Range"],
        "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
        "MaxAgeSeconds": 3600,
    }
    storage.put_bucket_cors(
        Bucket=settings.r2_bucket_name,
        CORSConfiguration={
            "CORSRules": [rule, *[item for item in rules if item.get("ID") != UPLOAD_RULE_ID]]
        },
    )


if __name__ == "__main__":
    configure_cors()
