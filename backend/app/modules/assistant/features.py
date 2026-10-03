"""Feature definitions declaring input/output Pydantic schemas and prompt templates.

All features are registered declaratively without ad-hoc platform if-conditions.
"""

from app.modules.assistant import schemas as s
from app.modules.assistant.base import AssistantFeature

ALL_FEATURES: list[AssistantFeature] = [
    # ==========================================================================
    # X Features
    # ==========================================================================
    AssistantFeature(
        id="x_thread_writer",
        name="Thread Writer",
        description="Convert long-form text or thoughts into an engaging, numbered X thread.",
        platforms=["x"],
        input_schema=s.XThreadWriterInput,
        output_schema=s.XThreadWriterOutput,
        prompt_template=(
            "Convert the following text into an engaging, high-retention X thread of up to {max_tweets} tweets.\n"
            "Style guidelines:\n{style_guidelines}\n\n"
            "Source text:\n{text}\n\n"
            "Format requirements: Number each tweet (e.g. 1/{max_tweets}). "
            "Ensure every tweet is strictly under 280 characters. Lead with a compelling hook."
        ),
    ),
    AssistantFeature(
        id="x_hook_variants",
        name="Hook Variants",
        description="Generate multiple hook alternatives (curiosity, contrarian, data-driven).",
        platforms=["x"],
        input_schema=s.XHookVariantsInput,
        output_schema=s.XHookVariantsOutput,
        prompt_template=(
            "Generate {count} distinct, high-impact hook variations for a post about: '{topic}'.\n"
            "Context: {context}\n"
            "Include diverse angles: curiosity gap, contrarian stance, and data-driven insight. "
            "Each hook must be under 240 characters."
        ),
    ),
    AssistantFeature(
        id="x_single_post_compression",
        name="Single Post Compression",
        description="Compress a detailed thought into a single punchy tweet under 280 characters.",
        platforms=["x"],
        input_schema=s.XSinglePostCompressionInput,
        output_schema=s.XSinglePostCompressionOutput,
        prompt_template=(
            "Compress the following text into one punchy, high-signal single tweet under 280 characters:\n\n"
            "{text}\n\n"
            "Retain the core takeaway while cutting all unnecessary filler."
        ),
    ),
    AssistantFeature(
        id="x_reply_quote_suggestions",
        name="Reply & Quote Post Suggestions",
        description="Generate thoughtful replies and quote-post angles for an existing tweet.",
        platforms=["x"],
        input_schema=s.XReplyQuoteSuggestionsInput,
        output_schema=s.XReplyQuoteSuggestionsOutput,
        prompt_template=(
            "For the following post:\n'{post_text}'\n"
            "Context: {context}\n\n"
            "Generate 3 valuable replies that add to the conversation, and 2 compelling quote-post angles."
        ),
    ),
    AssistantFeature(
        id="x_thread_to_single_summary",
        name="Thread to Single Post Summary",
        description="Condense a multi-tweet thread into a single standalone tweet.",
        platforms=["x"],
        input_schema=s.XThreadToSingleSummaryInput,
        output_schema=s.XThreadToSingleSummaryOutput,
        prompt_template=(
            "Summarize this multi-tweet thread into a single standalone tweet under 280 characters:\n\n"
            "{thread_tweets}"
        ),
    ),
    # ==========================================================================
    # LinkedIn Features
    # ==========================================================================
    AssistantFeature(
        id="linkedin_long_form",
        name="Long-Form Post",
        description="Format thought leadership copy with hook, clean line breaks, and closing CTA.",
        platforms=["linkedin"],
        input_schema=s.LinkedInLongFormInput,
        output_schema=s.LinkedInLongFormOutput,
        prompt_template=(
            "Draft a professional, narrative-driven LinkedIn post on topic: '{topic}'.\n"
            "Key points to cover: {key_points}\n"
            "Target audience: {target_audience}\n\n"
            "Follow these LinkedIn style rules:\n{style_guidelines}\n"
            "Structure: compelling 2-line hook before 'see more', body with spacing, and conversation CTA."
        ),
    ),
    AssistantFeature(
        id="linkedin_carousel_outline",
        name="Carousel Outline",
        description="Generate slide-by-slide copy and visual prompts for PDF document carousels.",
        platforms=["linkedin"],
        input_schema=s.LinkedInCarouselOutlineInput,
        output_schema=s.LinkedInCarouselOutlineOutput,
        prompt_template=(
            "Create a slide-by-slide carousel outline with {num_slides} slides on topic: '{topic}'.\n"
            "Each slide must have: slide_number, title (bold headline), and content (1-2 skimmable bullet points)."
        ),
    ),
    AssistantFeature(
        id="linkedin_first_comment",
        name="First Comment Suggestion",
        description="Generate engaging first comment options (link drop, extra resource, discussion).",
        platforms=["linkedin"],
        input_schema=s.LinkedInFirstCommentInput,
        output_schema=s.LinkedInFirstCommentOutput,
        prompt_template=(
            "For this LinkedIn post:\n'{post_content}'\n"
            "Target link: {link_url}\n\n"
            "Suggest the optimal first comment to share the external link and invite conversation."
        ),
    ),
    AssistantFeature(
        id="linkedin_poll_generator",
        name="Poll Generator",
        description="Generate an engaging LinkedIn poll question with options and intro copy.",
        platforms=["linkedin"],
        input_schema=s.LinkedInPollGeneratorInput,
        output_schema=s.LinkedInPollGeneratorOutput,
        prompt_template=(
            "Create an interactive LinkedIn poll about: '{topic}'.\n"
            "Provide: introductory post text, a clear question, and 2-4 distinct vote options."
        ),
    ),
    AssistantFeature(
        id="linkedin_hashtag_recs",
        name="Hashtag Recommendations",
        description="Recommend sensible, non-spam hashtags tailored to post content.",
        platforms=["linkedin"],
        input_schema=s.LinkedInHashtagRecsInput,
        output_schema=s.LinkedInHashtagRecsOutput,
        prompt_template=(
            "Recommend {count} relevant, non-spam LinkedIn hashtags for the following post:\n\n"
            "{post_content}"
        ),
    ),
    # ==========================================================================
    # Reddit Features
    # ==========================================================================
    AssistantFeature(
        id="reddit_title_variants",
        name="Reddit Title Variants",
        description="Generate clear, community-appropriate, non-clickbait titles under 300 chars.",
        platforms=["reddit"],
        input_schema=s.RedditTitleVariantsInput,
        output_schema=s.RedditTitleVariantsOutput,
        prompt_template=(
            "Generate {count} non-clickbait, community-safe titles for r/{subreddit}.\n"
            "Draft content:\n{draft}\n\n"
            "Ensure titles are under 300 characters, avoid corporate marketing speak, and match Reddit culture."
        ),
    ),
    AssistantFeature(
        id="reddit_subreddit_rewrite",
        name="Subreddit-Aware Rewrite",
        description="Rewrite a draft to fit specific subreddit rules and community norms.",
        platforms=["reddit"],
        input_schema=s.RedditSubredditRewriteInput,
        output_schema=s.RedditSubredditRewriteOutput,
        prompt_template=(
            "Rewrite the following draft specifically for the r/{subreddit} community:\n\n"
            "Draft:\n{draft}\n\n"
            "Cached subreddit rules & constraints:\n{rules_summary}\n\n"
            "Make it 100% value-first, honest, transparent, and formatted in clean Markdown."
        ),
    ),
    AssistantFeature(
        id="reddit_rule_compliance_check",
        name="Rule Compliance Check",
        description="Check draft against subreddit rules and highlight potential removal risks.",
        platforms=["reddit"],
        input_schema=s.RedditRuleComplianceCheckInput,
        output_schema=s.RedditRuleComplianceCheckOutput,
        prompt_template=(
            "Analyze this proposed submission for r/{subreddit} against community rules:\n"
            "Title: {title}\n"
            "Body:\n{body}\n\n"
            "Determine if it complies, list potential removal risks, and provide actionable fixes."
        ),
    ),
    AssistantFeature(
        id="reddit_self_promotion_safe",
        name="Self-Promotion Safe Rewrite",
        description="Refocus self-promotion into value-first framing with transparent disclosure.",
        platforms=["reddit"],
        input_schema=s.RedditSelfPromotionSafeInput,
        output_schema=s.RedditSelfPromotionSafeOutput,
        prompt_template=(
            "Transform this promotional draft into an acceptable, value-first Reddit submission:\n\n"
            "Original draft:\n{draft}\n"
            "Product/Project: {product_name}\n\n"
            "Focus 95% on sharing lessons learned, technical breakdown, or solving a problem. "
            "Include a humble, honest disclosure statement."
        ),
    ),
    AssistantFeature(
        id="reddit_flair_suggestion",
        name="Flair Suggestion",
        description="Suggest the most appropriate flair from available subreddit options.",
        platforms=["reddit"],
        input_schema=s.RedditFlairSuggestionInput,
        output_schema=s.RedditFlairSuggestionOutput,
        prompt_template=(
            "Select the most appropriate flair for r/{subreddit} from these options: {available_flairs}\n\n"
            "Post title: {title}\n"
            "Post body: {body}"
        ),
    ),
    AssistantFeature(
        id="reddit_different_angles",
        name="Different Angles per Subreddit",
        description="Generate distinct angles for multiple subreddits rather than duplicate cross-posts.",
        platforms=["reddit"],
        input_schema=s.RedditDifferentAnglesInput,
        output_schema=s.RedditDifferentAnglesOutput,
        prompt_template=(
            "Create genuinely distinct post angles for the topic '{topic}' across target subreddits: {target_subreddits}.\n"
            "Each angle must cater specifically to that subreddit's audience without being a copy."
        ),
    ),
    AssistantFeature(
        id="reddit_community_fit_score",
        name="Community Fit Score",
        description="Evaluate post draft against subreddit rules, tone, and audience to grade fit 0-100.",
        platforms=["reddit"],
        input_schema=s.RedditCommunityFitScoreInput,
        output_schema=s.RedditCommunityFitScoreOutput,
        prompt_template=(
            "Evaluate this submission for r/{subreddit} against community rules and culture:\n\n"
            "Title: {title}\n"
            "Body:\n{body}\n\n"
            "Rules context:\n{rules_summary}\n\n"
            "Output: numeric fit score (0-100), tone alignment, key strengths, potential risk factors, and actionable recommendations."
        ),
    ),
    AssistantFeature(
        id="reddit_best_posting_times",
        name="Best Posting Times",
        description="Recommend optimal posting time windows and peak activity days for a target subreddit.",
        platforms=["reddit"],
        input_schema=s.RedditBestPostingTimesInput,
        output_schema=s.RedditBestPostingTimesOutput,
        prompt_template=(
            "Recommend the best posting time windows for r/{subreddit} in timezone {timezone}.\n"
            "Topic: {topic}\n"
            "Provide optimal time windows, peak days of the week, and rationale based on community traffic patterns."
        ),
    ),
    AssistantFeature(
        id="reddit_ai_reply_suggestion",
        name="AI Reply Suggestions",
        description="Draft context-aware, helpful replies to incoming comments on your Reddit posts.",
        platforms=["reddit"],
        input_schema=s.RedditAIReplySuggestionInput,
        output_schema=s.RedditAIReplySuggestionOutput,
        prompt_template=(
            "Draft authentic, non-spam replies to this Reddit comment:\n\n"
            'Parent Comment:\n"{parent_comment}"\n\n'
            "Original Post Title: {post_title}\n"
            "Context: {post_context}\n"
            "Desired Tone: {tone}\n\n"
            "Provide 2-3 distinct reply options with rationale."
        ),
    ),
    AssistantFeature(
        id="reddit_community_discovery",
        name="Relative Community Discovery",
        description="Discover relevant subreddits to share your topic or product with zero spam risk.",
        platforms=["reddit"],
        input_schema=s.RedditCommunityDiscoveryInput,
        output_schema=s.RedditCommunityDiscoveryOutput,
        prompt_template=(
            "Find the most relevant subreddits for this topic/niche:\n\n"
            "Topic: {topic}\n"
            "Niche: {niche}\n"
            "Format: {content_format}\n\n"
            "Return 3-6 relevant subreddits with subscriber scale, match rationale, and posting tips."
        ),
    ),
    AssistantFeature(
        id="reddit_multi_community_adapt",
        name="Multi-Community Rule Adaptation",
        description="Adapt one core message into distinct, rule-compliant post variants for multiple subreddits.",
        platforms=["reddit"],
        input_schema=s.RedditMultiCommunityAdaptInput,
        output_schema=s.RedditMultiCommunityAdaptOutput,
        prompt_template=(
            "Adapt this base message for each target subreddit to ensure 100% compliance with community rules and zero duplicate penalties:\n\n"
            "Base Message:\n{base_message}\n\n"
            "Target Subreddits: {target_subreddits}\n"
            "Rules & Constraints Context:\n{rules_context}\n\n"
            "For EACH subreddit, output a tailored title (<300 chars), custom body markdown, recommended flair, and post type."
        ),
    ),
    # ==========================================================================
    # Bluesky Features
    # ==========================================================================
    AssistantFeature(
        id="bluesky_short_post",
        name="Short Post & Facets",
        description="Concise post within 300 Unicode graphemes with rich-text facet suggestions.",
        platforms=["bluesky"],
        input_schema=s.BlueskyShortPostInput,
        output_schema=s.BlueskyShortPostOutput,
        prompt_template=(
            "Draft a sharp Bluesky post within the strict 300 Unicode grapheme cluster limit:\n\n"
            "{text}\n\n"
            "Provide natural placement for mentions, links, and hashtags."
        ),
    ),
    AssistantFeature(
        id="bluesky_thread_writer",
        name="Bluesky Thread Writer",
        description="Multi-post thread with each post respecting 300 grapheme limits.",
        platforms=["bluesky"],
        input_schema=s.BlueskyThreadWriterInput,
        output_schema=s.BlueskyThreadWriterOutput,
        prompt_template=(
            "Break down the following text into a Bluesky thread of up to {max_posts} posts.\n"
            "Every single post MUST be under 300 Unicode graphemes:\n\n{text}"
        ),
    ),
    AssistantFeature(
        id="bluesky_alt_text",
        name="Bluesky Alt Text",
        description="Generate accessible, descriptive image alt text.",
        platforms=["bluesky"],
        input_schema=s.BlueskyAltTextInput,
        output_schema=s.BlueskyAltTextOutput,
        prompt_template=(
            "Generate descriptive, accessible alt text for an image described as:\n'{image_context}'"
        ),
    ),
    AssistantFeature(
        id="bluesky_lang_tagging",
        name="Language Tagging",
        description="Detect and recommend BCP-47 language tags for Bluesky posts.",
        platforms=["bluesky"],
        input_schema=s.BlueskyLangTaggingInput,
        output_schema=s.BlueskyLangTaggingOutput,
        prompt_template=(
            "Identify the BCP-47 language tags (e.g. ['en']) for this text:\n\n{text}"
        ),
    ),
    # ==========================================================================
    # Mastodon Features
    # ==========================================================================
    AssistantFeature(
        id="mastodon_post",
        name="Mastodon Post & CW",
        description="Draft status with optional Content Warning and CamelCase hashtags.",
        platforms=["mastodon"],
        input_schema=s.MastodonPostInput,
        output_schema=s.MastodonPostOutput,
        prompt_template=(
            "Draft a Mastodon status based on:\n'{text}'\n\n"
            "Guidelines:\n{style_guidelines}\n"
            "Include an appropriate Content Warning (CW) if sensitive/spoiler/technical, "
            "and format all hashtags in CamelCase (e.g. #OpenSource, #PythonDev)."
        ),
    ),
    AssistantFeature(
        id="mastodon_alt_text",
        name="Mastodon Alt Text",
        description="Generate screen-reader friendly alt text for media.",
        platforms=["mastodon"],
        input_schema=s.MastodonAltTextInput,
        output_schema=s.MastodonAltTextOutput,
        prompt_template=(
            "Write comprehensive, accessible alt text for a Fediverse media attachment described as:\n'{image_context}'"
        ),
    ),
    AssistantFeature(
        id="mastodon_visibility_draft",
        name="Visibility Advisor",
        description="Recommend visibility scope (public, unlisted, followers-only).",
        platforms=["mastodon"],
        input_schema=s.MastodonVisibilityDraftInput,
        output_schema=s.MastodonVisibilityDraftOutput,
        prompt_template=(
            "Analyze this Mastodon post and intent, and recommend appropriate visibility:\n"
            "Content: '{text}'\n"
            "Intent: {intent}"
        ),
    ),
    # ==========================================================================
    # Facebook Features
    # ==========================================================================
    AssistantFeature(
        id="facebook_page_post",
        name="Facebook Page Post",
        description="Engaging copy crafted for Facebook Page community reach.",
        platforms=["facebook"],
        input_schema=s.FacebookPagePostInput,
        output_schema=s.FacebookPagePostOutput,
        prompt_template=(
            "Write an engaging Facebook Page post about: '{topic}'.\n"
            "Call to action: {call_to_action}\n"
            "Guidelines:\n{style_guidelines}"
        ),
    ),
    AssistantFeature(
        id="facebook_engagement_questions",
        name="Engagement Questions",
        description="Generate comment-driving questions to increase Page engagement.",
        platforms=["facebook"],
        input_schema=s.FacebookEngagementQuestionsInput,
        output_schema=s.FacebookEngagementQuestionsOutput,
        prompt_template=(
            "Generate {count} community engagement questions related to '{topic}' that invite replies."
        ),
    ),
    AssistantFeature(
        id="facebook_link_post",
        name="Link Post Copy",
        description="Compelling copy to accompany an external link post.",
        platforms=["facebook"],
        input_schema=s.FacebookLinkPostInput,
        output_schema=s.FacebookLinkPostOutput,
        prompt_template=(
            "Draft a compelling Facebook Page caption to accompany this link:\n"
            "URL: {link_url}\n"
            "Title: {link_title}\n"
            "Takeaway: {key_takeaway}"
        ),
    ),
    AssistantFeature(
        id="facebook_cta_variants",
        name="CTA Variants",
        description="Generate multiple call-to-action button and copy options.",
        platforms=["facebook"],
        input_schema=s.FacebookCtaVariantsInput,
        output_schema=s.FacebookCtaVariantsOutput,
        prompt_template=(
            "Provide 4 distinct Call-To-Action (CTA) phrases for this offer: '{offer}'."
        ),
    ),
    # ==========================================================================
    # Instagram Features
    # ==========================================================================
    AssistantFeature(
        id="instagram_caption_hashtags",
        name="Caption & Hashtags",
        description="Engaging visual caption with hook, body, CTA, and up to 30 hashtags.",
        platforms=["instagram"],
        input_schema=s.InstagramCaptionHashtagsInput,
        output_schema=s.InstagramCaptionHashtagsOutput,
        prompt_template=(
            "Write an Instagram caption for media showing: '{visual_description}'.\n"
            "Message/Context: {message}\n"
            "Guidelines:\n{style_guidelines}\n"
            "Include a hook in the opening line, readable spacing, a save/share CTA, and up to 25 relevant hashtags."
        ),
    ),
    AssistantFeature(
        id="instagram_carousel_slides",
        name="Instagram Carousel Slides",
        description="Structured cards for educational or visual carousel posts.",
        platforms=["instagram"],
        input_schema=s.InstagramCarouselSlidesInput,
        output_schema=s.InstagramCarouselSlidesOutput,
        prompt_template=(
            "Create a {num_slides}-slide Instagram carousel on '{topic}'.\n"
            "Each slide must have slide_number, headline, and concise body text."
        ),
    ),
    AssistantFeature(
        id="instagram_reel_script",
        name="Reel Hook & Script",
        description="Hook (first 3 seconds), visual cues, and short script under 60s.",
        platforms=["instagram"],
        input_schema=s.InstagramReelScriptInput,
        output_schema=s.InstagramReelScriptOutput,
        prompt_template=(
            "Write a high-energy Instagram Reel script on '{topic}' lasting ~{target_seconds} seconds.\n"
            "Include: hook (first 3 seconds), visual directions, and spoken voiceover script."
        ),
    ),
    AssistantFeature(
        id="instagram_alt_text",
        name="Instagram Alt Text",
        description="Descriptive accessibility alt text for image uploads.",
        platforms=["instagram"],
        input_schema=s.InstagramAltTextInput,
        output_schema=s.InstagramAltTextOutput,
        prompt_template=(
            "Write clear, descriptive accessibility alt text for this Instagram image: '{image_description}'"
        ),
    ),
    # ==========================================================================
    # Shared Cross-Platform Features
    # ==========================================================================
    AssistantFeature(
        id="voice_profile_training",
        name="Train Voice Profile",
        description="Analyze sample posts to extract tone, style, and vocabulary guidelines.",
        platforms=["*"],
        input_schema=s.VoiceProfileTrainInput,
        output_schema=s.VoiceProfileTrainOutput,
        prompt_template=(
            "Analyze these sample posts from a creator/brand to extract their unique voice profile:\n\n"
            "{sample_posts}\n\n"
            "Extract: detailed tone description, 5-7 stylistic keywords, and 3-5 operational writing rules."
        ),
    ),
    AssistantFeature(
        id="rewrite_with_tone",
        name="Rewrite with Tone",
        description="Rewrite any post with a chosen tone or active voice profile.",
        platforms=["*"],
        input_schema=s.RewriteWithToneInput,
        output_schema=s.RewriteWithToneOutput,
        prompt_template=("Rewrite the following text in tone '{tone}':\n\n{text}"),
    ),
    AssistantFeature(
        id="repurpose_content",
        name="Repurpose Across Channels",
        description="Repurpose text or URL into platform-optimized variants for each selected channel.",
        platforms=["*"],
        input_schema=s.RepurposeContentInput,
        output_schema=s.RepurposeContentOutput,
        prompt_template=(
            "Repurpose this content for target platforms: {target_platforms}.\n\n"
            "Source text:\n{source_text}\n\n"
            "Respect each platform's distinct formatting, limits, and community tone."
        ),
    ),
    AssistantFeature(
        id="adapt_draft",
        name="Adapt Draft to All Channels",
        description="Adapt a draft designed for one channel into optimized variants for others.",
        platforms=["*"],
        input_schema=s.AdaptDraftInput,
        output_schema=s.AdaptDraftOutput,
        prompt_template=(
            "Adapt this {source_platform} draft for {target_platforms}:\n\n"
            "Original content:\n{source_content}\n\n"
            "Tailor each variant to its native conventions without lazy copying."
        ),
    ),
]


ALL_FEATURES.append(
    AssistantFeature(
        id="threads_post",
        name="Threads post",
        description="Conversational Threads copy within 500 characters",
        platforms=["threads"],
        input_schema=s.FacebookPagePostInput,
        output_schema=s.FacebookPagePostOutput,
        prompt_template="Write a Threads post about {topic}. Tone: {tone}. Keep it within 500 characters. {style_guidelines}",
    )
)
