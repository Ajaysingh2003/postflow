export interface BrandProfile {
  id: string;
  workspace_id: string;
  niche: string | null;
  persona: string | null;
  target_audience: string | null;
  style_guide: string | null;
  writing_rules: string | null;
  linkedin_instructions: string | null;
  goals: string[];
  voice_traits: string[];
  preferred_formats: string[];
  calls_to_action: string[];
  restricted_topics: string[];
}

export interface AccountWritingSamples {
  connection_id: string | null;
  writing_samples: string[];
}
