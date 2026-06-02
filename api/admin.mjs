import { readFile } from "node:fs/promises";
import { methodNotAllowed, sendWebResponse, toWebRequest } from "../lib/vercel-adapter.mjs";
import { getSession, redirectResponse } from "../lib/vercel-auth.mjs";

export async function GET(request) {
  const session = getSession(request);
  if (!session) {
    return redirectResponse("/login");
  }

  const html = await readFile(new URL("../private/admin.html", import.meta.url), "utf8");
  const sessionScript = `<script>window.HG_SESSION=${JSON.stringify({
    username: session.username,
    role: session.role,
  }).replace(/</g, "\\u003c")};</script>`;
  return new Response(html.replace("</head>", `${sessionScript}</head>`), {
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
