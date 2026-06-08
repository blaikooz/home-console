/**
 * Helper utility functions for Bed-Stuy Console
 */

export function mapWmoCode(code: number): string {
  const codes: Record<number, string> = {
    0: 'CLEAR SKY',
    1: 'MAINLY CLEAR',
    2: 'PARTLY CLOUDY',
    3: 'OVERCAST',
    45: 'FOGGY',
    48: 'DEPOSITING FOG',
    51: 'LIGHT DRIZZLE',
    53: 'MODERATE DRIZZLE',
    55: 'DENSE DRIZZLE',
    56: 'FREEZING DRIZZLE',
    57: 'DENSE FREEZING DRIZZLE',
    61: 'LIGHT RAIN',
    63: 'MODERATE RAIN',
    65: 'HEAVY RAIN',
    66: 'LIGHT FREEZING RAIN',
    67: 'HEAVY FREEZING RAIN',
    71: 'LIGHT SNOWFALL',
    73: 'MODERATE SNOWFALL',
    75: 'HEAVY SNOWFALL',
    77: 'SNOW GRAINS',
    80: 'LIGHT RAIN SHOWERS',
    81: 'MODERATE RAIN SHOWERS',
    82: 'VIOLENT RAIN SHOWERS',
    85: 'LIGHT SNOW SHOWERS',
    86: 'HEAVY SNOW SHOWERS',
    95: 'THUNDERSTORM',
    96: 'THUNDERSTORM / HAIL',
    99: 'SEVERE THUNDERSTORM',
  };
  return codes[code] || 'UNKNOWN CONDS';
}

export function getCompassHeading(track: number | undefined): string {
  if (track === undefined || isNaN(track)) return 'N/A';
  const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(track / 22.5) % 16;
  return compass[index] || 'N/A';
}

export function formatTime(date: Date): { day: string; timeStr: string; time12hStr: string } {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  const hrsNum = date.getHours();
  const hrs = String(hrsNum).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  const secs = String(date.getSeconds()).padStart(2, '0');
  
  // 12-hour format
  const hrs12Num = hrsNum % 12 || 12;
  const ampm = hrsNum >= 12 ? 'PM' : 'AM';
  const hrs12 = String(hrs12Num).padStart(2, '0');
  const time12hStr = `${hrs12}:${mins}:${secs} ${ampm}`;
  
  return {
    day: `${dayName} ${monthName} ${dayNum} ${year}`,
    timeStr: `${hrs}:${mins}:${secs}`,
    time12hStr
  };
}

export function getWeatherAscii(code: number, tickNum: number = 0): string {
  const tick = tickNum % 2;
  if (code === 0 || code === 1) {
    if (tick === 0) {
      return `
     \\   /
      .-.
   -- (   ) --
      \`-\'
     /   \\
      `;
    } else {
      return `
     |   |
      .-.
   -  (   )  -
      \`-\'
     |   |
      `;
    }
  }
  if (code === 2 || code === 3) {
    if (tick === 0) {
      return `
       .--.   ~
    .-(    ).
   (___.__)__)  ~
      `;
    } else {
      return `
     ~ .--.
    .-(    ).
   (___.__)__)  =
      `;
    }
  }
  if (code === 45 || code === 48) {
    if (tick === 0) {
      return `
  = = = = = =
   = = = = =
  = = = = = =
      `;
    } else {
      return `
   = = = = =
  = = = = = =
   = = = = =
      `;
    }
  }
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    if (tick === 0) {
      return `
      .--.
   .-(    ).
  (___.__)__)
   '  '  '  '
  '  '  '  '
      `;
    } else {
      return `
      .--.
   .-(    ).
  (___.__)__)
  '  '  '  '
   '  '  '  '
      `;
    }
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    if (tick === 0) {
      return `
      .--.
   .-(    ).
  (___.__)__)
   *  *  *  *
  *  *  *  *
      `;
    } else {
      return `
      .--.
   .-(    ).
  (___.__)__)
  *  *  *  *
   *  *  *  *
      `;
    }
  }
  if (code >= 95 && code <= 99) {
    if (tick === 0) {
      return `
      .--.
   .-(    ).
  (___.__)__)
     /_  /_
      /   /
      `;
    } else {
      return `
      .--.
   .-(    ).
  (___*__*__)
     _\\  _\\
      /   /
      `;
    }
  }
  if (tick === 0) {
    return `
    .-.
   (   )
    \`-\'
    `;
  } else {
    return `
    .-.
   ( * )
    \`-\'
    `;
  }
}

/**
 * Generates a stable, realistic flight route (Origin ➔ Destination)
 * based on the flight callsign/registration.
 */
export function getFlightRoute(callsign: string): string {
  if (!callsign || callsign === 'UNKN' || callsign === 'N/A') {
    return 'LGA ➔ ORD';
  }
  
  const clean = callsign.trim().toUpperCase();
  
  // Deterministic hash based on characters in clean callsign
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // Common airport codes
  const destinations = [
    'LAX', 'SFO', 'ORD', 'ATL', 'MIA', 'DFW', 'BOS', 'SEA', 'DEN', 'PBI', 
    'FLL', 'MCO', 'SJU', 'LHR', 'CDG', 'FRA', 'AMS', 'HND', 'CUN', 'NAS',
    'YUL', 'YYZ', 'DCA', 'IAD', 'CLT', 'PHL', 'DTW', 'MSP', 'IAH', 'PHX'
  ];

  // JetBlue (JBU) - primarily JFK
  if (clean.startsWith('JBU')) {
    const isArrival = hash % 2 === 0;
    const city = destinations[hash % destinations.length];
    return isArrival ? `${city} ➔ JFK` : `JFK ➔ ${city}`;
  }

  // Delta (DAL) - LGA or JFK
  if (clean.startsWith('DAL')) {
    const isArrival = hash % 2 === 0;
    const ny = hash % 3 === 0 ? 'JFK' : 'LGA';
    const city = destinations[hash % destinations.length];
    return isArrival ? `${city} ➔ ${ny}` : `${ny} ➔ ${city}`;
  }

  // American Airlines (AAL) - LGA or JFK
  if (clean.startsWith('AAL')) {
    const isArrival = hash % 2 === 0;
    const ny = hash % 3 === 0 ? 'JFK' : 'LGA';
    const city = destinations[hash % destinations.length];
    return isArrival ? `${city} ➔ ${ny}` : `${ny} ➔ ${city}`;
  }

  // United (UAL) - EWR
  if (clean.startsWith('UAL')) {
    const isArrival = hash % 2 === 0;
    const city = destinations[hash % destinations.length];
    return isArrival ? `${city} ➔ EWR` : `EWR ➔ ${city}`;
  }

  // Southwest (SWA) - LGA
  if (clean.startsWith('SWA')) {
    const isArrival = hash % 2 === 0;
    const city = destinations[hash % destinations.length];
    return isArrival ? `${city} ➔ LGA` : `LGA ➔ ${city}`;
  }

  // Republic / Envoy / SkyWest (rpa, env, skw) - regional feed to LGA/JFK/EWR
  if (clean.startsWith('RPA') || clean.startsWith('ENV') || clean.startsWith('SKW') || clean.startsWith('PDT')) {
    const isArrival = hash % 2 === 0;
    const localHubs = ['LGA', 'JFK', 'EWR'];
    const ny = localHubs[hash % localHubs.length];
    const regionals = ['BOS', 'DCA', 'PHL', 'BWI', 'BUF', 'ROC', 'SYR', 'PWM', 'BDL', 'CLE', 'PIT', 'RDU', 'ORF'];
    const city = regionals[hash % regionals.length];
    return isArrival ? `${city} ➔ ${ny}` : `${ny} ➔ ${city}`;
  }

  // General aviation / N-number
  if (clean.startsWith('N') && clean.length > 2 && !isNaN(Number(clean.charAt(1)))) {
    const localHubs = ['TEB', 'HPN', 'FRG', 'JFK', 'LGA'];
    const origin = localHubs[hash % localHubs.length];
    const resorts = ['PBI', 'MCO', 'ACK', 'MVY', 'APF', 'MIA', 'VQQ', 'RDU', 'GSO'];
    const dest = resorts[(hash >> 2) % resorts.length];
    const isArrival = hash % 2 === 0;
    return isArrival ? `${dest} ➔ ${origin}` : `${origin} ➔ ${dest}`;
  }

  // Fallback - generate some nice route
  const cities = ['JFK', 'LGA', 'EWR', 'LAX', 'SFO', 'ORD', 'ATL', 'MIA', 'DFW', 'BOS', 'LHR', 'CDG'];
  const origIdx = hash % cities.length;
  // Make sure dest is different
  const destIdx = (hash + 3) % cities.length;
  const orig = cities[origIdx];
  const destVal = cities[destIdx === origIdx ? (destIdx + 1) % cities.length : destIdx];
  return `${orig} ➔ ${destVal}`;
}

export function getAirlineName(callsign: string): string {
  if (!callsign || callsign === 'UNKN' || callsign === 'N/A') {
    return 'CHARTER';
  }
  const clean = callsign.trim().toUpperCase();
  if (clean.startsWith('JBU')) return 'JETBLUE';
  if (clean.startsWith('DAL')) return 'DELTA';
  if (clean.startsWith('AAL')) return 'AMERICAN';
  if (clean.startsWith('UAL')) return 'UNITED';
  if (clean.startsWith('SWA')) return 'SOUTHWEST';
  if (clean.startsWith('RPA')) return 'REPUBLIC';
  if (clean.startsWith('ENV')) return 'ENVOY';
  if (clean.startsWith('SKW')) return 'SKYWEST';
  if (clean.startsWith('EDV')) return 'ENDEAVOR';
  if (clean.startsWith('NKS')) return 'SPIRIT';
  if (clean.startsWith('FFT')) return 'FRONTIER';
  if (clean.startsWith('HAL')) return 'HAWAIIAN';
  if (clean.startsWith('ASA')) return 'ALASKA';
  if (clean.startsWith('FDX')) return 'FEDEX';
  if (clean.startsWith('UPS')) return 'UPS';
  if (clean.startsWith('N') && clean.length > 2 && !isNaN(Number(clean.charAt(1)))) {
    return 'PRIVATE GA';
  }
  
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  const fallbacks = ['NETJETS', 'COMMERCIAL', 'CHARTER', 'CARGO AIR', 'WHEELS UP', 'LUFTHANSA', 'BRITISH AIRWAYS', 'AIR CANADA'];
  return fallbacks[hash % fallbacks.length];
}

