const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const rootDir = __dirname;
const privateDir = path.join(rootDir, "private");
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const opsUsername = process.env.OPS_USERNAME || "ops";
const opsPassword = process.env.OPS_PASSWORD || "";
const appsScriptUrl = process.env.APPS_SCRIPT_URL || "";
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const sessions = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), { "Content-Type": "application/json; charset=utf-8" });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
    const index = cookie.indexOf("=");
    return [
      decodeURIComponent(cookie.slice(0, index).trim()),
      decodeURIComponent(cookie.slice(index + 1).trim()),
    ];
  }));
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function verifyCredentials(username, password) {
  if (adminPassword && safeEqual(username, adminUsername) && safeEqual(password, adminPassword)) {
    return { username: adminUsername, role: "admin" };
  }
  if (opsPassword && safeEqual(username, opsUsername) && safeEqual(password, opsPassword)) {
    return { username: opsUsername, role: "ops" };
  }
  return null;
}

function createSession(sessionUser) {
  const id = crypto.randomBytes(32).toString("hex");
  const signed = `${id}.${sign(id)}`;
  sessions.set(id, { createdAt: Date.now(), username: sessionUser.username, role: sessionUser.role });
  return signed;
}

function getSession(req) {
  const token = parseCookies(req).hg_session;
  if (!token) {
    return null;
  }
  const [id, signature] = token.split(".");
  if (!id || !signature || !safeEqual(signature, sign(id)) || !sessions.has(id)) {
    return null;
  }
  return { id, ...sessions.get(id) };
}

function destroySession(req) {
  const token = parseCookies(req).hg_session;
  if (!token) {
    return;
  }
  const [id] = token.split(".");
  sessions.delete(id);
}

function redirect(res, location) {
  send(res, 302, "", { Location: location });
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    send(res, 200, data, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
  });
}

function serveAdminApp(req, res) {
  if (!requireAuth(req, res)) {
    return;
  }
  fs.readFile(path.join(privateDir, "admin.html"), "utf8", (error, html) => {
    if (error) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    const session = getSession(req);
    const sessionScript = `<script>window.HG_SESSION=${JSON.stringify({
      username: session.username,
      role: session.role,
    }).replace(/</g, "\\u003c")};</script>`;
    send(res, 200, html.replace("</head>", `${sessionScript}</head>`), { "Content-Type": "text/html; charset=utf-8" });
  });
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function requireAuth(req, res) {
  if (!getSession(req)) {
    if (req.url.startsWith("/api/")) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
    } else {
      redirect(res, "/login");
    }
    return false;
  }
  return true;
}

async function proxyAppsScript(res, payload) {
  if (!appsScriptUrl) {
    sendJson(res, 500, { ok: false, error: "APPS_SCRIPT_URL is not configured on the backend." });
    return;
  }
  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  const text = await response.text();
  send(res, response.ok ? 200 : 502, text || JSON.stringify({ ok: response.ok }), {
    "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
  });
}

async function pullAppsScript(res) {
  if (!appsScriptUrl) {
    sendJson(res, 500, { ok: false, error: "APPS_SCRIPT_URL is not configured on the backend." });
    return;
  }
  const separator = appsScriptUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${appsScriptUrl}${separator}action=read`, { redirect: "follow" });
  const text = await response.text();
  send(res, response.ok ? 200 : 502, text, {
    "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      serveAdminApp(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/login") {
      serveFile(res, path.join(rootDir, "login.html"));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/private/")) {
      redirect(res, "/");
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin") {
      serveAdminApp(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/admin/")) {
      serveAdminApp(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await collectBody(req);
      const form = new URLSearchParams(body);
      const username = form.get("username") || "";
      const password = form.get("password") || "";
      const sessionUser = verifyCredentials(username, password);
      if (!sessionUser) {
        redirect(res, "/login?error=1");
        return;
      }
      send(res, 302, "", {
        Location: "/",
        "Set-Cookie": `hg_session=${encodeURIComponent(createSession(sessionUser))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
      });
      return;
    }

    if ((req.method === "POST" || req.method === "GET") && url.pathname === "/api/logout") {
      destroySession(req);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sheet/push") {
      if (!requireAuth(req, res)) {
        return;
      }
      await proxyAppsScript(res, JSON.parse(await collectBody(req) || "{}"));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/sheet/pull") {
      if (!requireAuth(req, res)) {
        return;
      }
      await pullAppsScript(res);
      return;
    }

    if (req.method === "GET") {
      const requested = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(rootDir, requested);
      if (filePath.startsWith(rootDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile() && !filePath.startsWith(privateDir)) {
        serveFile(res, filePath);
        return;
      }
    }

    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`HG tracker backend listening on http://127.0.0.1:${port}`);
  if (!adminPassword) {
    console.warn("ADMIN_PASSWORD is not set. Login is disabled until it is configured.");
  }
});
