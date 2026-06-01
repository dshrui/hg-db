import { methodNotAllowed, sendWebResponse, toWebRequest } from "../lib/vercel-adapter.mjs";
import { clearSessionCookie, jsonResponse } from "../lib/vercel-auth.mjs";

export async function POST(request) {
  return jsonResponse({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(request),
  });
}

export async function GET(request) {
  return POST(request);
}

export default async function handler(request, reply) {
  const webRequest = toWebRequest(request);
  const response = request.method === "POST" || request.method === "GET"
    ? await POST(webRequest)
    : methodNotAllowed();
  await sendWebResponse(response, reply);
}
