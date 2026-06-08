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

/**
 * Country of origin (as a flag emoji) for an aircraft callsign.
 * Uses ICAO airline prefixes for commercial carriers and the registration
 * prefix for general aviation (N = US, C = Canada, G = UK, D = Germany, F = France, etc.).
 * Falls back to a globe for anything unknown.
 */
export function getCountryFlag(callsign: string): string {
  if (!callsign || callsign === 'UNKN' || callsign === 'N/A') return '🌐';
  const clean = callsign.trim().toUpperCase();

  // Commercial ICAO airline prefixes (3-letter)
  const airlineFlags: Record<string, string> = {
    // United States
    JBU: '🇺🇸', DAL: '🇺🇸', AAL: '🇺🇸', UAL: '🇺🇸', SWA: '🇺🇸',
    RPA: '🇺🇸', ENV: '🇺🇸', SKW: '🇺🇸', EDV: '🇺🇸', NKS: '🇺🇸',
    FFT: '🇺🇸', HAL: '🇺🇸', ASA: '🇺🇸', FDX: '🇺🇸', UPS: '🇺🇸',
    PDT: '🇺🇸', GJS: '🇺🇸', AAY: '🇺🇸', SCX: '🇺🇸',
    // Canada
    ACA: '🇨🇦', WJA: '🇨🇦', JZA: '🇨🇦', POE: '🇨🇦', TSC: '🇨🇦',
    // UK
    BAW: '🇬🇧', VIR: '🇬🇧', EZY: '🇬🇧',
    // Europe
    DLH: '🇩🇪', AFR: '🇫🇷', KLM: '🇳🇱', IBE: '🇪🇸', AZA: '🇮🇹',
    SAS: '🇸🇪', SWR: '🇨🇭', AUA: '🇦🇹', FIN: '🇫🇮', TAP: '🇵🇹',
    AEE: '🇬🇷', THY: '🇹🇷', RYR: '🇮🇪', EIN: '🇮🇪',
    // Asia
    JAL: '🇯🇵', ANA: '🇯🇵', KAL: '🇰🇷', AAR: '🇰🇷', CPA: '🇭🇰',
    SIA: '🇸🇬', CCA: '🇨🇳', CES: '🇨🇳', CSN: '🇨🇳', CAL: '🇹🇼',
    EVA: '🇹🇼', THA: '🇹🇭', PAL: '🇵🇭', MAS: '🇲🇾',
    // Middle East
    UAE: '🇦🇪', ETD: '🇦🇪', QTR: '🇶🇦', ELY: '🇮🇱', SVA: '🇸🇦',
    // Oceania
    QFA: '🇦🇺', ANZ: '🇳🇿', VOZ: '🇦🇺',
    // Latin America
    AMX: '🇲🇽', AVA: '🇨🇴', LAN: '🇨🇱', LPE: '🇵🇪', TAM: '🇧🇷',
    CMP: '🇵🇦', ARG: '🇦🇷',
    // Africa
    SAA: '🇿🇦', ETH: '🇪🇹', RAM: '🇲🇦', MSR: '🇪🇬',
  };
  const prefix = clean.slice(0, 3);
  if (airlineFlags[prefix]) return airlineFlags[prefix];

  // Registration-based (general aviation) — first char of N-number style
  if (clean.length > 1 && !isNaN(Number(clean.charAt(1)))) {
    const regFlags: Record<string, string> = {
      N: '🇺🇸', C: '🇨🇦', G: '🇬🇧', D: '🇩🇪', F: '🇫🇷',
      I: '🇮🇹', JA: '🇯🇵', VH: '🇦🇺', ZK: '🇳🇿', EI: '🇮🇪',
      OE: '🇦🇹', HB: '🇨🇭', PH: '🇳🇱', OY: '🇩🇰', SE: '🇸🇪',
    };
    if (regFlags[clean.slice(0, 2)]) return regFlags[clean.slice(0, 2)];
    if (regFlags[clean.charAt(0)]) return regFlags[clean.charAt(0)];
  }

  return '🌐';
}

/**
 * ISO 3166-1 alpha-2 country code (lowercase) for an airport's home country.
 * Used to pull a universal flag image (flagcdn.com) that renders on every
 * platform — unlike country-flag emojis, which Windows can't render.
 */
const AIRPORT_COUNTRY: Record<string, string> = {
  // United States
  JFK: 'us', LGA: 'us', EWR: 'us', LAX: 'us', SFO: 'us', ORD: 'us', ATL: 'us',
  MIA: 'us', DFW: 'us', BOS: 'us', SEA: 'us', DEN: 'us', PBI: 'us', FLL: 'us',
  MCO: 'us', SJU: 'us', DCA: 'us', IAD: 'us', CLT: 'us', PHL: 'us', DTW: 'us',
  MSP: 'us', IAH: 'us', PHX: 'us', TEB: 'us', HPN: 'us', FRG: 'us', BWI: 'us',
  BUF: 'us', ROC: 'us', SYR: 'us', PWM: 'us', BDL: 'us', CLE: 'us', PIT: 'us',
  RDU: 'us', ORF: 'us', ACK: 'us', MVY: 'us', APF: 'us', VQQ: 'us', GSO: 'us',
  // Canada
  YUL: 'ca', YYZ: 'ca', YVR: 'ca',
  // United Kingdom / Europe
  LHR: 'gb', LGW: 'gb', MAN: 'gb',
  CDG: 'fr', ORY: 'fr', NCE: 'fr',
  FRA: 'de', MUC: 'de', TXL: 'de',
  AMS: 'nl', BRU: 'be', MAD: 'es', BCN: 'es', FCO: 'it', MXP: 'it',
  ZRH: 'ch', VIE: 'at', CPH: 'dk', ARN: 'se', OSL: 'no', HEL: 'fi',
  LIS: 'pt', DUB: 'ie',
  // Asia
  HND: 'jp', NRT: 'jp', ICN: 'kr', HKG: 'hk', SIN: 'sg',
  PEK: 'cn', PVG: 'cn', TPE: 'tw', BKK: 'th', MNL: 'ph', KUL: 'my',
  // Middle East
  DXB: 'ae', AUH: 'ae', DOH: 'qa', TLV: 'il', JED: 'sa',
  // Oceania
  SYD: 'au', MEL: 'au', AKL: 'nz',
  // Latin America
  MEX: 'mx', CUN: 'mx',
  BOG: 'co', LIM: 'pe', SCL: 'cl', GRU: 'br', GIG: 'br',
  PTY: 'pa', EZE: 'ar',
  // Caribbean
  NAS: 'bs',
  // Africa
  JNB: 'za', ADD: 'et', CMN: 'ma', CAI: 'eg',
};

export function getAirportCountry(code: string): string | null {
  if (!code) return null;
  return AIRPORT_COUNTRY[code.trim().toUpperCase()] ?? null;
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

