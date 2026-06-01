export function toWebRequest(request) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers.host || "localhost";
  const url = new URL(request.url || "/", `${protocol}://${host}`);
  const headers = new Headers();
  const method = request.method || "GET";
  const init = { method, headers };

  Object.entries(request.headers || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  });

  if (method !== "GET" && method !== "HEAD") {
    init.body = request;
    init.duplex = "half";
  }

  return new Request(url, init);
}

export async function sendWebResponse(response, reply) {
  reply.statusCode = response.status;
  response.headers.forEach((value, key) => {
    reply.setHeader(key, value);
  });
  reply.end(Buffer.from(await response.arrayBuffer()));
}

export function methodNotAllowed() {
  return Response.json({ ok: false, error: "Method not allowed" }, {
    status: 405,
    headers: { "Cache-Control": "no-store" },
  });
}
