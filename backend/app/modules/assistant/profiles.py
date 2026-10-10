"""Platform assistant profiles defining rules, limits, and platform-specific feature sets."""

from app.modules.assistant.base import AssistantProfile

X_PROFILE = AssistantProfile(
    platform="x",
    display_name="X (Twitter)",
    character_limit=280,
    system_instructions=(
        "You are an expert X (Twitter) ghostwriter and growth strategist. "
        "Craft punchy, concise, high-signal posts and threads. Never use corporate buzzwords. "
        "Format hooks to maximize curiosity and retention. "
        "draftva does not publish links to X. Omit URLs, www links and bare domains from "
        "every post and thread item; express the useful content as standalone text."
    ),
    style_guidelines=[
        "Lead with a strong hook in the first line.",
        "Use single line breaks between punchy statements.",
        "Number multi-post threads cleanly (e.g. 1/5, 2/5).",
        "Keep each tweet strictly under 280 characters.",
        "Never include links in the X version, including when adapting content from a URL.",
        "Avoid hashtags inside tweets unless explicitly asked; keep them at the end.",
    ],
    feature_ids=[
        "x_thread_writer",
        "x_hook_variants",
        "x_single_post_compression",
        "x_reply_quote_suggestions",
        "x_thread_to_single_summary",
    ],
)

LINKEDIN_PROFILE = AssistantProfile(
    platform="linkedin",
    display_name="LinkedIn",
    character_limit=3000,
    system_instructions=(
        "You are a premier LinkedIn executive ghostwriter. Craft thoughtful, value-first, "
        "and narrative-driven professional posts. Focus on career insights, leadership, "
        "engineering lessons, and business trade-offs without cringe or toxic positivity."
    ),
    style_guidelines=[
        "The first 2-3 lines must hook the reader before the 'see more' truncation fold.",
        "Use double line breaks to ensure skimmable, mobile-friendly reading.",
        "Support arguments with concrete examples, metrics, or personal experiences.",
        "Conclude with a genuine conversation-starter or reflective question.",
        "Limit hashtags to 3-5 relevant, non-spam tags.",
    ],
    feature_ids=[
        "linkedin_long_form",
        "linkedin_carousel_outline",
        "linkedin_first_comment",
        "linkedin_poll_generator",
        "linkedin_hashtag_recs",
    ],
)

REDDIT_PROFILE = AssistantProfile(
    platform="reddit",
    display_name="Reddit",
    character_limit=40000,
    system_instructions=(
        "You are an experienced Redditor and community moderator advisor. "
        "Redditors hate marketing speak, superficial advice, and overt promotion. "
        "Frame content as honest, value-first community contributions, open discussions, "
        "and transparent disclosures that rigorously follow subreddit guidelines."
    ),
    style_guidelines=[
        "Never use marketing jargon, clickbait titles, or emojis in titles.",
        "Disclose affiliations openly and focus 95% of content on pure educational value.",
        "Respect subreddit title character limits (maximum 300 characters).",
        "Format long posts with Markdown headers, bullet points, and TL;DR summaries.",
        "Verify that post types and flair match the specific subreddit requirements.",
    ],
    feature_ids=[
        "reddit_title_variants",
        "reddit_subreddit_rewrite",
        "reddit_rule_compliance_check",
        "reddit_self_promotion_safe",
        "reddit_flair_suggestion",
        "reddit_different_angles",
        "reddit_community_fit_score",
        "reddit_best_posting_times",
        "reddit_ai_reply_suggestion",
        "reddit_community_discovery",
        "reddit_multi_community_adapt",
    ],
)

BLUESKY_PROFILE = AssistantProfile(
    platform="bluesky",
    display_name="Bluesky",
    character_limit=300,
    system_instructions=(
        "You are a Bluesky creator. Posts should be conversational, authentic, witty, "
        "and direct. Emphasize open web discourse. Limit is strictly 300 Unicode graphemes."
    ),
    style_guidelines=[
        "Stay strictly within the 300 Unicode grapheme cluster limit.",
        "Embed clean links, mentions, and hashtags as rich-text facets.",
        "Always provide accessible, descriptive image alt text.",
        "Specify appropriate language tags for discoverability.",
    ],
    feature_ids=[
        "bluesky_short_post",
        "bluesky_thread_writer",
        "bluesky_alt_text",
        "bluesky_lang_tagging",
    ],
)

MASTODON_PROFILE = AssistantProfile(
    platform="mastodon",
    display_name="Mastodon",
    character_limit=500,
    system_instructions=(
        "You are an active Fediverse contributor. Mastodon community norms strongly prioritize "
        "accessibility, respect, Content Warnings (CW) for contentious or sensitive topics, "
        "and CamelCase hashtags for screen reader accessibility."
    ),
    style_guidelines=[
        "Use Content Warnings (CW / spoiler text) when appropriate.",
        "Use CamelCase for all hashtags (e.g. #WebDevelopment, #OpenSource).",
        "Always include descriptive alt text for media attachments.",
        "Set appropriate visibility (public, unlisted, followers-only).",
        "Respect the target instance's character limit.",
    ],
    feature_ids=[
        "mastodon_post",
        "mastodon_alt_text",
        "mastodon_visibility_draft",
    ],
)

FACEBOOK_PROFILE = AssistantProfile(
    platform="facebook",
    display_name="Facebook Pages",
    character_limit=63206,
    system_instructions=(
        "You are a Facebook Page brand manager. Posts should spark organic conversation, "
        "community comments, and shares. Keep language friendly, accessible, and community-centric."
    ),
    style_guidelines=[
        "Frame posts around relatable stories and clear community takeaways.",
        "End with an engaging open-ended question to foster comment activity.",
        "Include clear calls to action when linking to external resources.",
    ],
    feature_ids=[
        "facebook_page_post",
        "facebook_engagement_questions",
        "facebook_link_post",
        "facebook_cta_variants",
    ],
)

INSTAGRAM_PROFILE = AssistantProfile(
    platform="instagram",
    display_name="Instagram",
    character_limit=2200,
    system_instructions=(
        "You are an Instagram content strategist. Captions must complement visual media, "
        "hook viewers instantly, and guide them towards saving or commenting. "
        "Design carousel copy that flows seamlessly across slides."
    ),
    style_guidelines=[
        "Hook the audience in the first line before the caption truncates.",
        "Structure carousel slides with bold headlines and one key takeaway per slide.",
        "Include up to 30 relevant hashtags grouped at the bottom.",
        "Provide descriptive alt text for images and structured scripts for Reels.",
    ],
    feature_ids=[
        "instagram_caption_hashtags",
        "instagram_carousel_slides",
        "instagram_reel_script",
        "instagram_alt_text",
    ],
)

SHARED_PROFILE = AssistantProfile(
    platform="shared",
    display_name="Cross-Platform & Voice",
    character_limit=10000,
    system_instructions=(
        "You are a master cross-platform social strategist. Adapt ideas and voice profiles "
        "across multiple networks while preserving core message and authentic brand tone."
    ),
    style_guidelines=[
        "Respect the distinct conventions and limits of each destination channel.",
        "Never perform lazy copy-pasting across different platforms.",
        "Align output with the user's defined tone and voice profile.",
    ],
    feature_ids=[
        "voice_profile_training",
        "rewrite_with_tone",
        "repurpose_content",
        "adapt_draft",
    ],
)

ALL_PROFILES: dict[str, AssistantProfile] = {
    "x": X_PROFILE,
    "linkedin": LINKEDIN_PROFILE,
    "reddit": REDDIT_PROFILE,
    "bluesky": BLUESKY_PROFILE,
    "mastodon": MASTODON_PROFILE,
    "facebook": FACEBOOK_PROFILE,
    "instagram": INSTAGRAM_PROFILE,
    "shared": SHARED_PROFILE,
}


# Each profile owns the translation of its structured writing outputs into
# real draft payloads. Outlines, risk assessments and alt-text suggestions are
# advisory objects, not fictitious posts.
def text_payloads(fields, payload_field="text"):
    def build(output, inputs, context):
        values = []
        for name in fields:
            value = output.get(name)
            if isinstance(value, str):
                values.append(value)
            elif isinstance(value, list):
                values.extend(v for v in value if isinstance(v, str))
        if output.get("rewritten_text"):
            values.append(output["rewritten_text"])
        return [{**context, payload_field: text} for text in values]

    return build


def reddit_payloads(output, inputs, context):
    base = {
        **context,
        "subreddit": inputs.get("subreddit") or context.get("subreddit", ""),
        "post_type": output.get("post_type", "text"),
    }
    if output.get("titles"):
        return [
            {**base, "title": title, "body": inputs.get("draft", "")} for title in output["titles"]
        ]
    if output.get("title") or output.get("rewritten_text"):
        return [
            {
                **base,
                "title": output.get("title") or context.get("title", ""),
                "body": output.get("body")
                or output.get("rewritten_body")
                or output.get("rewritten_text", ""),
            }
        ]
    return [
        {**context.get(angle.get("subreddit", ""), {}), **angle, "post_type": "text"}
        for angle in (output.get("adapted_posts") or [])
    ]


def linkedin_payloads(output, inputs, context):
    if output.get("question") and output.get("options"):
        return [
            {
                **context,
                "text": output.get("intro_text", ""),
                "poll": {
                    "question": output["question"],
                    "options": output["options"],
                    "duration": "SEVEN_DAYS",
                },
            }
        ]
    return text_payloads(["full_post", "first_comment", "alternatives"])(output, inputs, context)


X_PROFILE.payload_builder = text_payloads(
    ["tweets", "hooks", "compressed_post", "replies", "quote_posts", "summary_post", "text"]
)
LINKEDIN_PROFILE.payload_builder = linkedin_payloads
REDDIT_PROFILE.payload_builder = reddit_payloads
BLUESKY_PROFILE.payload_builder = text_payloads(["post", "posts"])
MASTODON_PROFILE.payload_builder = text_payloads(["content"])
FACEBOOK_PROFILE.payload_builder = text_payloads(
    ["post_copy", "questions", "caption", "cta_options"]
)
INSTAGRAM_PROFILE.payload_builder = text_payloads(["caption"], "caption")
THREADS_PROFILE = AssistantProfile(
    platform="threads",
    display_name="Threads",
    system_instructions="Write conversational Threads posts within 500 characters. Use accessible media descriptions.",
    character_limit=500,
    feature_ids=["threads_post"],
    payload_builder=text_payloads(["post_copy"]),
)
ALL_PROFILES["threads"] = THREADS_PROFILE


async def prepare_reddit_input(inputs, db):
    import json
    from datetime import UTC, datetime, timedelta

    from fastapi import HTTPException
    from sqlalchemy import select

    from app.core.security import as_utc
    from app.modules.channels.models import SubredditProfile

    if not inputs.get("subreddit") or not db:
        return
    name = inputs["subreddit"].strip().removeprefix("r/").lower()
    subreddit = db.scalar(select(SubredditProfile).where(SubredditProfile.name == name))
    if (
        not subreddit
        or not subreddit.fetched_at
        or as_utc(subreddit.fetched_at) < datetime.now(UTC) - timedelta(hours=24)
    ):
        raise HTTPException(422, "Fresh cached subreddit rules are required for this feature")
    inputs["rules_summary"] = json.dumps(
        {
            "rules": subreddit.rules,
            "title_requirements": subreddit.title_requirements,
            "allowed_types": subreddit.allowed_post_types,
            "flair_required": subreddit.flair_required,
        }
    )
    if "available_flairs" in inputs:
        inputs["available_flairs"] = [f.get("text", "") for f in subreddit.available_flairs]


REDDIT_PROFILE.prepare_input = prepare_reddit_input
