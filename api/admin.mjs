import { readFile } from "node:fs/promises";
import { methodNotAllowed, sendWebResponse, toWebRequest } from "../lib/vercel-adapter.mjs";
import { isAuthenticated, redirectResponse } from "../lib/vercel-auth.mjs";

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return redirectResponse("/login");
  }

  const html = await readFile(new URL("../private/admin.html", import.meta.url), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default async function handler(request, reply) {
  const webRequest = toWebRequest(request);
  const response = request.method === "GET" ? await GET(webRequest) : methodNotAllowed();
  await sendWebResponse(response, reply);
}
