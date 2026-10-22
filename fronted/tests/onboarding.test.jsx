import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OnboardingPanel from "../src/modules/home/component/OnboardingPanel";
import OnboardingSkeleton from "../src/modules/home/component/OnboardingSkeleton";

const props = {
  name: "Ajay Singh",
  step: "welcome",
  accounts: [],
  canConnect: true,
  connectingPlatform: null,
  finishing: false,
  onStep() {},
  onConnect() {},
  onFinish() {},
};
const render = (changes = {}) =>
  renderToStaticMarkup(<OnboardingPanel {...props} {...changes} />);

test("onboarding is two short steps with no questionnaire and an optional exit", () => {
  const html = render();
  expect(html).toContain("Hey Ajay, welcome to Draftva");
  expect(html).toContain("Let’s get started");
  expect(html).toContain("Skip setup");
  expect(html).toContain('aria-label="Setup progress"');
  expect(html).not.toContain("<input");
  expect(html).not.toContain("<form");
  expect(html).toContain("primary-btn");
});

test("the last step uses existing channel artwork and only available connections", () => {
  const html = render({ step: "connect" });
  for (const name of [
    "Instagram",
    "LinkedIn",
    "X / Twitter",
    "Facebook",
    "Threads",
    "Bluesky",
  ])
    expect(html).toContain(`aria-label="Connect ${name}"`);
  for (const asset of [
    "instagram.svg",
    "linkedin.svg",
    "x.jpeg",
    "facebook.png",
    "threads.svg",
  ])
    expect(html).toContain(asset);
  expect(html).not.toContain("Reddit");
  expect(html).not.toContain("TikTok");
  expect(html).toContain("I’ll connect later");
  expect(html).toContain("secondary-btn");
  expect(html).toContain("Go to my workspace");
});

test("only real active connections count, while expired accounts can reconnect", () => {
  const html = render({
    step: "connect",
    accounts: [
      { platform: "x", status: "active", display_name: "Writer" },
      { platform: "threads", status: "needs_reauth", display_name: "Expired" },
      { platform: "linkedin", status: "disabled", display_name: "Disabled" },
    ],
  });
  expect(html).toContain('aria-label="Connected to X / Twitter"');
  expect(html).toContain('aria-label="Reconnect Threads"');
  expect(html).toContain('aria-label="Connect LinkedIn"');
  expect(html).toContain("1 account connected.");
  expect(html).not.toContain("I’ll connect later");
});

test("invited members can continue without channel administration", () => {
  const html = render({ step: "connect", canConnect: false });
  expect(html).toContain("Your workspace owner manages social connections");
  expect(html).toContain("Go to my workspace");
  expect(html).not.toContain('aria-label="Connect Instagram"');
});

test("connection failures preserve the exit and loading disables duplicate actions", () => {
  const html = render({
    step: "connect",
    error: "Please try again",
    connectingPlatform: "x",
  });
  expect(html).toContain('role="alert"');
  expect(html).toContain("Please try again");
  expect(html).toContain("I’ll connect later");
  expect(html).toContain('aria-label="Connecting"');
  expect((html.match(/disabled=""/g) || []).length).toBe(10);
});

test("skeleton keeps the same frame and supports reduced motion", () => {
  const html = renderToStaticMarkup(<OnboardingSkeleton />);
  expect(html).toContain('role="status"');
  expect(html).toContain("Loading your setup");
  expect(html).toContain("motion-safe:animate-pulse");
});
