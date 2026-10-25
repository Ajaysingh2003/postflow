import {
  absoluteUrl,
  SEO_PAGES,
  SITE_NAME,
  type MarketingPath,
} from "./config";
import { answerPage, ANSWER_PAGES } from "./answers";

/** Optional discovery guide: public canonical content only, never session or billing data. */
export function llmsText() {
  const paths = Object.keys(SEO_PAGES) as MarketingPath[];
  const primary = paths.filter(
    (path) => path === "/pricing" || answerPage(path),
  );
  const policies = paths.filter((path) => !primary.includes(path));
  const entry = (path: MarketingPath) =>
    `- [${SEO_PAGES[path].label}](${absoluteUrl(path)}): ${answerPage(path)?.summary ?? SEO_PAGES[path].description}`;
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${ANSWER_PAGES["/"].summary}`,
    "",
    "The linked public pages describe the product. Current prices, billing intervals and allowances are shown on the pricing page; checkout displays the final amount before payment. Platform capabilities and analytics availability depend on the connected account and provider access.",
    "",
    "## Product and company",
    "",
    ...primary.map(entry),
    "",
    "## Optional",
    "",
    ...policies.map(entry),
    "",
  ].join("\n");
}
