/** Rebuild labelled social/portrait placeholders; replace these files with approved artwork. */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { SEO_PAGES } from "../src/lib/seo/config.ts";
await mkdir("public/images/og", { recursive: true });
await mkdir("public/images/brand", { recursive: true });
await mkdir("public/images/placeholders", { recursive: true });
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
for (const page of Object.values(SEO_PAGES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#faf9f5"/><rect x="64" y="64" width="1072" height="502" rx="28" fill="white" stroke="#dcdfd6"/><rect x="110" y="112" width="70" height="8" rx="4" fill="#3fda8a"/><text x="110" y="218" fill="#11120e" font-family="sans-serif" font-size="66" font-weight="700">Draftva</text><text x="110" y="305" fill="#166643" font-family="sans-serif" font-size="38">${escape(page.label === "Home" ? "AI social post writer &amp; scheduler".replaceAll("&amp;", "&") : page.label)}</text><text x="110" y="474" fill="#71756a" font-family="sans-serif" font-size="24">draftva.com</text><text x="110" y="516" fill="#9a9d96" font-family="sans-serif" font-size="16">Social image placeholder · replace with approved artwork</text></svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(`public/images/og/${page.image}.png`);
}
const portrait = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#e9ebe7"/><circle cx="80" cy="59" r="27" fill="#b9beb5"/><path d="M22 160v-15a58 58 0 01116 0v15" fill="#b9beb5"/></svg>`;
await sharp(Buffer.from(portrait))
  .png()
  .toFile("public/images/placeholders/home-testimonial-portrait.png");
await sharp("public/images/brand/draftva-logo.jpg")
  .resize(64, 64)
  .png()
  .toFile("public/images/brand/draftva-icon.png");
await sharp("public/images/brand/draftva-logo.jpg")
  .resize(180, 180)
  .png()
  .toFile("public/images/brand/draftva-apple-icon.png");
// PNG embedded in ICO is supported by modern browsers and avoids the old framework favicon.
const png = await sharp("public/images/brand/draftva-icon.png")
  .ensureAlpha()
  .png()
  .toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 64;
header[7] = 64;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("src/app/favicon.ico", Buffer.concat([header, png]));
