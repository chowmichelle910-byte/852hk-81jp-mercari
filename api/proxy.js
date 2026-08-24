export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const src = searchParams.get('src');

  if (!src) {
    return new Response('missing src', { status: 400 });
  }

  let parsed;
  try { parsed = new URL(src); } catch {
    return new Response('invalid url', { status: 400 });
  }
  if (!parsed.hostname.endsWith('.supabase.co')) {
    return new Response('forbidden', { status: 403 });
  }

  let upstream;
  try {
    upstream = await fetch(src);
  } catch (e) {
    return new Response('upstream fetch failed: ' + e.message, { status: 502 });
  }

  const html = await upstream.text();

  return new Response(html, {
    status: upstream.ok ? 200 : upstream.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
