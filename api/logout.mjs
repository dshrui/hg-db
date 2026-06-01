import { clearSessionCookie, jsonResponse } from "../lib/vercel-auth.mjs";

export async function POST(request) {
  return jsonResponse({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(request),
  });
}

export async function GET(request) {
  return POST(request);
}
