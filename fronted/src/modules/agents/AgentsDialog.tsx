"use client";
import { Component, Suspense, useState, type ReactNode } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  SiClaude,
  SiCursor,
  SiModelcontextprotocol,
} from "@icons-pack/react-simple-icons";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AGENTS,
  SCOPE_LABELS,
  clientConfiguration,
  isLocalEndpoint,
  draftvaSkill,
  type AgentId,
  type AgentScope,
  type AgentSection,
  type AgentSettings,
} from "./model";
export function AgentMark({
  id,
  small = false,
}: {
  id: AgentId;
  small?: boolean;
}) {
  const classes = small
    ? "size-5 rounded-md [&>svg]:size-3"
    : "size-8 rounded-lg [&>svg]:size-[17px]";
  const Icon = {
    claude: SiClaude,
    chatgpt: Bot,
    mcp: SiModelcontextprotocol,
    skills: Sparkles,
    cursor: SiCursor,
    codex: Terminal,
  }[id];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        classes,
        id === "claude"
          ? "bg-[#D97757] text-white"
          : id === "chatgpt"
            ? "bg-[#10a37f]/10 text-[#10a37f]"
            : id === "skills"
              ? "bg-[#7C5CFC]/10 text-[#7C5CFC]"
              : "bg-muted text-foreground",
      )}
    >
      <Icon />
    </span>
  );
}
export function CopyField({
  value,
  label,
  secret = false,
  multiline = false,
}: {
  value: string;
  label: string;
  secret?: boolean;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }
  return (
    <div className="relative rounded-lg border border-border/70 bg-muted/20">
      {multiline ? (
        <pre
          aria-label={label}
          tabIndex={0}
          className="max-h-56 overflow-auto whitespace-pre p-3 pr-11 font-mono text-[11px] leading-[1.65]"
        >
          {value}
        </pre>
      ) : (
        <Input
          aria-label={label}
          type={secret ? "password" : "text"}
          value={value}
          readOnly
          className="h-9 border-0 bg-transparent pr-10 font-mono text-[11px] shadow-none"
        />
      )}
      <Button
        aria-label={`Copy ${label.toLowerCase()}`}
        variant="ghost"
        size="icon-sm"
        className="absolute right-1 top-1 size-7 rounded-md [&_svg]:size-3.5"
        onClick={() => void copy()}
      >
        {copied ? <Check className="text-emerald-600" /> : <Copy />}
      </Button>
    </div>
  );
}
export function AgentsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading agent connections"
      className="p-4 sm:p-6"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-3 w-2/3" />
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-5 h-16 rounded-lg" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
class ConnectionBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-2.5 p-5 text-center"
        >
          <Plug className="size-7 text-muted-foreground" />
          <DialogTitle className="text-[13px] font-semibold">
            Connections couldn’t load
          </DialogTitle>
          <DialogDescription className="sr-only">
            Retry loading your agent connections.
          </DialogDescription>
          <p className="max-w-sm text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          <Button
            variant="outline"
            className="secondary-btn mt-2"
            onClick={() => {
              this.props.retry();
              this.setState({ error: null });
            }}
          >
            <RefreshCw />
            Try again
          </Button>
        </div>
      );
    return this.props.children;
  }
}
export function AgentsOverview({
  onSelect,
  count,
}: {
  onSelect: (section: AgentSection) => void;
  count: number;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium tracking-[0.1em] text-muted-foreground">
        YOUR WORKSPACE, WHERE YOU WORK
      </p>
      <h2 className="font-heading text-[22px] font-semibold leading-tight tracking-tight">
        A little more connected.
      </h2>
      <p className="mt-2 max-w-lg text-[12px] leading-[1.65] text-muted-foreground">
        Bring Draftva into your favorite AI assistant. Pick up a draft, plan
        your next post, or find out what’s working.
      </p>
      <h3 className="mb-2 mt-6 text-[13px] font-semibold">Agents</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className="group flex min-h-[76px] items-start gap-2.5 rounded-lg border border-border/70 bg-background px-3 py-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AgentMark id={agent.id} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[12px] font-semibold leading-4">
                {agent.name}
                <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </span>
              <span className="mt-1 block text-[11px] leading-[1.5] text-muted-foreground">
                {agent.description}
              </span>
            </span>
          </button>
        ))}
      </div>
      <h3 className="mb-2 mt-6 text-[13px] font-semibold">Your connections</h3>
      <button
        onClick={() => onSelect("connections")}
        className="flex w-full items-center gap-2.5 rounded-lg border border-border/70 px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <ShieldCheck className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block text-[12px] font-semibold">Connection access</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
            {count
              ? `${count} active ${count === 1 ? "connection" : "connections"}. Review permissions or revoke access.`
              : "Choose what your agents can do. Revoke access whenever you need."}
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}
function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-2 text-[12px] font-semibold">
        <span className="inline-flex size-5 items-center justify-center rounded-md border border-border bg-muted/50 text-[10px] text-foreground">
          {number}
        </span>
        {title}
      </h3>
      <div className="space-y-2 text-[12px] leading-[1.65] text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
export function AgentSetup({
  id,
  settings,
  onSelect,
}: {
  id: AgentId;
  settings: AgentSettings;
  onSelect: (section: AgentSection) => void;
}) {
  const agent = AGENTS.find((item) => item.id === id)!;
  const url = settings.mcp_url;
  const isCloud = id === "claude" || id === "chatgpt";
  if (id === "skills")
    return (
      <div>
        <h2 className="font-heading text-[20px] font-semibold tracking-tight">Give your agent the context.</h2>
        <p className="mt-2 text-[12px] leading-[1.65] text-muted-foreground">
          A ready-to-use skill for working with Draftva: finding the right
          account, adapting drafts, checking limits, and asking before
          publishing.
        </p>
        <Step number={1} title="Connect Draftva first">
          <p>
            The skill uses your MCP connection. Set that up in your agent before
            installing the guide.
          </p>
          <Button
            variant="outline"
            className="secondary-btn"
            onClick={() => onSelect("mcp")}
          >
            <Plug />
            Set up MCP
          </Button>
        </Step>
        <Step number={2} title="Download the skill">
          <p>
            Save this file as{" "}
            <code className="font-mono text-xs">draftva/SKILL.md</code> in your
            agent’s skills folder. It contains your configured Draftva server
            URL and no credentials.
          </p>
          <Button asChild className="primary-btn">
            <a href="/api/agents/skill" download="SKILL.md">
              <Download />
              Download SKILL.md
            </a>
          </Button>
        </Step>
        <Step number={3} title="Make it part of your workflow">
          <p>
            Ask your agent: “Use Draftva to help me turn this idea into a
            draft.” The guide starts with drafts and asks for approval before
            scheduling or publishing.
          </p>
        </Step>
        <div className="mt-5">
          <CopyField
            value={draftvaSkill(url)}
            label="Draftva skill"
            multiline
          />
        </div>
      </div>
    );
  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold tracking-tight">
        Connect {id === "mcp" ? "your assistant" : agent.name} to Draftva.
      </h2>
      <p className="mt-2 text-[12px] leading-[1.65] text-muted-foreground">
        Create drafts, plan your schedule and review post performance from your
        conversations. Draftva’s writing assistant is available through the
        same connection.
      </p>
      {isCloud && isLocalEndpoint(url) && (
        <div
          role="note"
          className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300"
        >
          This is a local server address. {agent.name} needs a public HTTPS
          address to connect from the cloud. Use your deployed backend address
          in Draftva’s configuration.
        </div>
      )}
      <Step number={1} title="Copy your Draftva server URL">
        <CopyField value={url} label="Server URL" />
      </Step>
      <Step
        number={2}
        title={isCloud ? `Add Draftva in ${agent.name}` : "Add the MCP server"}
      >
        {id === "claude" ? (
          <>
            <p>
              Open Claude’s connector settings and add a custom web connector
              named Draftva. Paste your server URL, choose OAuth sign-in, and
              select “Register automatically” for the OAuth client.
            </p>
            <Button asChild className="primary-btn">
              <a
                href="https://claude.ai/settings/connectors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowUpRight />
                Open Claude connectors
              </a>
            </Button>
          </>
        ) : id === "chatgpt" ? (
          <>
            <p>
              Open ChatGPT’s settings and add a custom MCP connection in Apps or
              Plugins. Use your Draftva server URL and OAuth authentication.
              Custom connections may require developer mode or workspace admin
              access.
            </p>
            <Button asChild className="primary-btn">
              <a
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowUpRight />
                Open ChatGPT
              </a>
            </Button>
          </>
        ) : id === "codex" ? (
          <>
            <p>
              Add this to your Codex MCP configuration, then sign in with{" "}
              <code className="font-mono text-xs">
                codex mcp login draftva
              </code>
              .
            </p>
            <CopyField
              value={clientConfiguration(id, url)}
              label="Codex configuration"
              multiline
            />
          </>
        ) : (
          <>
            <p>
              {id === "cursor"
                ? "Add Draftva to Cursor’s MCP settings using this configuration, then use the server’s sign-in action."
                : "Add a remote Streamable HTTP server in your MCP client. Use OAuth to sign in; clients that support custom headers can also use a scoped token from Connection access."}
            </p>
            <CopyField
              value={clientConfiguration(id, url)}
              label="MCP configuration"
              multiline
            />
          </>
        )}
      </Step>
      <Step number={3} title="Approve your workspace access">
        <p>
          Sign in to Draftva and review the requested permissions. Your
          connection stays tied to the workspace you approve. Your social
          account passwords and access tokens are never shared with the agent.
        </p>
      </Step>
      <Step number={4} title="Try your first conversation">
        <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 text-[12px] text-foreground">
          “Show my connected accounts and help me draft my next post.”
        </div>
        <p>
          For Draftva AI, ask the agent to list the channel’s writing features.
          These runs use your plan’s AI allowance.
        </p>
      </Step>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="secondary-btn"
          onClick={() => onSelect("guide")}
        >
          <BookOpen />
          Read the guide
        </Button>
        <Button variant="ghost" onClick={() => onSelect("connections")}>
          <KeyRound />
          Connection access
        </Button>
      </div>
    </div>
  );
}
export function AgentGuide() {
  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold tracking-tight">
        Your Draftva workflow, in a conversation.
      </h2>
      <p className="mt-2 text-[12px] leading-[1.65] text-muted-foreground">
        Connect once, then use these tools with your agent. Every connection
        respects your workspace permissions and publishing rules.
      </p>
      <div className="mt-5 space-y-2">
        {[
          {
            icon: FileText,
            title: "Find your next idea",
            text: "Read your connected accounts and existing posts. Create a draft for the right channel, then edit that version without changing the others.",
            prompt: "Show my drafts and help me finish the most recent one.",
          },
          {
            icon: Sparkles,
            title: "Write with your channel in mind",
            text: "Discover Draftva’s platform-specific writing features. Use them to refine a hook, write a thread or adapt a draft. These runs use your included AI credits.",
            prompt:
              "What writing features are available for my Threads account?",
          },
          {
            icon: Plug,
            title: "Plan when it goes live",
            text: "Check the post first. Your agent asks you to approve the content, account and time before scheduling or publishing. Scheduled posts use the same quota and queue as the app.",
            prompt:
              "Check this draft and prepare it for tomorrow at 10 AM in my timezone.",
          },
          {
            icon: BookOpen,
            title: "Learn what resonates",
            text: "Review analytics for the selected connected account, including posts published outside Draftva when the platform API returns them.",
            prompt:
              "Which posts performed best on this account in the last 30 days?",
          },
        ].map(({ icon: Icon, title, text, prompt }) => (
          <section key={title} className="rounded-lg border border-border/70 p-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4 text-[#7C5CFC]" />
              {title}
            </h3>
            <p className="mt-1.5 text-[12px] leading-[1.6] text-muted-foreground">
              {text}
            </p>
            <p className="mt-2 rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed">
              “{prompt}”
            </p>
          </section>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        MCP access itself doesn’t use AI credits. Calling Draftva’s writing
        assistant does. Your agent provider may have its own usage limits.
      </p>
    </div>
  );
}
function ConnectionAccess({
  settings,
  workspaceId,
}: {
  settings: AgentSettings;
  workspaceId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<AgentScope[]>(["draftva:read"]);
  const [token, setToken] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.agents.settings.queryKey({ workspace_id: workspaceId }),
    });
  const create = useMutation(
    trpc.agents.createToken.mutationOptions({
      onSuccess: (result) => {
        setToken(result.token);
        setName("");
        setError(null);
        void refresh();
      },
      onError: (failure) => setError(failure.message),
    }),
  );
  const revoke = useMutation(
    trpc.agents.revoke.mutationOptions({
      onSuccess: () => {
        setRevokeId(null);
        setToken(null);
        void refresh();
        toast.success("Connection revoked");
      },
      onError: (failure) => setError(failure.message),
    }),
  );
  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold tracking-tight">You’re in control.</h2>
      <p className="mt-2 text-[12px] leading-[1.65] text-muted-foreground">
        Manage your agent connections for this workspace. Revoking access stops
        both the connection and its refresh tokens.
      </p>
      <section className="mt-5">
        <h3 className="mb-2 text-[13px] font-semibold">Active connections</h3>
        {settings.connections.length ? (
          <div className="divide-y divide-border rounded-lg border border-border/70">
            {settings.connections.map((connection) => (
              <div key={connection.id} className="p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                    <Plug className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {connection.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {connection.kind === "oauth"
                        ? "OAuth connection"
                        : "Scoped token"}{" "}
                      · Expires{" "}
                      {new Date(connection.expires_at).toLocaleDateString()}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => setRevokeId(connection.id)}
                  >
                    Revoke
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {connection.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {SCOPE_LABELS[scope]}
                    </span>
                  ))}
                </div>
                {revokeId === connection.id && (
                  <div
                    role="alert"
                    className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2.5"
                  >
                    <p className="flex-1 text-xs">
                      Disconnect {connection.name}? It will need to sign in
                      again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="secondary-btn"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate({
                          id: connection.id,
                          workspace_id: workspaceId,
                        })
                      }
                    >
                      {revoke.isPending && <Loader2 className="animate-spin" />}
                      Revoke access
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => setRevokeId(null)}
                    >
                      Keep
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <Plug className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-[12px] font-medium">No agents connected yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Connect an agent with OAuth, or create a scoped token below.
            </p>
          </div>
        )}
      </section>
      <section className="mt-6 rounded-lg border border-border/70 p-4">
        <h3 className="text-[13px] font-semibold">Create a scoped token</h3>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          For MCP clients that accept an Authorization header. Tokens expire
          after 90 days and work only in this workspace.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            create.mutate({
              name: name.trim(),
              scopes,
              workspace_id: workspaceId,
            });
          }}
          className="mt-3 space-y-3"
        >
          <label className="block text-xs font-medium">
            Connection name
            <Input
              aria-label="Connection name"
              placeholder="My MCP client"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={160}
              required
              className="mt-1.5"
            />
          </label>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-3 text-xs font-medium">Permissions</legend>
            {(Object.keys(SCOPE_LABELS) as AgentScope[]).map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-xs">
                <Switch
                  className="primary-switch"
                  checked={scopes.includes(scope)}
                  disabled={scope === "draftva:read" || !settings.can_write}
                  onCheckedChange={(checked) =>
                    setScopes((current) =>
                      checked
                        ? [...current, scope]
                        : current.filter((item) => item !== scope),
                    )
                  }
                />
                {SCOPE_LABELS[scope]}
              </label>
            ))}
          </fieldset>
          <Button
            className="primary-btn"
            disabled={create.isPending || !name.trim()}
          >
            {create.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <KeyRound />
            )}
            Create token
          </Button>
        </form>
        {token && (
          <div
            role="status"
            className="mt-4 space-y-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
          >
            <p className="text-xs font-medium">
              Copy your token now. It is shown once.
            </p>
            <CopyField value={token} label="Agent token" secret />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Set the header{" "}
              <code className="font-mono">
                Authorization: Bearer YOUR_TOKEN
              </code>{" "}
              in your MCP client. Keep this token private.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
              I’ve saved it
            </Button>
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="mt-4 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
function ConnectedDialog({
  section,
  onSelect,
}: {
  section: AgentSection;
  onSelect: (section: AgentSection) => void;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useSuspenseQuery(
    trpc.workspace.current.queryOptions(),
  );
  const { data: settings } = useSuspenseQuery(
    trpc.agents.settings.queryOptions(
      { workspace_id: workspace.id },
      { staleTime: 30000, refetchOnWindowFocus: true, retry: 1 },
    ),
  );
  const selected = AGENTS.find((agent) => agent.id === section);
  return (
    <>
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border/70 px-4 py-3 pr-12 sm:px-5">
        {section !== "overview" && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to agents and integrations"
            onClick={() => onSelect("overview")}
          >
            <ArrowLeft />
          </Button>
        )}
        {selected ? (
          <AgentMark id={selected.id} small />
        ) : (
          <Plug className="size-5 text-[#7C5CFC]" />
        )}
        <span>
          <DialogTitle className="font-sans text-[13px] font-semibold">
            {selected?.name ??
              (section === "connections"
                ? "Connection access"
                : section === "guide"
                  ? "Draftva guide"
                  : "Agents & integrations")}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[11px]">
            {selected ? "Connection settings" : workspace.name}
          </DialogDescription>
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <aside className="shrink-0 border-b border-border/70 bg-muted/15 px-2 py-2 sm:w-[176px] sm:border-b-0 sm:border-r sm:px-2.5 sm:py-3">
          <nav
            aria-label="Agent settings"
            className="flex gap-0.5 overflow-x-auto sm:flex-col"
          >
            <button
              onClick={() => onSelect("overview")}
              aria-current={section === "overview" ? "page" : undefined}
              className={cn(
                "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                section === "overview" && "bg-foreground/[0.07] font-semibold text-foreground",
              )}
            >
              <Plug className="size-4" />
              Overview
            </button>
            <p className="mb-1 mt-3 hidden px-2 text-[10px] font-medium tracking-wide text-muted-foreground sm:block">
              AGENTS
            </p>
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelect(agent.id)}
                aria-current={section === agent.id ? "page" : undefined}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  section === agent.id && "bg-foreground/[0.07] font-semibold text-foreground",
                )}
              >
                <AgentMark id={agent.id} small />
                {agent.name}
              </button>
            ))}
            <div className="my-2 hidden border-t border-border/70 sm:block" />
            <button
              onClick={() => onSelect("connections")}
              aria-current={section === "connections" ? "page" : undefined}
              className={cn(
                "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                section === "connections" && "bg-foreground/[0.07] font-semibold text-foreground",
              )}
            >
              <KeyRound className="size-4" />
              Connections
              <span className="ml-auto rounded bg-background px-1.5 py-0.5 text-[10px]">
                {settings.connections.length}
              </span>
            </button>
            <button
              onClick={() => onSelect("guide")}
              aria-current={section === "guide" ? "page" : undefined}
              className={cn(
                "flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                section === "guide" && "bg-foreground/[0.07] font-semibold text-foreground",
              )}
            >
              <CircleHelp className="size-4" />
              Quick guide
            </button>
          </nav>
          
        </aside>
        <div
          key={`${workspace.id}:${section}`}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
        >
          {section === "overview" ? (
            <AgentsOverview
              onSelect={onSelect}
              count={settings.connections.length}
            />
          ) : section === "connections" ? (
            <ConnectionAccess
              key={workspace.id}
              workspaceId={workspace.id}
              settings={settings}
            />
          ) : section === "guide" ? (
            <AgentGuide />
          ) : (
            <AgentSetup
              key={section}
              id={section}
              settings={settings}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </>
  );
}
export default function AgentsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<AgentSection>("overview");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(720px,88svh)] max-h-[88svh] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-xl border border-border/70 p-0 shadow-2xl sm:max-w-[800px] [&_button]:text-[12px] [&_button]:leading-4 [&_button_svg]:shrink-0 [&_input]:text-[12px]"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close agents and integrations"
          className="absolute right-2.5 top-2.5 z-10 size-7 rounded-md"
          onClick={() => onOpenChange(false)}
        >
          <X />
        </Button>
        <ConnectionBoundary
          retry={() => {
            void queryClient.resetQueries({
              queryKey: trpc.agents.settings.queryKey(),
            });
            void queryClient.resetQueries({
              queryKey: trpc.workspace.current.queryKey(),
            });
          }}
        >
          <Suspense
            fallback={
              <>
                <DialogTitle className="sr-only">
                  Agents & integrations
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Connect your AI assistant to Draftva.
                </DialogDescription>
                <AgentsSkeleton />
              </>
            }
          >
            <ConnectedDialog section={section} onSelect={setSection} />
          </Suspense>
        </ConnectionBoundary>
      </DialogContent>
    </Dialog>
  );
}
