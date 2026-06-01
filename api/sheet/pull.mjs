import { isAuthenticated, jsonResponse, unauthorizedResponse } from "../../lib/vercel-auth.mjs";

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL || "";
  if (!appsScriptUrl) {
    return jsonResponse({ ok: false, error: "APPS_SCRIPT_URL is not configured." }, 500);
  }

  const separator = appsScriptUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${appsScriptUrl}${separator}action=read`, { redirect: "follow" });
  const text = await response.text();

  return new Response(text, {
    status: response.ok ? 200 : 502,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
