import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TRPCReactProvider } from "../src/trpc/client";
import { SocialAuthChoices } from "../src/modules/user/component/SocialAuthButtons";
import {
  readXLoginCookie,
  socialErrorMessage,
  xLoginStartPath,
} from "../src/modules/user/socialAuth";

const render = (props) =>
  renderToStaticMarkup(
    <TRPCReactProvider>
      <SocialAuthChoices {...props} />
    </TRPCReactProvider>,
  );

test("both social buttons remain visible before setup, without dead enabled controls", () => {
  const html = render({});
  expect(html).toContain("Continue with Google");
  expect(html).toContain("Continue with X");
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).toContain("You can use email below");
  expect(html).toContain("secondary-btn");
});

test("configured X and loading Google keep the email form usable and show honest errors", () => {
  const html = render({
    xEnabled: true,
    error: socialErrorMessage("cancelled"),
  });
  expect(html.match(/disabled=""/g)).toHaveLength(1);
  expect(html).toContain('role="alert"');
  expect(html).toContain("X sign-in was cancelled");
  expect(render({ loading: true })).not.toContain(
    "currently unavailable. You can use email below",
  );
  expect(render({ googleClientId: "public-google-client" })).toContain(
    "Continue with Google",
  );
});

test("sign-in cookie and redirect helpers reject malformed data and external destinations", () => {
  expect(readXLoginCookie("not json")).toBeNull();
  expect(readXLoginCookie(JSON.stringify({ state: "short" }))).toBeNull();
  const valid = {
    browser_token: "a".repeat(43),
    state: "b".repeat(43),
    next: "//evil.example",
    return_to: "/register",
  };
  expect(readXLoginCookie(JSON.stringify(valid)).next).toBe("/dashboard");
  expect(
    readXLoginCookie(
      JSON.stringify({ ...valid, return_to: "https://evil.example" }),
    ),
  ).toBeNull();
  expect(xLoginStartPath("/dashboard/posts?tab=drafts", true)).toContain(
    "return_to=%2Fregister",
  );
  expect(xLoginStartPath("//evil.example")).toContain("next=%2Fdashboard");
  expect(socialErrorMessage("<script>provider error</script>")).toBeNull();
  expect(socialErrorMessage("__proto__")).toBeNull();
});
