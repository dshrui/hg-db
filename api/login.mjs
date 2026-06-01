import { createSessionCookie, redirectResponse, verifyCredentials } from "../lib/vercel-auth.mjs";

export async function POST(request) {
  const form = new URLSearchParams(await request.text());
  const username = form.get("username") || "";
  const password = form.get("password") || "";

  if (!verifyCredentials(username, password)) {
    return redirectResponse("/login?error=1");
  }

  try {
    return redirectResponse("/admin", {
      "Set-Cookie": createSessionCookie(request, username),
    });
  } catch (error) {
    return redirectResponse("/login?error=1");
  }
}

export async function GET() {
  return redirectResponse("/login");
}
