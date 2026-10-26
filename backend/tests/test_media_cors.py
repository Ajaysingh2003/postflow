"""Browser PUT headers and private preview downloads must match bucket CORS."""

from copy import deepcopy
from types import SimpleNamespace

import pytest
from botocore.exceptions import ClientError

from app.modules.media import configure


@pytest.fixture
def bucket(monkeypatch):
    class Bucket:
        def __init__(self):
            self.rules = []
            self.read_error = None
            self.writes = []

        def get_bucket_cors(self, **kwargs):
            assert kwargs == {"Bucket": "private-media"}
            if self.read_error:
                raise ClientError({"Error": {"Code": self.read_error}}, "GetBucketCors")
            return {"CORSRules": deepcopy(self.rules)}

        def put_bucket_cors(self, **kwargs):
            assert kwargs["Bucket"] == "private-media"
            self.writes.append(deepcopy(kwargs))
            self.rules = deepcopy(kwargs["CORSConfiguration"]["CORSRules"])

    bucket = Bucket()
    monkeypatch.setattr(configure, "client", lambda _: bucket)
    monkeypatch.setattr(
        configure, "get_settings",
        lambda: SimpleNamespace(
            r2_bucket_name="private-media",
            cors_origin_list=["https://draftva.com", "http://localhost:3000"],
        ),
    )
    return bucket


def test_bucket_cors_allows_signed_purpose_header_and_private_download_ranges(bucket):
    configure.configure_cors()
    rule = bucket.rules[0]
    assert rule["AllowedOrigins"] == ["https://draftva.com", "http://localhost:3000"]
    assert rule["AllowedMethods"] == ["GET", "PUT", "HEAD"]
    assert {value.lower() for value in rule["AllowedHeaders"]} == {
        "content-type", "x-amz-meta-purpose", "range"
    }
    assert set(rule["ExposeHeaders"]) >= {"ETag", "Content-Length", "Content-Range"}


def test_configuration_preserves_unrelated_rules_and_replaces_only_our_rule(bucket):
    unrelated = {"ID": "another-app", "AllowedOrigins": ["https://other.example"]}
    bucket.rules = [unrelated, {"ID": configure.UPLOAD_RULE_ID, "AllowedHeaders": []}]
    configure.configure_cors()
    configure.configure_cors()
    assert len(bucket.rules) == 2
    assert bucket.rules[1] == unrelated
    assert bucket.rules[0]["AllowedHeaders"] == ["Content-Type", "x-amz-meta-purpose", "Range"]


def test_missing_cors_configuration_is_created(bucket):
    bucket.read_error = "NoSuchCORSConfiguration"
    configure.configure_cors()
    assert len(bucket.writes) == 1


@pytest.mark.parametrize("code", ["AccessDenied", "NoSuchBucket", "InternalError"])
def test_unreadable_bucket_policy_is_never_overwritten(bucket, code):
    bucket.read_error = code
    with pytest.raises(ClientError):
        configure.configure_cors()
    assert bucket.writes == []
