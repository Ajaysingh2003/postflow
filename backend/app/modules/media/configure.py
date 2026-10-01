from app.core.config import get_settings
from app.modules.media.service import client


def configure_cors() -> None:
    settings = get_settings()
    client(settings).put_bucket_cors(
        Bucket=settings.r2_bucket_name,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": settings.cors_origin_list,
                    "AllowedMethods": ["GET", "PUT", "HEAD"],
                    "AllowedHeaders": ["Content-Type"],
                    "ExposeHeaders": ["ETag"],
                    "MaxAgeSeconds": 3600,
                }
            ]
        },
    )


if __name__ == "__main__":
    configure_cors()
