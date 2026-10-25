/** Reports emitted client chunks, not unmeasured CWV/Lighthouse scores. Run after build. */
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import vm from "node:vm";
const pages = [
  "page",
  "pricing/page",
  "about/page",
  "product/ai-writer/page",
  "product/schedule/page",
  "product/analytics/page",
  "product/mcp/page",
  "product/social-integration/page",
];
const report = [];
for (const page of pages) {
  const context = {};
  vm.runInNewContext(
    readFileSync(
      `.next/server/app/(home)/${page}_client-reference-manifest.js`,
      "utf8",
    ),
    context,
  );
  const manifest = Object.values(context.__RSC_MANIFEST)[0];
  const chunks = new Set(
    Object.values(manifest.clientModules)
      .flatMap((entry) => entry.chunks)
      .filter((file) => typeof file === "string" && file.endsWith(".js")),
  );
  const entries = [...chunks]
    .map((file) => {
      const content = readFileSync(`.next/${file.replace(/^\/_next\//, "")}`);
      return {
        file,
        bytes: content.length,
        gzipBytes: gzipSync(content).length,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
  report.push({
    route: page === "page" ? "/" : "/" + page.replace(/\/page$/, ""),
    largestChunks: entries.slice(0, 5),
    referencedBytes: entries.reduce((n, c) => n + c.bytes, 0),
  });
}
writeFileSync("docs/seo/bundles.json", JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    report.map(({ route, largestChunks, referencedBytes }) => ({
      route,
      referencedBytes,
      largest: largestChunks[0],
    })),
    null,
    2,
  ),
);
