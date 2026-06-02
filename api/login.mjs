import { methodNotAllowed, sendWebResponse, toWebRequest } from "../lib/vercel-adapter.mjs";
import { createSessionCookie, redirectResponse, verifyCredentials } from "../lib/vercel-auth.mjs";

export async function POST(request) {
  const form = new URLSearchParams(await request.text());
  const username = form.get("username") || "";
  const password = form.get("password") || "";
  const sessionUser = verifyCredentials(username, password);

  if (!sessionUser) {
    return redirectResponse("/login?error=1");
  }

  try {
    return redirectResponse("/admin", {
      "Set-Cookie": createSessionCookie(request, sessionUser),
    });
  } catch (error) {
    return redirectResponse("/login?error=1");
  }
}

export async function GET() {
  return redirectResponse("/login");
}

export default async function handler(request, reply) {
  const webRequest = toWebRequest(request);
  const response = request.method === "POST"
    ? await POST(webRequest)
    : request.method === "GET"
      ? await GET(webRequest)
      : methodNotAllowed();
  await sendWebResponse(response, reply);
}
