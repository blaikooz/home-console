import { fetchGtfsFeed } from './gtfs';
import type { MinimalReq, MinimalRes } from './handlers';

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
