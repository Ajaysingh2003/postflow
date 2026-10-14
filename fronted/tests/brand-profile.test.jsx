import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BRAND_CHANNELS,
  EMPTY_BRAND,
  brandProgress,
  brandSchema,
  brandValues,
} from "../src/modules/content/personaTypes";
import {
  BrandFields,
  BrandProfileSkeleton,
} from "../src/modules/content/component/PersonaDialog";

test("Brand profile accepts empty onboarding and bounded per-channel guidance", () => {
  expect(brandSchema.safeParse(EMPTY_BRAND).success).toBe(true);
  expect(
    brandSchema.parse({
      ...EMPTY_BRAND,
      display_name: " Jamie ",
      platform_instructions: { threads: "Keep it natural" },
    }).display_name,
  ).toBe("Jamie");
  for (const update of [
    { sample_posts: [" "] },
    { sample_posts: Array(6).fill("text") },
    { sample_posts: ["a".repeat(3001)] },
    { voice_traits: Array(9).fill("Warm") },
    { platform_instructions: { unsupported: "Oops" } },
  ])
    expect(brandSchema.safeParse({ ...EMPTY_BRAND, ...update }).success).toBe(
      false,
    );
});

test("Progress reflects real context and server metadata does not enter the editable payload", () => {
  expect(brandProgress(EMPTY_BRAND)).toEqual({ completed: 0, total: 5 });
  const complete = {
    ...EMPTY_BRAND,
    display_name: "Jamie",
    bio: "I build tools",
    audience: "Founders",
    voice_traits: ["Warm"],
    sample_posts: ["A short thought"],
  };
  expect(brandProgress(complete).completed).toBe(5);
  expect(
    brandValues({
      ...complete,
      id: "one",
      workspace_id: "workspace",
      updated_at: "today",
      can_edit: true,
    }),
  ).toEqual(complete);
});

test("Brand settings covers identity, voice, account-independent samples and every channel", () => {
  const render = (section) =>
    renderToStaticMarkup(
      <BrandFields section={section} draft={EMPTY_BRAND} change={() => {}} />,
    );
  const identity = render("identity");
  expect(identity).toContain("Name or brand");
  expect(identity).toContain("Who you’re writing for");
  expect(identity).toContain('for="brand-bio"');
  const voice = render("voice");
  expect(voice).toContain('aria-pressed="false"');
  expect(voice).toContain("Topics and claims to avoid");
  expect(voice).toContain("Default language");
  const samples = render("samples");
  expect(samples).toContain("No connected account is needed");
  expect(samples).toContain("secondary-btn");
  expect(samples).not.toContain("Connect LinkedIn");
  const channels = render("channels");
  for (const channel of BRAND_CHANNELS)
    expect(channels).toContain(channel.name);
  expect(renderToStaticMarkup(<BrandProfileSkeleton />)).toContain(
    'data-slot="skeleton"',
  );
});

test("Samples have accessible removal and enforced text/count limits", () => {
  const html = renderToStaticMarkup(
    <BrandFields
      section="samples"
      draft={{
        ...EMPTY_BRAND,
        sample_posts: Array(5).fill("A useful thought"),
      }}
      change={() => {}}
    />,
  );
  expect(html).toContain('aria-label="Remove sample 1"');
  expect(html).toContain('maxLength="3000"');
  expect(html).toContain("disabled");
  expect(html).toContain("5 of 5 samples");
});

test("The global composer calls current channel AI without a client-supplied brand", async () => {
  const { assistantDraftRequest } =
    await import("../src/modules/content/assistantRequest");
  const state = {
    content: "My draft",
    platform: "x",
    tone: "Direct",
    composer: {},
  };
  const request = assistantDraftRequest(
    state,
    "Improve this opening",
    "account-one",
  );
  expect(request.feature).toBe("rewrite_with_tone");
  expect(request.platform).toBe("x");
  expect(request.input_data.text).toBe("My draft");
  expect(request.input_data.tone).toContain("Direct");
  expect(request.connected_account_id).toBe("account-one");
  expect(request).not.toHaveProperty("brand");
  const fresh = assistantDraftRequest(
    { ...state, content: "", platform: "linkedin" },
    "Write about consistency",
  );
  expect(fresh.input_data.text).toBe("Write about consistency");
  expect(fresh).not.toHaveProperty("connected_account_id");
});
