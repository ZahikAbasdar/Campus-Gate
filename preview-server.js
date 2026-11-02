import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(root, "frontend", "dist-demo");
const rolesByToken = new Map([["demo-admin-session", "admin"], ["demo-guard-session", "guard"]]);
const now = Math.floor(Date.now() / 1000);
const vehicles = [
  { _id: "sample-vehicle-1", plate: "DEMO-204", ownerName: "Avery Morgan", department: "Library Services" },
  { _id: "sample-vehicle-2", plate: "DEMO-318", ownerName: "Jordan Lee", department: "Engineering" },
  { _id: "sample-vehicle-3", plate: "DEMO-527", ownerName: "Taylor Quinn", department: "Campus Dining" },
];
const logs = [
  { logId: 1042, plate: "DEMO-204", action: "ENTRY", gateId: 1, timestamp: now - 900, txHash: "SAMPLE-NOT-A-TRANSACTION" },
  { logId: 1041, plate: "DEMO-318", action: "EXIT", gateId: 2, timestamp: now - 3600, txHash: "SAMPLE-NOT-A-TRANSACTION" },
  { logId: 1040, plate: "DEMO-527", action: "ENTRY", gateId: 3, timestamp: now - 7200, txHash: "SAMPLE-NOT-A-TRANSACTION" },
  { logId: 1039, plate: "DEMO-204", action: "EXIT", gateId: 1, timestamp: now - 10800, txHash: "SAMPLE-NOT-A-TRANSACTION" },
];
const inside = vehicles.slice(0, 2);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function json(res, status, value) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8192) throw Object.assign(new Error("Request body is too large"), { status: 413 });
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 });
  }
}

function requireDemoSession(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const role = rolesByToken.get(token);
  if (!role) {
    json(res, 401, { error: "Please sign in with a demo account" });
    return null;
  }
  return role;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, { status: "ok", mode: "read-only-demo" });
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readJson(req);
    const role = body.username === "admin" || body.username === "guard" ? body.username : null;
    if (!role || body.password !== "demo123") {
      return json(res, 401, { error: "Use admin or guard with the demo password shown on the sign-in page" });
    }
    const token = role === "admin" ? "demo-admin-session" : "demo-guard-session";
    return json(res, 200, { token, role });
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return json(res, 405, { error: "This preview is read-only; changes are disabled" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const role = requireDemoSession(req, res);
  if (!role) return;
  if (url.pathname === "/api/inside") return json(res, 200, inside);
  if (url.pathname === "/api/vehicles") return json(res, 200, vehicles);
  if (url.pathname === "/api/logs") {
    const plate = (url.searchParams.get("plate") || "").trim().toUpperCase();
    return json(res, 200, logs.filter((log) => !plate || log.plate.includes(plate)));
  }
  const verifyMatch = url.pathname.match(/^\/api\/verify\/([^/]+)$/);
  if (verifyMatch) {
    const id = Number(verifyMatch[1]);
    if (!Number.isSafeInteger(id) || id < 0) return json(res, 400, { error: "Log number must be a non-negative integer" });
    const log = logs.find((item) => item.logId === id);
    if (!log) return json(res, 404, { error: "No sample record found for that log number" });
    return json(res, 200, {
      match: true,
      sampleRecord: { logId: log.logId, plate: log.plate, action: log.action, gateId: log.gateId, timestamp: log.timestamp },
      disclaimer: "Fictional sample only. No database or blockchain was queried.",
    });
  }
  if (url.pathname === "/api/wallet/config") {
    return json(res, 403, { error: "Wallet connection is unavailable in the read-only preview" });
  }
  return json(res, 404, { error: "Demo API route not found" });
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end("Invalid path");
  }
  const requested = path.resolve(dist, `.${pathname === "/" ? "/index.html" : pathname}`);
  const relative = path.relative(dist, requested);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  let file = requested;
  let contents;
  try {
    contents = await readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (path.extname(pathname) || pathname.startsWith("/assets/")) {
      res.writeHead(404);
      return res.end("Not found");
    }
    file = path.join(dist, "index.html");
    contents = await readFile(file);
  }

  res.writeHead(200, {
    "Cache-Control": path.basename(file) === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(req.method === "HEAD" ? undefined : contents);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const handler = url.pathname === "/api" || url.pathname.startsWith("/api/")
    ? handleApi(req, res, url)
    : serveStatic(req, res, url);
  handler.catch((error) => {
    console.error("Preview request failed:", error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : "Preview request failed" });
    else res.destroy(error);
  });
});

const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
server.listen(port, "0.0.0.0", () => {
  console.log(`Campus Gate read-only preview listening on port ${port}`);
});
