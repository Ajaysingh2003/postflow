import { BarChart3, CalendarDays, Feather, GalleryHorizontalEnd, MessageCircle, Plug, Users, Workflow, BriefcaseBusiness, Building2, PenLine, ListChecks, Send, Inbox } from "lucide-react";

export const products = [
  { title: "AI post creation", description: "Generate complete posts in your voice.", detail: "Turn an idea, a link, or a rough note into a complete AI-generated LinkedIn post.", icon: Feather, href: "#feature-create", kind: "write" },
  { title: "Schedule", description: "Give every post a place in your week.", detail: "Plan your calendar and queue posts for the times you choose.", icon: CalendarDays, href: "#feature-schedule", kind: "plan" },
  { title: "Growth playbooks", description: "Put your next steps in order.", detail: "Repeatable routines for publishing, new connections, and thoughtful follow-ups.", icon: ListChecks, href: "#feature-playbooks", kind: "playbooks" },
  { title: "Carousels", description: "Shape your post. Design every slide.", detail: "Give an idea more room with a sequence of slides, ready for LinkedIn.", icon: GalleryHorizontalEnd, href: "#feature-carousels", kind: "slides" },
  { title: "Analyse", description: "Understand what’s working.", detail: "Follow content performance and audience growth to decide what to share next.", icon: BarChart3, href: "#feature-analyse", kind: "grow" },
  { title: "Engage", description: "Be part of the conversation.", detail: "Keep track of relevant posts and make time for thoughtful replies.", icon: MessageCircle, href: "#feature-engage", kind: "engage" },
  { title: "Connect", description: "Start the right conversations.", detail: "Organise prospects, make connections, and follow up with personal messages.", icon: Users, href: "#feature-connect", kind: "connect" },
  { title: "Automate", description: "Keep the follow-through moving.", detail: "Build repeatable connection and follow-up sequences around your workflow.", icon: Workflow, href: "#feature-automate", kind: "automate" },
  { title: "MCP & integrations", description: "Work from your AI assistant.", detail: "Bring LinkedIn tasks into compatible AI assistants through MCP, alongside your other work.", icon: Plug, href: "#feature-mcp", kind: "mcp" },
];
export const solutions = [
  { title: "Founders", description: "Build your network with your business.", detail: "Share what you’re building, connect with potential customers, and keep conversations moving.", icon: BriefcaseBusiness, href: "#solution-founders", kind: "founders" },
  { title: "Creators & consultants", description: "Make your expertise easier to find.", detail: "Develop a publishing rhythm, learn what resonates, and turn your expertise into new relationships.", icon: PenLine, href: "#solution-creators", kind: "creators" },
  { title: "Sales teams", description: "From relevant people to real replies.", detail: "Bring prospecting, personal outreach, and follow-ups together with the content that builds trust.", icon: Users, href: "#solution-sales", kind: "sales" },
  { title: "Agencies", description: "Give every client a consistent presence.", detail: "Plan content, coordinate publishing, and track performance across your client work.", icon: Building2, href: "#solution-agencies", kind: "agencies" },
];

export const outreach = [
  { title: "Lead lists", description: "Start with the people who fit.", detail: "Bring your prospects into focused lists, ready for a relevant introduction.", icon: Users, href: "#outreach-leads", kind: "prospects" },
  { title: "Personalised outreach", description: "Make every introduction feel personal.", detail: "Create connection requests and messages around the person behind the profile.", icon: Send, href: "#outreach-personalise", kind: "personalise" },
  { title: "Automated sequences", description: "Give your follow-ups a thoughtful rhythm.", detail: "Connect requests, delays, and follow-up messages in one repeatable workflow.", icon: Workflow, href: "#outreach-sequences", kind: "sequences" },
  { title: "Conversations", description: "Keep track of replies and next steps.", detail: "Move from automated introductions to real conversations with interested prospects.", icon: Inbox, href: "#outreach-inbox", kind: "inbox" },
  { title: "Campaign analytics", description: "Learn what gets a reply.", detail: "Review connections and replies to refine your next outreach campaign.", icon: BarChart3, href: "#outreach-analytics", kind: "analytics" },
];
