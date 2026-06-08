/**
 * Living Room Console — Bed-Stuy Dashboard
 * Retro terminal-style single-page console for weather, airspace, and transit.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Gauge, ArrowUp, Globe } from 'lucide-react';
import BootScreen from './BootScreen';
import WeatherScene from './WeatherScene';
import { DeviceType, WeatherData, AirspaceData, TransitData } from './types';
import { mapWmoCode, getCompassHeading, formatTime, getFlightRoute, getAirlineName, getCountryFlag, getAirportCountry } from './utils';

// Sizing profile per chosen device. Picked at boot, then locked for the session.
const SIZING: Record<DeviceType, {
  root: string;
  headerWrap: string;
  headerGap: string;
  headerDate: string;
  headerTime: string;
  headerLoc: string;
  panelsWrap: string;
  panelPad: string;
  weatherTemp: string;
  weatherCond: string;
  weatherStat: string;
  weatherAscii: string;
  arrivalPill: string;
  arrivalPillMin: string;
  routeBadge: string;
  routeLabel: string;
}> = {
  desktop: {
    root: 'p-4 h-screen overflow-hidden',
    headerWrap: 'grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-5',
    headerGap: 'gap-4',
    headerDate: 'text-3xl',
    headerTime: 'text-6xl',
    headerLoc: 'text-3xl',
    panelsWrap: 'flex-1 flex flex-row gap-4 overflow-hidden',
    panelPad: 'p-5',
    weatherTemp: 'text-7xl',
    weatherCond: 'text-3xl',
    weatherStat: 'text-xl',
    weatherAscii: 'text-xl scale-125',
    arrivalPill: 'px-3 py-1 text-base',
    arrivalPillMin: 'text-xs',
    routeBadge: 'w-6 h-6 text-xs',
    routeLabel: 'text-xs',
  },
  tablet: {
    root: 'p-3 h-screen overflow-hidden',
    headerWrap: 'grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-3',
    headerGap: 'gap-3',
    headerDate: 'text-lg',
    headerTime: 'text-4xl',
    headerLoc: 'text-lg',
    panelsWrap: 'flex-1 flex flex-row gap-3 overflow-hidden',
    panelPad: 'p-3',
    weatherTemp: 'text-5xl',
    weatherCond: 'text-xl',
    weatherStat: 'text-base',
    weatherAscii: 'text-sm scale-100',
    arrivalPill: 'px-2 py-0.5 text-sm',
    arrivalPillMin: 'text-[10px]',
    routeBadge: 'w-5 h-5 text-[10px]',
    routeLabel: 'text-[11px]',
  },
  mobile: {
    root: 'p-2 min-h-screen overflow-y-auto',
    headerWrap: 'flex flex-col items-center text-center gap-1 mb-3',
    headerGap: 'gap-2',
    headerDate: 'text-base',
    headerTime: 'text-4xl',
    headerLoc: 'text-base',
    panelsWrap: 'flex-1 flex flex-col gap-3',
    panelPad: 'p-3',
    weatherTemp: 'text-5xl',
    weatherCond: 'text-xl',
    weatherStat: 'text-base',
    weatherAscii: 'text-sm scale-100',
    arrivalPill: 'px-2 py-0.5 text-sm',
    arrivalPillMin: 'text-[10px]',
    routeBadge: 'w-5 h-5 text-[10px]',
    routeLabel: 'text-[11px]',
  },
};

function makeArrivalPill(s: typeof SIZING[DeviceType]) {
  return function renderArrivalPill(min: number, index: number) {
    let borderClass = '';
    let textClass = '';
    if (min <= 5) {
      borderClass = 'border-2 border-[#ff453a] bg-red-950/25';
      textClass = 'text-[#ff453a] font-black shadow-[0_0_10px_rgba(255,69,58,0.45)]';
    } else if (min <= 10) {
      borderClass = 'border-2 border-[#ffd60a] bg-yellow-950/25';
      textClass = 'text-[#ffd60a] font-black shadow-[0_0_10px_rgba(255,214,10,0.45)]';
    } else if (min <= 15) {
      borderClass = 'border-2 border-[#30d158] bg-green-950/25';
      textClass = 'text-[#30d158] font-black shadow-[0_0_10px_rgba(48,209,88,0.45)]';
    } else {
      borderClass = 'border-2 border-[#005a18]/60 bg-[#001103]';
      textClass = 'text-[#00ff41] font-black';
    }

    return (
      <span key={index} className={`inline-flex items-center gap-1.5 rounded-md font-black font-mono select-none transition-all duration-200 ${s.arrivalPill} ${borderClass} ${textClass}`}>
        <span>{min}</span>
        <span className={`font-black tracking-wider opacity-90 ${s.arrivalPillMin}`}>MIN</span>
      </span>
    );
  };
}

export default function App() {
  const [device, setDevice] = useState<DeviceType | null>(null);

  if (!device) {
    return <BootScreen onSelect={setDevice} />;
  }

  return <Dashboard device={device} />;
}

type FeedStatus = 'loading' | 'idle' | 'updating' | 'error';

function AirportTag({ code }: { code: string }) {
  const cc = getAirportCountry(code);
  return (
    <span className="inline-flex items-center gap-2">
      {cc && (
        <img
          src={`https://flagcdn.com/w40/${cc}.png`}
          srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
          alt=""
          aria-hidden="true"
          className="h-5 w-auto inline-block rounded-sm shadow-[0_0_3px_rgba(0,0,0,0.6)]"
          loading="lazy"
        />
      )}
      <span>{code}</span>
    </span>
  );
}

function RouteWithFlags({ route }: { route: string }) {
  const parts = route.split('➔').map(s => s.trim());
  if (parts.length !== 2) return <>{route}</>;
  return (
    <span className="inline-flex items-center gap-3">
      <AirportTag code={parts[0]} />
      <span aria-hidden="true" className="opacity-80">➔</span>
      <AirportTag code={parts[1]} />
    </span>
  );
}

function FooterLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 text-[10px] font-extrabold tracking-wider leading-snug">
      <span className="text-[#005a18]">&gt;</span>
      <span className="label-dim">{label}:</span>
      <span className="text-[#00ff41]">{value}</span>
    </div>
  );
}

function StatusValue({ status }: { status: FeedStatus }) {
  if (status === 'updating') return <span className="text-[#00ff41] animate-pulse">UPDATING...</span>;
  if (status === 'error') return <span className="text-[#ff453a] animate-pulse">SIGNAL LOST</span>;
  if (status === 'loading') return <span className="label-dim animate-pulse">CONNECTING...</span>;
  return <span className="text-[#00ff41]">ONLINE</span>;
}

function Dashboard({ device }: { device: DeviceType }) {
  const s = SIZING[device];
  const renderArrivalPill = useMemo(() => makeArrivalPill(s), [s]);

  const [now, setNow] = useState<Date>(new Date());

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'idle' | 'updating' | 'error'>('loading');
  const [weatherLastUpdated, setWeatherLastUpdated] = useState<string>('NEVER');

  const [airspace, setAirspace] = useState<AirspaceData | null>(null);
  const [airspaceStatus, setAirspaceStatus] = useState<'loading' | 'idle' | 'updating' | 'error'>('loading');
  const [airspaceLastUpdated, setAirspaceLastUpdated] = useState<string>('NEVER');

  const [transit, setTransit] = useState<TransitData | null>(null);
  const [transitStatus, setTransitStatus] = useState<'loading' | 'idle' | 'updating' | 'error'>('loading');
  const [transitLastUpdated, setTransitLastUpdated] = useState<string>('NEVER');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchWeather = async () => {
    setWeatherStatus(prev => prev === 'loading' ? 'loading' : 'updating');
    try {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error('Weather API bad status');
      const data = await res.json();
      setWeather(data);
      setWeatherStatus('idle');
      setWeatherLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Weather update error. Retry in 15 seconds.', err);
      setWeatherStatus('error');
      setTimeout(fetchWeather, 15000);
    }
  };

  const fetchAirspace = async () => {
    setAirspaceStatus(prev => prev === 'loading' ? 'loading' : 'updating');
    try {
      const res = await fetch('/api/airspace');
      if (!res.ok) throw new Error('Airspace API bad status');
      const data = await res.json();
      setAirspace(data);
      setAirspaceStatus('idle');
      setAirspaceLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Airspace update error. Retry in 15 seconds.', err);
      setAirspaceStatus('error');
      setTimeout(fetchAirspace, 15000);
    }
  };

  const fetchTransit = async () => {
    setTransitStatus(prev => prev === 'loading' ? 'loading' : 'updating');
    try {
      const res = await fetch('/api/transit');
      if (!res.ok) throw new Error('Transit API bad status');
      const data = await res.json();
      setTransit(data);
      setTransitStatus('idle');
      setTransitLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Transit update error. Retry in 10 seconds.', err);
      setTransitStatus('error');
      setTimeout(fetchTransit, 10000);
    }
  };

  useEffect(() => {
    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 10 * 60 * 1000);

    fetchAirspace();
    const airspaceTimer = setInterval(fetchAirspace, 15 * 1000);

    fetchTransit();
    const transitTimer = setInterval(fetchTransit, 20 * 1000);

    return () => {
      clearInterval(weatherTimer);
      clearInterval(airspaceTimer);
      clearInterval(transitTimer);
    };
  }, []);

  const airspaceFlights = useMemo(() => {
    if (!airspace?.ac) return [];
    return [...airspace.ac]
      .map(ac => {
        const flightRaw = ac.flight || ac.callsign || ac.r || 'UNKN';
        const flight = flightRaw.trim();
        const type = ac.t || 'UNKN';

        let altNum = 0;
        let altDisplay = '';
        if (ac.alt_baro === 'ground' || ac.alt_geom === 'ground') {
          altNum = 0;
          altDisplay = 'GROUND';
        } else {
          const baro = Number(ac.alt_baro);
          const geom = Number(ac.alt_geom);
          const altVal = !isNaN(baro) ? baro : !isNaN(geom) ? geom : null;
          if (altVal !== null) {
            altNum = altVal;
            altDisplay = `${altVal.toLocaleString()} FT`;
          } else {
            altNum = 999999;
            altDisplay = 'N/A';
          }
        }

        const speedVal = ac.gs ? Number(ac.gs) : null;
        const speedDisplay = speedVal !== null ? `${speedVal} KTS` : 'N/A';

        const heading = getCompassHeading(ac.track);
        const route = getFlightRoute(flight);
        const airline = getAirlineName(flight);
        const flag = getCountryFlag(flight);

        return { flight, type, altNum, altDisplay, speedDisplay, heading, route, airline, flag };
      })
      .sort((a, b) => a.altNum - b.altNum);
  }, [airspace]);

  const { day, time12hStr } = formatTime(now);

  return (
    <div className={`w-screen flex flex-col select-none relative bg-black text-[#00ff41] font-mono leading-normal ${s.root}`}>
      <div className="crt-overlay"></div>

      {/* HEADER */}
      <header className={`items-center border-b-2 border-[#005a18] pb-3 relative z-10 ${s.headerWrap}`}>
        <div className="flex items-center">
          <div className={`font-black glitch-text phosphor-glow tracking-tight ${s.headerDate}`}>{day}</div>
        </div>
        <div className="flex items-center justify-center text-center whitespace-nowrap">
          <div className={`font-black glitch-text phosphor-glow tracking-widest text-[#00ff41] leading-none ${s.headerTime}`}>{time12hStr}</div>
        </div>
        <div className={`flex items-center ${device === 'mobile' ? 'justify-center' : 'justify-end'}`}>
          <div className={`font-black phosphor-glow tracking-widest ${s.headerLoc}`}>BED-STUY</div>
        </div>
      </header>

      {/* PANELS */}
      <div className={`relative z-10 ${s.panelsWrap}`}>

        {/* PANEL 1: WEATHER */}
        <section className="flex-1 min-w-0 panel-border flex flex-col bg-black overflow-hidden relative">
          <div className="panel-header flex items-center justify-center text-center text-lg font-extrabold py-2.5 px-4">
            <span>[ WEATHER STATION ]</span>
          </div>

          <div className={`flex-1 flex flex-col justify-between overflow-hidden bg-black ${s.panelPad}`}>
            {weatherStatus === 'loading' && !weather ? (
              <div className="flex-1 flex flex-col items-center justify-center text-sm label-dim animate-pulse">
                <span className="font-extrabold">ESTABLISHING SAT-LINK...</span>
                <span className="mt-2 text-xs">COORDINATES (40.6832, -73.9442)</span>
              </div>
            ) : weatherStatus === 'error' && !weather ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#ff3b30] uppercase border-2 border-red-900/60 bg-red-950/30 p-6">
                <span className="text-base font-black tracking-widest animate-pulse">SIGNAL LOST</span>
                <span className="text-xs mt-2 text-red-500 font-bold">WEATHER STAT_LINK UNRESPONSIVE</span>
                <span className="text-xs label-dim mt-4">AUTO-RETRIES SECURING...</span>
              </div>
            ) : (
              <div className={`flex flex-col justify-between h-full ${weatherStatus === 'updating' ? 'opacity-65' : 'opacity-100'} transition-opacity duration-300`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-black value-bright glitch-text phosphor-glow ${s.weatherTemp}`}>{Math.round(weather!.current.temperature_2m)}&deg;F</span>
                    <div className="text-right min-w-0">
                      <div className="label-dim text-xs font-extrabold tracking-wider">CONDITION</div>
                      <div className={`font-black phosphor-glow ${s.weatherCond}`}>{mapWmoCode(weather!.current.weathercode)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t-2 border-[#005a18] pt-3">
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">FEELS LIKE</div>
                      <div className={`value-bright font-black ${s.weatherStat}`}>{Math.round(weather!.current.apparent_temperature)}&deg;F</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">HUMIDITY</div>
                      <div className={`value-bright font-black ${s.weatherStat}`}>{weather!.current.relativehumidity_2m}%</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">WIND SPEED</div>
                      <div className={`value-bright font-black ${s.weatherStat}`}>{weather!.current.windspeed_10m} MPH</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">PRECIP CHANCE</div>
                      <div className={`value-bright font-black ${s.weatherStat}`}>{weather!.current.precipitation_probability}%</div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 mt-4 border-t-2 border-[#005a18] flex items-center justify-center overflow-hidden">
                  <div className={`font-mono text-[#00ff41] font-black leading-normal whitespace-pre ${s.weatherAscii}`}>
                    <WeatherScene code={weather!.current.weathercode} hour={now.getHours()} />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto border-t-2 border-[#005a18] pt-3 space-y-1">
              <FooterLine label="COORDINATES" value="40.6832, -73.9442" />
              <FooterLine label="SOURCE" value="OPEN-METEO" />
              <FooterLine label="STATUS" value={<StatusValue status={weatherStatus} />} />
              <FooterLine label="LAST UPDATED" value={weatherLastUpdated} />
            </div>
          </div>
        </section>

        {/* PANEL 2: AIRSPACE */}
        <section className="flex-1 min-w-0 panel-border flex flex-col bg-black overflow-hidden relative">
          <div className="panel-header flex items-center justify-center text-center text-lg font-extrabold py-2.5 px-4">
            <span>[ AIRSPACE RADAR ]</span>
          </div>

          <div className={`flex-1 flex flex-col justify-between overflow-hidden bg-black ${s.panelPad}`}>
            {airspaceStatus === 'loading' && !airspace ? (
              <div className="flex-1 flex flex-col items-center justify-center text-sm label-dim animate-pulse">
                <span className="font-extrabold">RADAR BOOT SEQUENCE...</span>
                <span className="mt-2 text-xs">SWEEPING RANGE: 5 NM</span>
              </div>
            ) : airspaceStatus === 'error' && !airspace ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#ff3b30] uppercase border-2 border-red-900/60 bg-red-950/30 p-6">
                <span className="text-base font-black tracking-widest animate-pulse">SIGNAL LOST</span>
                <span className="text-xs mt-2 text-red-500 font-bold">ADSB SATELLITE CONNECTION OFFLINE</span>
                <span className="text-xs label-dim mt-4">AUTO-RETRIES ENGAGED...</span>
              </div>
            ) : (
              <div className={`flex-1 flex flex-col overflow-hidden ${airspaceStatus === 'updating' ? 'opacity-65' : 'opacity-100'} transition-opacity duration-300`}>

                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <div className="grid grid-cols-1 gap-3 mb-4">
                    {airspaceFlights.length === 0 ? (
                      <div className="py-12 text-center text-sm label-dim border border-dashed border-[#005a18]/40 rounded">
                        <div className="font-black mb-2 text-base">NO TRAFFIC DETECTED</div>
                        <div className="text-xs font-bold leading-relaxed">skies are empty within Brooklyn 5-mile airspace sector</div>
                      </div>
                    ) : (
                      airspaceFlights.map((flight, idx) => (
                        <div key={idx} className="border-2 border-[#005a18] bg-black p-3 rounded relative flex flex-col hover:bg-[#001704]/40 transition-colors gap-2.5">
                          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#00ff41]"></div>
                          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#00ff41]"></div>
                          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#00ff41]"></div>
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#00ff41]"></div>

                          {/* TITLE: plane + flag + callsign, centered */}
                          <div className="flex flex-col items-center text-center gap-0.5 border-b border-[#005a18]/70 pb-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-lg leading-none" aria-hidden="true">✈️</span>
                              <span className="text-lg leading-none" aria-hidden="true">{flight.flag}</span>
                              <span className="text-base font-black tracking-widest text-[#00ff41] leading-none phosphor-glow">{flight.flight}</span>
                            </div>
                            <div className="text-[10px] label-dim font-bold tracking-wider">AIRCRAFT: {flight.type}</div>
                          </div>

                          {/* ROUTE: destination tile, centered below title */}
                          <div className="flex justify-center py-1">
                            <span className="text-lg md:text-xl font-black px-5 py-2.5 rounded-md bg-[#1a1300] text-[#ffd60a] border-2 border-[#ffd60a]/70 shadow-[0_0_14px_rgba(255,214,10,0.3)] whitespace-nowrap tracking-wider phosphor-glow-amber">
                              <RouteWithFlags route={flight.route} />
                            </span>
                          </div>

                          {/* STATS: 3-col grid with per-cell color */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="flex flex-col bg-[#001103] p-1.5 rounded border border-[#00ff41]/40 min-w-0">
                              <div className="flex items-center gap-1 text-[#00aa2d] text-[9px] font-black uppercase">
                                <ArrowUp className="w-3.5 h-3.5 text-[#00ff41]" />
                                <span>ALTITUDE</span>
                              </div>
                              <span className="font-extrabold text-[#00ff41] text-xs mt-0.5 leading-none truncate">{flight.altDisplay}</span>
                            </div>

                            <div className="flex flex-col bg-[#001220] p-1.5 rounded border border-[#5ac8fa]/40 min-w-0">
                              <div className="flex items-center gap-1 text-[#5ac8fa]/80 text-[9px] font-black uppercase">
                                <Gauge className="w-3.5 h-3.5 text-[#5ac8fa]" />
                                <span>GSPEED</span>
                              </div>
                              <span className="font-extrabold text-[#5ac8fa] text-xs mt-0.5 leading-none truncate">{flight.speedDisplay}</span>
                            </div>

                            <div className="flex flex-col bg-[#1a1300] p-1.5 rounded border border-[#ffd60a]/40 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1 text-[#ffd60a]/80 text-[9px] font-black uppercase">
                                <Globe className="w-3.5 h-3.5 text-[#ffd60a]" />
                                <span>AIRLINE</span>
                              </div>
                              <span className="font-extrabold text-[#ffd60a] text-xs mt-0.5 leading-none truncate">{flight.airline}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto border-t-2 border-[#005a18] pt-3 space-y-1">
              <FooterLine label="SYSTEM ID" value="BEDSTUY-RAD01" />
              <FooterLine label="LOC" value="NY_JFK_APP_SOUTH // 5NM_SWEEP" />
              <FooterLine label="RANGE" value="5 NAUTICAL MILES" />
              <FooterLine label="SCAN" value="MULTI-PASS COMPLETED" />
              <FooterLine label="SOURCE" value="ADSB.LOL" />
              <FooterLine label="STATUS" value={<StatusValue status={airspaceStatus} />} />
              <FooterLine label="LAST UPDATED" value={airspaceLastUpdated} />
            </div>
          </div>
        </section>

        {/* PANEL 3: TRANSIT */}
        <section className="flex-1 min-w-0 panel-border flex flex-col bg-black overflow-hidden relative">
          <div className="panel-header flex items-center justify-center text-center text-lg font-extrabold py-2.5 px-4">
            <span>[ TRANSIT MONITOR ]</span>
          </div>

          <div className={`flex-1 flex flex-col justify-between overflow-hidden bg-black ${s.panelPad}`}>
            {transitStatus === 'loading' && !transit ? (
              <div className="flex-1 flex flex-col items-center justify-center text-sm label-dim animate-pulse">
                <span className="font-extrabold">CONNECTING MTA GTFS-RT FEEDS...</span>
                <span className="mt-2 text-xs">LINE INJECTIONS: A/C/E &amp; G</span>
              </div>
            ) : transitStatus === 'error' && !transit ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#ff3b30] uppercase border-2 border-red-900/60 bg-red-950/30 p-6">
                <span className="text-base font-black tracking-widest animate-pulse">SIGNAL LOST</span>
                <span className="text-xs mt-2 text-red-500 font-bold">MTA SCHEDULING INTERFACES OFFLINE</span>
                <span className="text-xs label-dim mt-4">AUTO-RETRIES CONNECTING...</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-start py-1 overflow-hidden space-y-3">

                {/* G */}
                <div className="border-2 border-[#00a82d]/50 bg-[#00a82d]/5 p-2 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-[#00a82d]/20">
                    <span className={`bg-[#00a82d] text-white rounded-full flex items-center justify-center font-black select-none font-sans shadow-md ${s.routeBadge}`}>G</span>
                    <span className={`font-black font-mono tracking-widest whitespace-normal break-words text-[#00a82d] ${s.routeLabel}`}>BEDFORD-NOSTRAND</span>
                  </div>
                  {(['N', 'S'] as const).map(dir => {
                    const dest = dir === 'N' ? 'COURT SQ' : 'CHURCH AV';
                    const arrivals = transit?.['G']?.[dir] || [];
                    return (
                      <div key={dir} className="px-1 space-y-1 overflow-hidden">
                        <div className={`label-dim font-black tracking-widest font-mono ${s.routeLabel}`}>{dest}</div>
                        {arrivals.length === 0
                          ? <div className="text-xs font-black tracking-widest text-[#ff453a] phosphor-glow-red">NOT RUNNING</div>
                          : <div className="flex flex-wrap gap-1">{arrivals.map((min, index) => renderArrivalPill(min, index))}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* A & C — both serve Nostrand Av */}
                <div className="border-2 border-[#0a84ff]/50 bg-[#0a84ff]/5 p-2 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-[#0a84ff]/20">
                    <div className="flex items-center gap-1">
                      <span className={`bg-[#0039a6] text-white rounded-full flex items-center justify-center font-black select-none font-sans shadow-md ${s.routeBadge}`}>A</span>
                      <span className={`bg-[#0039a6] text-white rounded-full flex items-center justify-center font-black select-none font-sans shadow-md ${s.routeBadge}`}>C</span>
                    </div>
                    <span className={`font-black font-mono tracking-widest whitespace-normal break-words text-[#0a84ff] ${s.routeLabel}`}>NOSTRAND AV</span>
                  </div>
                  {([
                    { route: 'A' as const, dir: 'N' as const, dest: 'MANHATTAN' },
                    { route: 'A' as const, dir: 'S' as const, dest: 'ROCKAWAY' },
                    { route: 'C' as const, dir: 'N' as const, dest: 'MANHATTAN' },
                    { route: 'C' as const, dir: 'S' as const, dest: 'EUCLID AV' },
                  ]).map(({ route, dir, dest }) => {
                    const arrivals = transit?.[route]?.[dir] || [];
                    return (
                      <div key={`${route}-${dir}`} className="px-1 space-y-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-[#0039a6] text-white rounded-full flex items-center justify-center font-black select-none font-sans shadow-md w-4 h-4 text-[10px]">{route}</span>
                          <span className={`label-dim font-black tracking-widest font-mono ${s.routeLabel}`}>{dest}</span>
                        </div>
                        {arrivals.length === 0
                          ? <div className="text-xs font-black tracking-widest text-[#ff453a] phosphor-glow-red ml-6">NOT RUNNING</div>
                          : <div className="flex flex-wrap gap-1 ml-6">{arrivals.map((min, index) => renderArrivalPill(min, index))}</div>}
                      </div>
                    );
                  })}
                </div>

              </div>
            )}

            <div className="mt-auto border-t-2 border-[#005a18] pt-3 space-y-1">
              <FooterLine label="STOPS" value="A42 / G33" />
              <FooterLine label="SOURCE" value="MTA GTFS-RT" />
              <FooterLine label="STATUS" value={<StatusValue status={transitStatus} />} />
              <FooterLine label="LAST UPDATED" value={transitLastUpdated} />
            </div>
          </div>
        </section>

      </div>

    </div>
  );
}
