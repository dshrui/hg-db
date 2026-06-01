import { readFile } from "node:fs/promises";
import path from "node:path";
import { isAuthenticated, redirectResponse } from "../lib/vercel-auth.mjs";

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return redirectResponse("/login");
  }

  const html = await readFile(path.join(process.cwd(), "private", "admin.html"), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
