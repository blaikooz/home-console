import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for fetching GTFS-RT feed with premium headers and proxy fallbacks to bypass Cloudflare/Akamai 403 blocks
  async function fetchGtfsFeed(url: string) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
    
    // Attempt 1: Direct with browser headers
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      if (response.ok) {
        clearTimeout(id);
        const buffer = await response.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
        console.log(`Successfully fetched feed directly from original URL: ${url}`);
        return feed;
      } else {
        console.warn(`Direct fetch failed with status ${response.status} ${response.statusText} for URL: ${url}. Attempting proxy backup...`);
      }
    } catch (directError: any) {
      console.warn(`Direct fetch failed with error "${directError.message || directError}" for URL: ${url}. Attempting proxy backup...`);
    } finally {
      clearTimeout(id);
    }

    // Attempt 2: Fallback using allorigins.win RAW proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const proxyController = new AbortController();
    const proxyId = setTimeout(() => proxyController.abort(), 10000); // 10 seconds timeout
    try {
      console.log(`Fetching via fallback proxy: ${proxyUrl}`);
      const response = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        },
        signal: proxyController.signal
      });
      
      if (response.ok) {
        clearTimeout(proxyId);
        const buffer = await response.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
        console.log(`Successfully fetched feed via proxy for URL: ${url}`);
        return feed;
      } else {
        throw new Error(`Proxy fallback returned status: ${response.status} ${response.statusText}`);
      }
    } catch (proxyError: any) {
      clearTimeout(proxyId);
      console.warn(`Proxy fallback also failed for URL ${url}:`, proxyError.message || proxyError);
      
      // Attempt 3: Another proxy as final resort (codetabs)
      const codetabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
      const codetabsController = new AbortController();
      const codetabsId = setTimeout(() => codetabsController.abort(), 10000); // 10 seconds timeout
      try {
        console.log(`Fetching via alternate proxy: ${codetabsUrl}`);
        const response = await fetch(codetabsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
          },
          signal: codetabsController.signal
        });
        if (response.ok) {
          clearTimeout(codetabsId);
          const buffer = await response.arrayBuffer();
          const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
          console.log(`Successfully fetched feed via alternate proxy for URL: ${url}`);
          return feed;
        } else {
          throw new Error(`Alternate proxy returned status: ${response.status} ${response.statusText}`);
        }
      } catch (codetabsError: any) {
        clearTimeout(codetabsId);
        console.error(`Alternate proxy also failed for URL ${url}:`, codetabsError.message || codetabsError);
        throw new Error(`All methods failed to retrieve feed from ${url}`);
      }
    }
  }

  // --- API ROUTE: TRANSIT ---
  app.get('/api/transit', async (req, res) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Fetch both feeds in parallel with individual error catch so one doesn't crash the other
      const [aceFeed, gFeed] = await Promise.all([
        fetchGtfsFeed('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace').catch((e) => {
          console.error('Failed to parse ACE feed', e);
          return null;
        }),
        fetchGtfsFeed('https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g').catch((e) => {
          console.error('Failed to parse G feed', e);
          return null;
        })
      ]);

      if (!aceFeed && !gFeed) {
        throw new Error('All MTA subway feeds are currently unreachable.');
      }

      const arrivals: { routeId: string; stopId: string; direction: string; time: number }[] = [];

      const processFeed = (feed: any) => {
        if (!feed || !feed.entity) return;
        for (const entity of feed.entity) {
          if (entity.tripUpdate && entity.tripUpdate.stopTimeUpdate) {
            const routeId = entity.tripUpdate.trip.routeId;
            // Only care about A, C, G routes as defined
            if (!['A', 'C', 'G'].includes(routeId)) continue;

            for (const stopUpdate of entity.tripUpdate.stopTimeUpdate) {
              const stopId = stopUpdate.stopId;
              const isNostrand = stopId.startsWith('A42');
              const isMyrtle = stopId.startsWith('G29');

              if (isNostrand || isMyrtle) {
                const time = stopUpdate.arrival?.time || stopUpdate.departure?.time;
                if (time) {
                  const direction = stopId.endsWith('N') ? 'N' : stopId.endsWith('S') ? 'S' : 'U';
                  arrivals.push({
                    routeId,
                    stopId: isNostrand ? 'A42' : 'G29',
                    direction,
                    time: Number(time)
                  });
                }
              }
            }
          }
        }
      };

      processFeed(aceFeed);
      processFeed(gFeed);

      const result: Record<string, { N: number[]; S: number[] }> = {
        'A': { N: [], S: [] },
        'C': { N: [], S: [] },
        'G': { N: [], S: [] }
      };

      arrivals.forEach(arr => {
        const { routeId, direction, time } = arr;
        const dir = (direction === 'S') ? 'S' : 'N';
        const minutes = Math.max(0, Math.round((time - now) / 60));
        
        // MTA feed time updates can sometimes include times that have already passed but not purged,
        // we keep them if they are <= 45 minutes ahead. Realistically, anything more than 45 min in future
        // might be an outlier or we can show up to 3 arrivals anyway.
        if (time >= now - 60 && minutes < 60) {
          result[routeId][dir].push(minutes);
        }
      });

      // Deduplicate, sort, and slice to top 3
      Object.keys(result).forEach(route => {
        result[route].N = Array.from(new Set(result[route].N)).sort((a, b) => a - b).slice(0, 3);
        result[route].S = Array.from(new Set(result[route].S)).sort((a, b) => a - b).slice(0, 3);
      });

      res.json(result);
    } catch (error: any) {
      console.error('Transit endpoint logic error:', error);
      res.status(502).json({ error: error.message || 'MTA feed service is currently offline.' });
    }
  });

  // --- API ROUTE: WEATHER ---
  app.get('/api/weather', async (req, res) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.6832&longitude=-73.9442&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m&hourly=precipitation_probability&forecast_days=1&temperature_unit=fahrenheit&windspeed_unit=mph', {
        signal: controller.signal
      });
      clearTimeout(id);
      if (!response.ok) {
        throw new Error(`Open-Meteo response code: ${response.status}`);
      }
      const data = await response.json();
      
      // Inject current precipitation probability
      const hourIndex = new Date().getHours();
      const pProbArr = data.hourly?.precipitation_probability;
      const precipitationProbability = (pProbArr && pProbArr[hourIndex] !== undefined) ? pProbArr[hourIndex] : 0;
      
      if (data.current) {
        data.current.precipitation_probability = precipitationProbability;
      }
      
      res.json(data);
    } catch (error: any) {
      clearTimeout(id);
      console.error('Weather fetching error:', error);
      res.status(502).json({ error: 'Open-Meteo API connection failed.' });
    }
  });

  // --- API ROUTE: AIRSPACE ---
  app.get('/api/airspace', async (req, res) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('https://api.adsb.lol/v2/lat/40.6832/lon/-73.9442/dist/5', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Bed-Stuy-Console/1.0'
        },
        signal: controller.signal
      });
      clearTimeout(id);
      if (!response.ok) {
        throw new Error(`ADSB.lol response code: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      clearTimeout(id);
      console.error('Airspace fetching error:', error);
      res.status(502).json({ error: 'ADSB.lol airspace API connection failed.' });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
