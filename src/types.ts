/**
 * Type declarations for Bed-Stuy Console
 */

export interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weathercode: number;
    windspeed_10m: number;
    relativehumidity_2m: number;
    precipitation_probability: number;
  };
}

export interface Aircraft {
  flight?: string;
  callsign?: string;
  r?: string; // registration as fallback
  t?: string; // aircraft type
  alt_baro?: number | string;
  alt_geom?: number | string;
  gs?: number;
  track?: number;
}

export interface AirspaceData {
  ac?: Aircraft[];
}

export interface TransitRoute {
  N: number[];
  S: number[];
}

export interface TransitData {
  A: TransitRoute;
  C: TransitRoute;
  G: TransitRoute;
}
