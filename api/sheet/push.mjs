import { methodNotAllowed, sendWebResponse, toWebRequest } from "../../lib/vercel-adapter.mjs";
import { isAuthenticated, jsonResponse, unauthorizedResponse } from "../../lib/vercel-auth.mjs";

export async function POST(request) {
  if (!isAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL || "";
  if (!appsScriptUrl) {
    return jsonResponse({ ok: false, error: "APPS_SCRIPT_URL is not configured." }, 500);
  }

  const payload = await request.json();
  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  const text = await response.text();

  return new Response(text || JSON.stringify({ ok: response.ok }), {
    status: response.ok ? 200 : 502,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default async function handler(request, reply) {
  const webRequest = toWebRequest(request);
  const response = request.method === "POST" ? await POST(webRequest) : methodNotAllowed();
  await sendWebResponse(response, reply);
}
