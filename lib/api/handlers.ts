import { fetchGtfsFeed } from './gtfs';

/**
 * Minimal response shape shared by Express's Response and Vercel's VercelResponse.
 * Lets the same handler run in `npm run dev` (Express) and on Vercel (serverless).
 */
export interface MinimalRes {
  status(code: number): MinimalRes;
  json(body: unknown): unknown;
}
export interface MinimalReq {
  url?: string;
}

export async function weatherHandler(_req: MinimalReq, res: MinimalRes) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=40.6832&longitude=-73.9442&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m&hourly=precipitation_probability&forecast_days=1&temperature_unit=fahrenheit&windspeed_unit=mph',
      { signal: controller.signal },
    );
    clearTimeout(id);
    if (!response.ok) throw new Error(`Open-Meteo response code: ${response.status}`);
    const data = await response.json();

    const hourIndex = new Date().getHours();
    const arr = data?.hourly?.precipitation_probability;
    const precipitationProbability = arr && arr[hourIndex] !== undefined ? arr[hourIndex] : 0;
    if (data.current) data.current.precipitation_probability = precipitationProbability;

    return res.status(200).json(data);
  } catch (error: any) {
    clearTimeout(id);
    console.error('Weather fetching error:', error);
    return res.status(502).json({ error: 'Open-Meteo API connection failed.' });
  }
}

export async function airspaceHandler(_req: MinimalReq, res: MinimalRes) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://api.adsb.lol/v2/lat/40.6832/lon/-73.9442/dist/5', {
      headers: { Accept: 'application/json', 'User-Agent': 'Bed-Stuy-Console/1.0' },
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) throw new Error(`ADSB.lol response code: ${response.status}`);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    clearTimeout(id);
    console.error('Airspace fetching error:', error);
    return res.status(502).json({ error: 'ADSB.lol airspace API connection failed.' });
  }
}

export async function transitHandler(_req: MinimalReq, res: MinimalRes) {
  try {
    const now = Math.floor(Date.now() / 1000);

    const [aceFeed, gFeed] = await Promise.all([
      fetchGtfsFeed('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace').catch((e) => {
        console.error('Failed to parse ACE feed', e);
        return null;
      }),
      fetchGtfsFeed('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g').catch((e) => {
        console.error('Failed to parse G feed', e);
        return null;
      }),
    ]);

    if (!aceFeed && !gFeed) throw new Error('All MTA subway feeds are currently unreachable.');

    const arrivals: { routeId: string; stopId: string; direction: string; time: number }[] = [];

    const processFeed = (feed: any) => {
      if (!feed?.entity) return;
      for (const entity of feed.entity) {
        if (!entity.tripUpdate?.stopTimeUpdate) continue;
        const routeId = entity.tripUpdate.trip.routeId;
        if (!['A', 'C', 'G'].includes(routeId)) continue;

        for (const stopUpdate of entity.tripUpdate.stopTimeUpdate) {
          const stopId: string = stopUpdate.stopId;
          const isNostrand = stopId.startsWith('A42');
          const isBedfordNostrand = stopId.startsWith('G33');
          if (!isNostrand && !isBedfordNostrand) continue;

          const time = stopUpdate.arrival?.time ?? stopUpdate.departure?.time;
          if (!time) continue;
          const direction = stopId.endsWith('N') ? 'N' : stopId.endsWith('S') ? 'S' : 'U';
          arrivals.push({
            routeId,
            stopId: isNostrand ? 'A42' : 'G33',
            direction,
            time: Number(time),
          });
        }
      }
    };

    processFeed(aceFeed);
    processFeed(gFeed);

    const result: Record<string, { N: number[]; S: number[] }> = {
      A: { N: [], S: [] },
      C: { N: [], S: [] },
      G: { N: [], S: [] },
    };

    for (const a of arrivals) {
      const dir = a.direction === 'S' ? 'S' : 'N';
      const minutes = Math.max(0, Math.round((a.time - now) / 60));
      if (a.time >= now - 60 && minutes < 60) {
        result[a.routeId][dir].push(minutes);
      }
    }

    for (const route of Object.keys(result)) {
      result[route].N = Array.from(new Set(result[route].N)).sort((a, b) => a - b).slice(0, 3);
      result[route].S = Array.from(new Set(result[route].S)).sort((a, b) => a - b).slice(0, 3);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Transit endpoint logic error:', error);
    return res.status(502).json({ error: error.message || 'MTA feed service is currently offline.' });
  }
}
