from types import SimpleNamespace

import pytest

from app.modules.analytics.service import inclusive_impressions


def row(value, available=True):
    return SimpleNamespace(
        impressions=value,
        available_metrics=["impressions"] if available else [],
        metrics_status="partial",
    )


def test_inclusive_impressions_keeps_post_and_reply_totals_separate():
    result = inclusive_impressions([row(20), row(30)], [row(100), row(200)], True)
    assert result.total == 350
    assert result.post_impressions == 50
    assert result.reply_impressions == 300
    assert result.replies_count == 2
    assert result.complete


@pytest.mark.parametrize(
    "posts,replies,complete,value",
    [
        ([row(0)], [row(0)], True, 0),
        ([], [], True, 0),
        ([], [], False, None),
        ([row(50)], [row(0, False)], True, None),
        ([row(50)], [row(5)], False, 55),
    ],
)
def test_missing_and_partial_impressions_never_appear_as_a_complete_zero(
    posts, replies, complete, value
):
    result = inclusive_impressions(posts, replies, complete)
    assert result.total == value
    assert result.complete is (complete and value is not None)
