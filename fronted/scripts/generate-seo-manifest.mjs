/** Build-time route discovery: no runtime filesystem/git dependency in a deployment. */
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = process.cwd();
function dependencies(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const match of readFileSync(file, "utf8").matchAll(
    /(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g,
  )) {
    const id = match[1];
    if (!id.startsWith("@/") && !id.startsWith(".")) continue;
    const base = id.startsWith("@/")
      ? join(root, "src", id.slice(2))
      : resolve(dirname(file), id);
    const source = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ].find((p) => existsSync(p) && statSync(p).isFile());
    if (source && /\.[jt]sx?$/.test(source)) dependencies(source, seen);
  }
  return seen;
}
function lastModified(page) {
  const files = [...dependencies(page)].map((file) => relative(root, file));
  // Track real source changes, not the timestamp of every request/build.
  let date;
  try {
    const committed = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", ...files],
      { encoding: "utf8" },
    ).trim();
    if (committed) date = new Date(committed);
    const dirty = execFileSync(
      "git",
      ["status", "--porcelain", "--", ...files],
      { encoding: "utf8" },
    ).trim();
    if (dirty)
      for (const file of files)
        if (statSync(file).mtime > (date ?? new Date(0)))
          date = statSync(file).mtime;
  } catch {
    /* Source archives without .git use the latest actual source mtime. */
  }
  return (
    date ?? new Date(Math.max(...files.map((file) => statSync(file).mtimeMs)))
  ).toISOString();
}
const pages = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    if (entry.name !== "page.tsx") continue;
    const source = readFileSync(file, "utf8");
    if (source.includes("permanentRedirect(")) continue;
    const route =
      "/" +
      relative(join(root, "src/app"), dirname(file))
        .split("/")
        .filter((part) => !part.startsWith("("))
        .join("/");
    const metadataPath = source.match(/seoMetadata\(["']([^"']+)["']\)/)?.[1];
    if (!metadataPath || metadataPath !== route)
      throw new Error(
        `SEO metadata missing/mismatched: ${relative(root, file)}`,
      );
    pages.push({ path: route, lastModified: lastModified(file) });
  }
}
walk(join(root, "src/app/(home)"));
walk(join(root, "src/app/(legal)"));
pages.sort((a, b) => a.path.localeCompare(b.path));
writeFileSync(
  "src/lib/seo/routes.generated.json",
  JSON.stringify(pages, null, 2) + "\n",
);
console.log(`Generated sitemap manifest for ${pages.length} marketing routes.`);
