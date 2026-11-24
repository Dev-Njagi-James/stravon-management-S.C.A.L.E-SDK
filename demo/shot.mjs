import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(__dirname, "out");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/demo/index.html";
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
const baseUrl = `http://localhost:${port}`;

const ids = [
  "ok-default",
  "ok-brand",
  "warn80-default",
  "warn80-brand",
  "upgrade90-default",
  "upgrade90-brand",
  "overage-default",
  "overage-brand",
  "expired-default",
  "expired-brand",
  "loading-default",
  "loading-brand",
  "error-default",
  "error-brand",
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 560, height: 900 },
  deviceScaleFactor: 2,
});

await mkdir(outDir, { recursive: true });

try {
  await page.goto(`${baseUrl}/demo/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  for (const id of ids) {
    const el = page.locator(`#${id}`);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const outPath = path.join(outDir, `${id}.png`);
    await el.screenshot({ path: outPath });
    console.log("saved", path.relative(root, outPath));
  }
} finally {
  await browser.close();
  server.close();
}