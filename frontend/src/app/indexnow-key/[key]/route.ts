/**
 * IndexNow key verification file.
 *
 * Reached via the next.config.ts rewrite of GET /{INDEXNOW_KEY}.txt. IndexNow
 * participants (Bing, Yandex, DuckDuckGo — Google does not use IndexNow)
 * verify host ownership by fetching https://<host>/<key>.txt and expecting the
 * key as the plain-text body.
 *
 * The accepted key and the returned body both come from the same INDEXNOW_KEY
 * env var, so they can never drift apart. Any other requested key returns 404.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const configuredKey = process.env.INDEXNOW_KEY;

  // Tolerate a ".txt" suffix in case the handler is reached directly.
  const requested = key.endsWith(".txt") ? key.slice(0, -4) : key;

  if (!configuredKey || requested !== configuredKey) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(configuredKey, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
