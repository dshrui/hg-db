import crypto from "node:crypto";

const COOKIE_NAME = "hg_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function getOpsUsername() {
  return process.env.OPS_USERNAME || "ops";
}

function getOpsPassword() {
  return process.env.OPS_PASSWORD || "";
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "";
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue));
  const right = Buffer.from(String(rightValue));
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function sign(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(header.split(";").filter(Boolean).map((cookie) => {
    const index = cookie.indexOf("=");
    return [
      decodeURIComponent(cookie.slice(0, index).trim()),
      decodeURIComponent(cookie.slice(index + 1).trim()),
    ];
  }));
}

function serializeCookie(name, value, request, maxAge) {
  const forwardedProto = request.headers.get("x-forwarded-proto") || "";
  const secure = forwardedProto === "https" || process.env.VERCEL === "1";
  return [
    `${name}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function verifyCredentials(username, password) {
  const adminPassword = getAdminPassword();
  if (adminPassword && safeEqual(username, getAdminUsername()) && safeEqual(password, adminPassword)) {
    return { username: getAdminUsername(), role: "admin" };
  }

  const opsPassword = getOpsPassword();
  if (opsPassword && safeEqual(username, getOpsUsername()) && safeEqual(password, opsPassword)) {
    return { username: getOpsUsername(), role: "ops" };
  }

  return null;
}

export function createSessionCookie(request, sessionUser) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  const payload = base64UrlEncode(JSON.stringify({
    username: sessionUser.username,
    role: sessionUser.role,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  }));
  const token = `${payload}.${sign(payload)}`;
  return serializeCookie(COOKIE_NAME, token, request, SESSION_MAX_AGE_SECONDS);
}

export function clearSessionCookie(request) {
  return serializeCookie(COOKIE_NAME, "", request, 0);
}

export function getSession(request) {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session.expiresAt || session.expiresAt < Date.now()) {
      return null;
    }
    if (session.role === "admin" && session.username === getAdminUsername()) {
      return session;
    }
    if (session.role === "ops" && session.username === getOpsUsername()) {
      return session;
    }
    if (session.username === getAdminUsername() && !session.role) {
      session.role = "admin";
      return session;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function isAuthenticated(request) {
  return Boolean(getSession(request));
}

export function isAdmin(request) {
  const session = getSession(request);
  return Boolean(session && session.role === "admin");
}

export function redirectResponse(location, headers = {}) {
  return new Response("", {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function unauthorizedResponse() {
  return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
}
