import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function decode(response: Response) {
  const buffer = await response.arrayBuffer();
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
}

export async function fetchGtfsFeed(url: string) {
  // 1. Direct
  try {
    const r = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: '*/*',
          'User-Agent': BROWSER_UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      },
      8000,
    );
    if (r.ok) return await decode(r);
    console.warn(`Direct fetch ${url} -> ${r.status} ${r.statusText}`);
  } catch (e: any) {
    console.warn(`Direct fetch ${url} failed: ${e?.message ?? e}`);
  }

  // 2. allorigins proxy
  try {
    const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const r = await fetchWithTimeout(proxied, { headers: { 'User-Agent': BROWSER_UA } }, 10000);
    if (r.ok) return await decode(r);
    console.warn(`allorigins proxy ${url} -> ${r.status} ${r.statusText}`);
  } catch (e: any) {
    console.warn(`allorigins proxy ${url} failed: ${e?.message ?? e}`);
  }

  // 3. codetabs proxy
  const proxied = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
  const r = await fetchWithTimeout(proxied, { headers: { 'User-Agent': BROWSER_UA } }, 10000);
  if (!r.ok) throw new Error(`All fetch attempts failed for ${url} (last status ${r.status})`);
  return await decode(r);
}
