"""Schemas for AI assistant features, platform profiles, and execution endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ==============================================================================
# X Features
# ==============================================================================


class XThreadWriterInput(BaseModel):
    text: str = Field(min_length=10, max_length=10_000)
    max_tweets: int = Field(default=5, ge=2, le=20)
    include_numbering: bool = True


class XThreadWriterOutput(BaseModel):
    tweets: list[str]
    total_tweets: int


class XHookVariantsInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)
    context: str | None = None
    count: int = Field(default=3, ge=1, le=10)


class XHookVariantsOutput(BaseModel):
    hooks: list[str]


class XSinglePostCompressionInput(BaseModel):
    text: str = Field(min_length=50, max_length=10_000)


class XSinglePostCompressionOutput(BaseModel):
    compressed_post: str
    character_count: int


class XReplyQuoteSuggestionsInput(BaseModel):
    post_text: str = Field(min_length=5, max_length=2000)
    context: str | None = None


class XReplyQuoteSuggestionsOutput(BaseModel):
    replies: list[str]
    quote_posts: list[str]


class XThreadToSingleSummaryInput(BaseModel):
    thread_tweets: list[str] = Field(min_length=2, max_length=30)


class XThreadToSingleSummaryOutput(BaseModel):
    summary_post: str


# ==============================================================================
# LinkedIn Features
# ==============================================================================


class LinkedInLongFormInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)
    key_points: list[str] = Field(default_factory=list)
    target_audience: str | None = None


class LinkedInLongFormOutput(BaseModel):
    hook: str
    body: str
    call_to_action: str
    full_post: str


class LinkedInCarouselOutlineInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)
    num_slides: int = Field(default=5, ge=3, le=15)


class LinkedInCarouselOutlineOutput(BaseModel):
    title: str
    slides: list[dict[str, Any]]


class LinkedInFirstCommentInput(BaseModel):
    post_content: str = Field(min_length=10, max_length=5000)
    link_url: str | None = None


class LinkedInFirstCommentOutput(BaseModel):
    first_comment: str
    alternatives: list[str] = Field(default_factory=list)


class LinkedInPollGeneratorInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)


class LinkedInPollGeneratorOutput(BaseModel):
    question: str
    options: list[str]
    introductory_post: str


class LinkedInHashtagRecsInput(BaseModel):
    post_content: str = Field(min_length=10, max_length=5000)
    count: int = Field(default=4, ge=2, le=8)


class LinkedInHashtagRecsOutput(BaseModel):
    hashtags: list[str]
    rationale: str | None = None


# ==============================================================================
# Reddit Features
# ==============================================================================


class RedditTitleVariantsInput(BaseModel):
    subreddit: str = Field(min_length=1, max_length=100)
    draft: str = Field(min_length=10, max_length=10_000)
    count: int = Field(default=3, ge=1, le=10)


class RedditTitleVariantsOutput(BaseModel):
    titles: list[str]


class RedditSubredditRewriteInput(BaseModel):
    subreddit: str = Field(min_length=1, max_length=100)
    draft: str = Field(min_length=10, max_length=10_000)
    rules_summary: str | None = None


class RedditSubredditRewriteOutput(BaseModel):
    title: str
    body: str
    post_type: str = "text"


class RedditRuleComplianceCheckInput(BaseModel):
    subreddit: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(default="", max_length=40_000)


class RedditRuleComplianceCheckOutput(BaseModel):
    is_compliant: bool
    potential_risks: list[str]
    suggestions: list[str]


class RedditSelfPromotionSafeInput(BaseModel):
    draft: str = Field(min_length=10, max_length=10_000)
    product_name: str | None = None


class RedditSelfPromotionSafeOutput(BaseModel):
    title: str
    rewritten_body: str
    transparency_statement: str


class RedditFlairSuggestionInput(BaseModel):
    subreddit: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(default="", max_length=10_000)
    available_flairs: list[str] = Field(default_factory=list)


class RedditFlairSuggestionOutput(BaseModel):
    suggested_flair: str
    rationale: str


class RedditDifferentAnglesInput(BaseModel):
    topic: str = Field(min_length=10, max_length=5000)
    target_subreddits: list[str] = Field(default_factory=list)


class RedditDifferentAnglesOutput(BaseModel):
    angles: list[dict[str, Any]]


class RedditCommunityFitScoreInput(BaseModel):
    subreddit: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(default="", max_length=40_000)
    rules_summary: str | None = None


class RedditCommunityFitScoreOutput(BaseModel):
    fit_score: int = Field(default=85, ge=0, le=100)
    tone_alignment: str = "High"
    strengths: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class RedditBestPostingTimesInput(BaseModel):
    subreddit: str = Field(min_length=1, max_length=100)
    timezone: str = Field(default="UTC", max_length=50)
    topic: str | None = None


class RedditBestPostingTimesOutput(BaseModel):
    recommended_windows: list[str] = Field(default_factory=list)
    peak_activity_days: list[str] = Field(default_factory=list)
    rationale: str = ""


class RedditAIReplySuggestionInput(BaseModel):
    parent_comment: str = Field(min_length=1, max_length=10_000)
    post_title: str | None = None
    post_context: str | None = None
    tone: str = Field(default="helpful", max_length=50)


class AIReplyItem(BaseModel):
    tone: str = "helpful"
    text: str = ""
    reasoning: str = ""


class RedditAIReplySuggestionOutput(BaseModel):
    suggestions: list[AIReplyItem] = Field(default_factory=list)


class RedditCommunityDiscoveryInput(BaseModel):
    topic: str = Field(min_length=5, max_length=5000)
    niche: str | None = None
    content_format: str = Field(default="discussion", max_length=50)


class DiscoveredSubreddit(BaseModel):
    subreddit: str = ""
    subscriber_scale: str = ""
    match_reason: str = ""
    posting_tips: str = ""


class RedditCommunityDiscoveryOutput(BaseModel):
    recommended_subreddits: list[DiscoveredSubreddit] = Field(default_factory=list)


class RedditMultiCommunityAdaptInput(BaseModel):
    base_message: str = Field(min_length=10, max_length=20_000)
    target_subreddits: list[str] = Field(..., min_length=1)
    rules_context: str | None = None


class AdaptedSubredditVariant(BaseModel):
    subreddit: str = ""
    title: str = ""
    body: str = ""
    recommended_flair: str | None = None
    post_type: str = "text"
    community_angle: str = ""


class RedditMultiCommunityAdaptOutput(BaseModel):
    adapted_posts: list[AdaptedSubredditVariant] = Field(default_factory=list)


# ==============================================================================
# Bluesky Features
# ==============================================================================


class BlueskyShortPostInput(BaseModel):
    text: str = Field(min_length=5, max_length=5000)
    auto_facets: bool = True


class BlueskyShortPostOutput(BaseModel):
    post: str
    grapheme_count: int
    facets_preview: list[str] = Field(default_factory=list)


class BlueskyThreadWriterInput(BaseModel):
    text: str = Field(min_length=10, max_length=10_000)
    max_posts: int = Field(default=4, ge=2, le=10)


class BlueskyThreadWriterOutput(BaseModel):
    posts: list[str]


class BlueskyAltTextInput(BaseModel):
    image_context: str = Field(min_length=5, max_length=2000)


class BlueskyAltTextOutput(BaseModel):
    alt_text: str


class BlueskyLangTaggingInput(BaseModel):
    text: str = Field(min_length=5, max_length=5000)


class BlueskyLangTaggingOutput(BaseModel):
    languages: list[str]


# ==============================================================================
# Mastodon Features
# ==============================================================================


class MastodonPostInput(BaseModel):
    text: str = Field(min_length=5, max_length=10_000)
    sensitive: bool = False


class MastodonPostOutput(BaseModel):
    content: str
    content_warning: str | None = None
    hashtags: list[str] = Field(default_factory=list)


class MastodonAltTextInput(BaseModel):
    image_context: str = Field(min_length=5, max_length=2000)


class MastodonAltTextOutput(BaseModel):
    alt_text: str


class MastodonVisibilityDraftInput(BaseModel):
    text: str = Field(min_length=5, max_length=5000)
    intent: str | None = None


class MastodonVisibilityDraftOutput(BaseModel):
    visibility: str
    rationale: str


# ==============================================================================
# Facebook Features
# ==============================================================================


class FacebookPagePostInput(BaseModel):
    topic: str = Field(min_length=5, max_length=2000)
    call_to_action: str | None = None


class FacebookPagePostOutput(BaseModel):
    post_copy: str


class FacebookEngagementQuestionsInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)
    count: int = Field(default=3, ge=1, le=10)


class FacebookEngagementQuestionsOutput(BaseModel):
    questions: list[str]


class FacebookLinkPostInput(BaseModel):
    link_url: str = Field(min_length=5, max_length=1000)
    link_title: str | None = None
    key_takeaway: str | None = None


class FacebookLinkPostOutput(BaseModel):
    caption: str


class FacebookCtaVariantsInput(BaseModel):
    offer: str = Field(min_length=5, max_length=1000)


class FacebookCtaVariantsOutput(BaseModel):
    cta_options: list[str]


# ==============================================================================
# Instagram Features
# ==============================================================================


class InstagramCaptionHashtagsInput(BaseModel):
    visual_description: str = Field(min_length=5, max_length=2000)
    message: str | None = None


class InstagramCaptionHashtagsOutput(BaseModel):
    caption: str
    hashtags: list[str]


class InstagramCarouselSlidesInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)
    num_slides: int = Field(default=5, ge=2, le=10)


class InstagramCarouselSlidesOutput(BaseModel):
    slides: list[dict[str, Any]]


class InstagramReelScriptInput(BaseModel):
    topic: str = Field(min_length=5, max_length=1000)
    target_seconds: int = Field(default=30, ge=15, le=90)


class InstagramReelScriptOutput(BaseModel):
    hook: str
    visual_cues: list[str]
    voiceover_script: str


class InstagramAltTextInput(BaseModel):
    image_description: str = Field(min_length=5, max_length=2000)


class InstagramAltTextOutput(BaseModel):
    alt_text: str


# ==============================================================================
# Shared Features
# ==============================================================================


class VoiceProfileTrainInput(BaseModel):
    sample_posts: list[str] = Field(min_length=1, max_length=50)


class VoiceProfileTrainOutput(BaseModel):
    tone_description: str
    style_keywords: list[str]
    rules: list[str]


class RewriteWithToneInput(BaseModel):
    text: str = Field(min_length=5, max_length=10_000)
    tone: str | None = None
    voice_profile_id: str | None = None


class RewriteWithToneOutput(BaseModel):
    rewritten_text: str


class RepurposeContentInput(BaseModel):
    source_text: str | None = None
    source_url: str | None = None
    target_platforms: list[str] = Field(min_length=1)


class RepurposeContentOutput(BaseModel):
    variants: dict[str, str]


class AdaptDraftInput(BaseModel):
    source_platform: str
    source_content: str = Field(min_length=5, max_length=10_000)
    target_platforms: list[str] = Field(min_length=1)


class AdaptDraftOutput(BaseModel):
    adapted_variants: dict[str, str]


# ==============================================================================
# API Endpoints Schemas
# ==============================================================================


class FeatureInfoResponse(BaseModel):
    id: str
    name: str
    description: str
    platforms: list[str]


class AssistantProfileResponse(BaseModel):
    platform: str
    display_name: str
    system_instructions: str
    style_guidelines: list[str]
    character_limit: int
    feature_ids: list[str]


class ExecuteFeatureRequest(BaseModel):
    input_data: dict[str, Any]
    platform: str | None = None
    voice_profile_id: str | None = None


class ExecuteFeatureResponse(BaseModel):
    feature_id: str
    platform: str
    output: dict[str, Any]
    tokens_used: int
    validation_issues: list[dict[str, Any]] = Field(default_factory=list)


class VoiceProfileCreate(BaseModel):
    name: str = Field(default="Default Voice", max_length=120)
    tone_description: str = Field(min_length=1, max_length=2000)
    sample_posts: list[str] = Field(default_factory=list, max_length=50)
    settings: dict[str, Any] = Field(default_factory=dict)


class VoiceProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    name: str
    tone_description: str
    sample_posts: list[str]
    settings: dict[str, Any]
    created_at: datetime


class AssistantRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    user_id: str
    platform: str
    feature_id: str
    input_summary: str
    tokens_used: int
    cost_micros: int
    status: str
    created_at: datetime
