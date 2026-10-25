# Rendered SEO route audit

Local test origin: `http://localhost:3002`. Anonymous requests using Twitterbot user agent. Private-page redirects report the response before following it. Catch-all settings path represents all its sections.

| Route | Status | Title | Meta description | H1 | Canonical | Indexable? | Issues |
|---|---|---|---|---|---|---|---|
| /forgot-password | 200 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | missing canonical; H1 count !=1; duplicate title; duplicate description |
| /invitations/accept | 200 | Accept invitation · Draftva | Sign in to manage your Draftva workspace. | Invitation unavailable |  | no | missing canonical; duplicate description |
| /login | 200 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. | Sign in to Draftva |  | no | missing canonical; duplicate title; duplicate description |
| /register | 200 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. | Create your Draftva account |  | no | missing canonical; duplicate title; duplicate description |
| /reset-password | 200 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | missing canonical; H1 count !=1; duplicate title; duplicate description |
| /verify-email | 200 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | missing canonical; H1 count !=1; duplicate title; duplicate description |
| /verify-otp | 200 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | missing canonical; H1 count !=1; duplicate title; duplicate description |
| /about | 200 | About Our Social Writing Platform &#124; Draftva | Meet the person behind Draftva and the ideas shaping a simpler way to write, schedule and publish across social channels. Read our story. | Built small, on purpose. | https://draftva.com/about | yes | none |
| / | 200 | AI Social Post Writer & Scheduler &#124; Draftva | Write in your own voice and schedule posts for X, LinkedIn and Threads from one workspace. Build your brand with Draftva. Start free. | The AI-powered engine for content & growth. | https://draftva.com | yes | none |
| /pricing | 200 | Social Media Scheduling Plans & Pricing &#124; Draftva | Compare Draftva plans for AI writing, social scheduling and brand voices. Choose Free or find a paid plan for your workflow. Explore pricing. | Transparent pricing for every scale | https://draftva.com/pricing | yes | none |
| /product/ai-writer | 200 | AI Post Writer for X, LinkedIn & Threads &#124; Draftva | Turn ideas into social posts with Draftva's AI writing assistant. Refine your tone and tailor drafts for X, LinkedIn and Threads. Start free. | Think it. Write it. Perfect it with AI. | https://draftva.com/product/ai-writer | yes | none |
| /product/analytics | 200 | Social Media Post Analytics &#124; Draftva | Review post performance across your connected social accounts. Use Draftva analytics to understand engagement and plan your next post. Explore features. | Track What works. Double down on what grows. | https://draftva.com/product/analytics | yes | none |
| /product/mcp | 200 | MCP Server for Social Post Scheduling &#124; Draftva | Connect AI tools to Draftva through MCP. Create drafts and manage your social publishing workflow from your assistant. Explore the connection options. | Prompt Once. Publish straight from your AI. | https://draftva.com/product/mcp | yes | none |
| /product/schedule | 200 | Social Media Post Scheduler &#124; Draftva | Plan drafts and schedule posts for X, LinkedIn and Threads in one workspace. Keep your publishing queue organized with Draftva. Start free. | Create Today. Publish at the perfect moment. | https://draftva.com/product/schedule | yes | none |
| /product/social-integration | 200 | Social Media Account Integrations &#124; Draftva | Bring your social accounts into one publishing workspace. Connect X, LinkedIn and Threads to write and schedule with Draftva. Explore integrations. | Connect Once. Publish across every channel. | https://draftva.com/product/social-integration | yes | none |
| /acceptable-use | 200 | Acceptable Use Policy &#124; Draftva | Review Draftva's rules for responsible publishing, including restrictions on spam, scraping and manipulation. Read the acceptable use policy. | Acceptable Use Policy | https://draftva.com/acceptable-use | yes | none |
| /cookie-policy | 308 |  |  |  |  | no | redirect to /cookies |
| /cookies | 200 | Cookie Policy &#124; Draftva | Understand how Draftva uses cookies and local storage for sessions and workspace preferences. Review the cookie policy and your choices. | Cookie Policy | https://draftva.com/cookies | yes | none |
| /dpa | 200 | Data Processing Addendum &#124; Draftva | Read Draftva's data processing terms, responsibilities and safeguards. Review the addendum and contact details for data processing inquiries. | Data Processing Addendum (DPA) | https://draftva.com/dpa | yes | none |
| /legal | 200 | Legal Policies & Service Terms &#124; Draftva | Find Draftva's service terms, privacy policy, cookie policy and data processing documents in one place. Review the policies for your workspace. | Draftva Legal & Compliance Hub | https://draftva.com/legal | yes | none |
| /privacy | 200 | Privacy Policy &#124; Draftva | Learn how Draftva handles personal data, connected accounts and privacy requests. Read the privacy policy before connecting your social channels. | Privacy Policy | https://draftva.com/privacy | yes | none |
| /privacy-policy | 308 |  |  |  |  | no | redirect to /privacy |
| /sub-processors | 308 |  |  |  |  | no | redirect to /subprocessors |
| /subprocessors | 200 | Sub-processors Directory &#124; Draftva | Review the service providers listed in Draftva's sub-processors directory. Learn about their roles and how to raise data protection questions. | Sub-processors Directory | https://draftva.com/subprocessors | yes | none |
| /terms | 200 | Terms of Service &#124; Draftva | Read Draftva's service terms covering accounts, subscriptions, content ownership and platform use. Review your rights and responsibilities. | Terms of Service | https://draftva.com/terms | yes | none |
| /terms-of-service | 308 |  |  |  |  | no | redirect to /terms |
| /onboarding | 200 | Welcome to Draftva | Sign in to manage your Draftva workspace. |  |  | no | missing canonical; H1 count !=1; duplicate description |
| /dashboard/agents/authorize | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/agents | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/analytics | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/channels | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/content/compose | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/content/generator | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/content | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/posts | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/schedule | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /dashboard/settings | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /settings/billing | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
| /settings | 307 | Your workspace &#124; Draftva | Sign in to manage your Draftva workspace. |  |  | no | redirect to /login |
