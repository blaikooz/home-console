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

