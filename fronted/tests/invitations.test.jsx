import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRPCReactProvider } from "../src/trpc/client";
import InvitationView from "../src/modules/workspace/InvitationView";
import {
  authSwitchHref,
  nextAuthPath,
  verificationPath,
} from "../src/modules/user/authFlow";
const token = "complete-invitation-token-which-must-survive-all-redirects";
const next = `/invitations/accept?${new URLSearchParams({ token })}`;
const render = (props) =>
  renderToStaticMarkup(
    <TRPCReactProvider>
      <InvitationView token={token} {...props} />
    </TRPCReactProvider>,
  );
const preview = {
  status: "pending",
  workspace_name: "Studio & friends",
  role: "editor",
  email_hint: "a•••@example.com",
};
test("anonymous invitation offers sign in and registration without accepting automatically", () => {
  const html = render({ preview });
  expect(html).toContain("Studio &amp; friends");
  expect(html).toContain("Sign in to accept");
  expect(html).toContain("Create an account");
  expect(html).toContain(encodeURIComponent(next));
  expect(html).not.toContain("Accept invitation</button>");
});
test("sign-in, registration switches and verification retain the whole invitation link", () => {
  const search = new URLSearchParams({ next }).toString();
  for (const path of ["/login", "/register"])
    expect(nextAuthPath(authSwitchHref(path, search).split("?")[1])).toBe(next);
  expect(
    new URL(
      verificationPath("a@example.com", next),
      "https://draftva.invalid",
    ).searchParams.get("next"),
  ).toBe(next);
  expect(authSwitchHref("/login", "next=https://evil.example")).toBe(
    "/login?next=%2Fdashboard",
  );
});
test("signed-in invite requires explicit acceptance and offers account switching", () => {
  const html = render({ preview, email: "other@example.com" });
  expect(html).toContain("Accept invitation");
  expect(html).toContain("Use a different account");
  expect(html).toContain("other@example.com");
  expect(html).toContain("primary-btn");
  expect(html).toContain("secondary-btn");
});
test("expired, replaced and used links do not expose an acceptance action", () => {
  for (const props of [
    { error: "This invitation has expired. Ask for a new one" },
    { preview: { status: "accepted" } },
    { error: "This invitation is invalid" },
  ]) {
    const html = render(props);
    expect(html).not.toContain("Accept invitation</button>");
    expect(html).toContain("7 days");
  }
});
