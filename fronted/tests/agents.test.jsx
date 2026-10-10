import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AGENTS,
  clientConfiguration,
  isLocalEndpoint,
  draftvaSkill,
} from "../src/modules/agents/model";
import {
  AgentsOverview,
  AgentsSkeleton,
  AgentSetup,
} from "../src/modules/agents/AgentsDialog";

test("Agents overview contains selectable supported clients and honest connection state", () => {
  const html = renderToStaticMarkup(
    <AgentsOverview onSelect={() => {}} count={0} />,
  );
  for (const agent of AGENTS) expect(html).toContain(agent.name);
  expect(html).toContain("Connection access");
  expect(html).not.toContain("Connected to Claude");
  expect(renderToStaticMarkup(<AgentsSkeleton />)).toContain(
    'data-slot="skeleton"',
  );
});

test("Setup uses configured backend URLs, client instructions and design-system buttons", () => {
  const settings = {
    mcp_url: "https://backend.example/mcp",
    connections: [],
    scopes: {},
    can_write: true,
  };
  const claude = renderToStaticMarkup(
    <AgentSetup id="claude" settings={settings} onSelect={() => {}} />,
  );
  expect(claude).toContain(settings.mcp_url);
  expect(claude).toContain("primary-btn");
  expect(claude).toContain("secondary-btn");
  expect(claude).toContain("Register automatically");
  expect(claude).not.toContain("This is a local server address");
  expect(
    renderToStaticMarkup(
      <AgentSetup
        id="chatgpt"
        settings={{ ...settings, mcp_url: "http://localhost:18000/mcp" }}
        onSelect={() => {}}
      />,
    ),
  ).toContain("public HTTPS");
});

test("Copyable client configuration and downloaded skill contain no credentials", () => {
  const url = "https://backend.example/mcp";
  expect(JSON.parse(clientConfiguration("cursor", url))).toEqual({
    mcpServers: { draftva: { url } },
  });
  expect(clientConfiguration("codex", url)).toContain(
    '[mcp_servers.draftva]\nurl = "https://backend.example/mcp"',
  );
  const skill = draftvaSkill(url);
  expect(skill).toContain(url);
  expect(skill).toContain("confirmed=true after that approval");
  expect(skill).toContain("run_ai_feature uses draftva AI credits");
  expect(skill).not.toContain("Bearer");
  expect(isLocalEndpoint("http://[::1]:18000/mcp")).toBe(true);
  expect(isLocalEndpoint(url)).toBe(false);
});
