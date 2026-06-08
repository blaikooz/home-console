/**
 * Living Room Console — Bed-Stuy Dashboard
 * Retro terminal-style single-page console for weather, airspace, and transit.
 */

import { useState, useEffect, useMemo } from 'react';
import { Plane, Navigation, Gauge, ArrowUp, Globe } from 'lucide-react';
import { WeatherData, AirspaceData, TransitData } from './types';
import { mapWmoCode, getCompassHeading, formatTime, getWeatherAscii, getFlightRoute, getAirlineName } from './utils';

function renderArrivalPill(min: number, index: number) {
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
    <span key={index} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm md:text-base font-black font-mono select-none transition-all duration-200 ${borderClass} ${textClass}`}>
      <span>{min}</span>
      <span className="text-[11px] md:text-xs font-black tracking-wider opacity-90">MIN</span>
    </span>
  );
}

export default function App() {
  // Time and Date State (updates every second)
  const [now, setNow] = useState<Date>(new Date());

  // --- WEATHER STATE ---
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<'loading' | 'idle' | 'updating' | 'error'>('loading');
  const [weatherLastUpdated, setWeatherLastUpdated] = useState<string>('NEVER');

  // --- AIRSPACE STATE ---
  const [airspace, setAirspace] = useState<AirspaceData | null>(null);
  const [airspaceStatus, setAirspaceStatus] = useState<'loading' | 'idle' | 'updating' | 'error'>('loading');
  const [airspaceLastUpdated, setAirspaceLastUpdated] = useState<string>('NEVER');

  // --- TRANSIT STATE ---
  const [transit, setTransit] = useState<TransitData | null>(null);
  const [transitStatus, setTransitStatus] = useState<'loading' | 'idle' | 'updating' | 'error'>('loading');
  const [transitLastUpdated, setTransitLastUpdated] = useState<string>('NEVER');

  // Update Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- INDEPENDENT FETCH ACTIONS ---

  // WEATHER API (Refresh every 10 mins)
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
      // Auto-retry in 15 seconds if failed
      const retryTimeout = setTimeout(fetchWeather, 15000);
      return () => clearTimeout(retryTimeout);
    }
  };

  // AIRSPACE API (Refresh every 15 seconds)
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
      // Auto-retry in 15 seconds if failed
      const retryTimeout = setTimeout(fetchAirspace, 15000);
      return () => clearTimeout(retryTimeout);
    }
  };

  // TRANSIT API (Refresh every 20 seconds)
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
      // Auto-retry in 10 seconds if failed
      const retryTimeout = setTimeout(fetchTransit, 10000);
      return () => clearTimeout(retryTimeout);
    }
  };

  // Run initial fetches and setup intervals
  useEffect(() => {
    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 10 * 60 * 1000); // 10 minutes

    fetchAirspace();
    const airspaceTimer = setInterval(fetchAirspace, 15 * 1000); // 15 seconds

    fetchTransit();
    const transitTimer = setInterval(fetchTransit, 20 * 1000); // 20 seconds

    return () => {
      clearInterval(weatherTimer);
      clearInterval(airspaceTimer);
      clearInterval(transitTimer);
    };
  }, []);

  // --- TRANSIT RENDERING DATA FORMAT ---
  // Format stop descriptions to display clean destinations
  const routeConfigs = [
    { route: 'A', dir: 'N', dest: 'MANHATTAN' },
    { route: 'A', dir: 'S', dest: 'ROCKAWAY' },
    { route: 'C', dir: 'N', dest: 'MANHATTAN' },
    { route: 'C', dir: 'S', dest: 'EUCLID AV' },
    { route: 'G', dir: 'N', dest: 'COURT SQ' },
    { route: 'G', dir: 'S', dest: 'CHURCH AV' },
  ];

  // --- AIRSPACE COMPUTATIONS ---
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

        return {
          flight,
          type,
          altNum,
          altDisplay,
          speedDisplay,
          heading,
          route,
          airline
        };
      })
      .sort((a, b) => a.altNum - b.altNum);
  }, [airspace]);

  // Format header dates
  const { day, time12hStr } = formatTime(now);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden p-4 select-none relative bg-black text-[#00ff41] font-mono leading-normal">
      
      {/* CRT overlay */}
      <div className="crt-overlay"></div>

      {/* HEADER SECTION */}
      <header className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end border-b-2 border-[#005a18] pb-3 mb-6 relative z-10">
        <div className="flex flex-col font-black">
          <div className="text-sm label-dim font-extrabold tracking-widest">SYSTEM_DATE // RTC_SYNC</div>
          <div className="text-3xl font-black glitch-text phosphor-glow tracking-tight">{day}</div>
        </div>
        <div className="flex items-center justify-center text-center whitespace-nowrap">
          <div className="text-6xl font-black glitch-text phosphor-glow tracking-widest text-[#00ff41] leading-none">{time12hStr}</div>
        </div>
        <div className="md:text-right text-left flex flex-col">
          <div className="text-sm label-dim font-extrabold tracking-widest">COORDINATES: 40.6832, -73.9442</div>
          <div className="text-2xl font-black phosphor-glow">QUINCY ST &times; NOSTRAND AVE // BED-STUY</div>
        </div>
      </header>

      {/* DASHBOARD GRID PANELS */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden relative z-10">
        
        {/* PANEL 1: WEATHER */}
        <section className="flex-1 min-w-0 panel-border flex flex-col bg-black overflow-hidden relative">
          <div className="panel-header flex items-center justify-center text-center text-sm font-extrabold py-2 px-4">
            <span>[ WEATHER STATION ]</span>
          </div>
          
          <div className="p-4 md:p-5 flex-1 flex flex-col justify-between overflow-hidden bg-black">
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
                <div className="space-y-4 md:space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-6xl md:text-7xl font-black value-bright glitch-text phosphor-glow">{Math.round(weather!.current.temperature_2m)}&deg;F</span>
                    <div className="text-right">
                      <div className="label-dim text-xs font-extrabold tracking-wider">CONDITION</div>
                      <div className="text-2xl md:text-3xl font-black phosphor-glow">{mapWmoCode(weather!.current.weathercode)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t-2 border-[#005a18] pt-3">
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">FEELS LIKE</div>
                      <div className="text-xl value-bright font-black">{Math.round(weather!.current.apparent_temperature)}&deg;F</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">HUMIDITY</div>
                      <div className="text-xl value-bright font-black">{weather!.current.relativehumidity_2m}%</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">WIND SPEED</div>
                      <div className="text-xl value-bright font-black">{weather!.current.windspeed_10m} MPH</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs label-dim font-extrabold tracking-wider">PRECIP CHANCE</div>
                      <div className="text-xl value-bright font-black">{weather!.current.precipitation_probability}%</div>
                    </div>
                  </div>
                </div>

                {/* ASCII Art section wrapper to prevent scale from shifting the top border */}
                <div className="flex-1 mt-4 border-t-2 border-[#005a18] flex items-center justify-center overflow-hidden">
                  <div className="font-mono text-sm sm:text-base md:text-lg lg:text-xl text-[#00ff41] font-black leading-normal whitespace-pre scale-110 lg:scale-125 transition-transform duration-500">
                    {getWeatherAscii(weather!.current.weathercode, now.getSeconds())}
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-auto border-t-2 border-[#005a18] pt-3 text-xs label-dim font-extrabold flex justify-between items-center gap-2">
              <span>LOC: BEDFORD-STUYVESANT</span>
              <div className="flex items-center gap-2 text-[10px] md:text-xs shrink-0">
                {weatherStatus === 'updating' && <span className="text-[#00ff41] font-black animate-pulse">[UPDATING]</span>}
                {weatherStatus === 'error' && <span className="text-[#ff453a] font-black animate-pulse">[SIGNAL LOST]</span>}
                <span>LAST UPDATED: {weatherLastUpdated}</span>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL 2: AIRSPACE */}
        <section className="flex-1 min-w-0 panel-border flex flex-col bg-black overflow-hidden relative">
          <div className="panel-header flex items-center justify-center text-center text-sm font-extrabold py-2 px-4">
            <span>[ RADAR AIRSPACE CONTROL ]</span>
          </div>

          <div className="p-4 md:p-5 flex-1 flex flex-col justify-between overflow-hidden bg-black">
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
                
                <div className="flex justify-between text-xs mb-3 label-dim font-black">
                  <span>RANGE: 5 NAUTICAL MILES</span>
                  <span>SCAN: MULTI-PASS COMPLETED</span>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    {airspaceFlights.length === 0 ? (
                      <div className="py-12 text-center text-sm label-dim border border-dashed border-[#005a18]/40 rounded">
                        <div className="font-black mb-2 text-base">NO TRAFFIC DETECTED</div>
                        <div className="text-xs font-bold leading-relaxed">skies are empty within Brooklyn 5-mile airspace sector</div>
                      </div>
                    ) : (
                      airspaceFlights.map((flight, idx) => (
                        <div key={idx} className="border-2 border-[#005a18] bg-black p-3.5 rounded relative flex flex-col justify-between hover:bg-[#001704]/40 transition-colors gap-2">
                          {/* Corner braces for terminal retro visual feel */}
                          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#00ff41]"></div>
                          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#00ff41]"></div>
                          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#00ff41]"></div>
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#00ff41]"></div>
                          
                          <div className="flex justify-between items-center border-b border-[#005a18]/70 pb-2 animate-pulse-slow">
                            <div className="flex items-center gap-2">
                              <Plane className="w-5 h-5 text-[#00ff41]" />
                              <div>
                                <div className="text-lg font-black tracking-widest text-[#00ff41] leading-none">{flight.flight}</div>
                                <div className="text-[10px] label-dim font-bold mt-0.5">AIRCRAFT: {flight.type}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm md:text-base font-black bg-[#005a18]/40 px-3.5 py-1.5 rounded bg-black text-[#00ff41] border-2 border-[#005a18] shadow-[0_0_10px_rgba(0,255,65,0.15)] whitespace-nowrap tracking-wider">
                                {flight.route}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                            <div className="flex flex-col bg-[#001103] p-1.5 rounded border border-[#005a18]/40">
                              <div className="flex items-center gap-1 label-dim text-[9px] font-black uppercase">
                                <ArrowUp className="w-3.5 h-3.5 text-[#00ff41]" />
                                <span>ALTITUDE</span>
                              </div>
                              <span className="font-extrabold value-bright text-xs md:text-sm mt-0.5 leading-none">{flight.altDisplay}</span>
                            </div>

                            <div className="flex flex-col bg-[#001103] p-1.5 rounded border border-[#005a18]/40">
                              <div className="flex items-center gap-1 label-dim text-[9px] font-black uppercase">
                                <Gauge className="w-3.5 h-3.5 text-[#00ff41]" />
                                <span>GSPEED</span>
                              </div>
                              <span className="font-extrabold value-bright text-xs md:text-sm mt-0.5 leading-none">{flight.speedDisplay}</span>
                            </div>

                            <div className="flex flex-col bg-[#001103] p-1.5 rounded border border-[#005a18]/40 overflow-hidden">
                              <div className="flex items-center gap-1 label-dim text-[9px] font-black uppercase">
                                <Globe className="w-3.5 h-3.5 text-[#00ff41]" />
                                <span>AIRLINE</span>
                              </div>
                              <span className="font-extrabold value-bright text-xs md:text-sm mt-0.5 leading-none truncate whitespace-nowrap">{flight.airline}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-auto">
              <div className="text-xs label-dim bg-[#001103] p-2 mb-3 font-extrabold tracking-widest border border-[#005a18]">
                ACTIVE TRANSCEIVER: NY_JFK_APP_SOUTH // 5NM_SWEEP
              </div>
              <div className="border-t-2 border-[#005a18] pt-3 text-xs label-dim font-extrabold flex justify-between items-center gap-2">
                <span>SYSTEM ID: BEDSTUY-RAD01</span>
                <div className="flex items-center gap-2 shrink-0">
                  {airspaceStatus === 'updating' && <span className="text-[#00ff41] font-black animate-pulse">[UPDATING]</span>}
                  {airspaceStatus === 'error' && <span className="text-[#ff453a] font-black animate-pulse">[SIGNAL LOST]</span>}
                  <span>LAST UPDATED: {airspaceLastUpdated}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL 3: TRANSIT */}
        <section className="flex-1 min-w-0 panel-border flex flex-col bg-black overflow-hidden relative">
          <div className="panel-header flex items-center justify-center text-center text-sm font-extrabold py-2 px-4">
            <span>[ REALTIME TRANSIT MONITOR ]</span>
          </div>

          <div className="p-4 md:p-5 flex-1 flex flex-col justify-between overflow-hidden bg-black">
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
              <div className="flex-1 flex flex-col justify-start py-1 overflow-hidden space-y-3.5">
                
                {/* Station Section: Myrtle-Willoughby G */}
                <div className="border-2 border-[#00a82d]/50 bg-[#00a82d]/5 p-1.5 px-2 rounded-lg space-y-0.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-[#00a82d]/20">
                    <span className="bg-[#00a82d] text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-xs select-none font-sans shadow-md">G</span>
                    <span className="text-xs font-black font-mono tracking-widest whitespace-normal break-words text-[#00a82d]">MYRTLE-WILLOUGHBY &times; G_LOCAL</span>
                  </div>
                  {['N', 'S'].map(dir => {
                    const dest = dir === 'N' ? 'COURT SQ' : 'CHURCH AV';
                    const arrivals = transit?.['G']?.[dir as 'N' | 'S'] || [];
                    return (
                      <div key={dir} className="flex justify-between items-center px-1 py-0 gap-2 rounded border border-transparent overflow-hidden">
                        <span className="text-xs label-dim font-black tracking-widest font-mono whitespace-nowrap truncate mr-2">{dest}</span>
                        <div className="flex flex-wrap gap-1 justify-end text-right">
                          {arrivals.length === 0 ? (
                            <span className="text-[10px] label-dim italic font-bold">NO RUNNING DEP</span>
                          ) : (
                            arrivals.map((min, index) => renderArrivalPill(min, index))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Station Section: Nostrand Av A */}
                <div className="border-2 border-[#0a84ff]/50 bg-[#0a84ff]/5 p-1.5 px-2 rounded-lg space-y-0.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-[#0a84ff]/20">
                    <span className="bg-[#0039a6] text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-xs select-none font-sans shadow-md">A</span>
                    <span className="text-xs font-black font-mono tracking-widest whitespace-normal break-words text-[#0a84ff]">NOSTRAND AV &times; A_EXPRESS</span>
                  </div>
                  {['N', 'S'].map(dir => {
                    const dest = dir === 'N' ? 'MANHATTAN' : 'ROCKAWAY';
                    const arrivals = transit?.['A']?.[dir as 'N' | 'S'] || [];
                    return (
                      <div key={dir} className="flex justify-between items-center px-1 py-0 gap-2 rounded border border-transparent overflow-hidden">
                        <span className="text-xs label-dim font-black tracking-widest font-mono whitespace-nowrap truncate mr-2">{dest}</span>
                        <div className="flex flex-wrap gap-1 justify-end text-right">
                          {arrivals.length === 0 ? (
                            <span className="text-[10px] label-dim italic font-bold">NO RUNNING DEP</span>
                          ) : (
                            arrivals.map((min, index) => renderArrivalPill(min, index))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Station Section: Nostrand Av C */}
                <div className="border-2 border-[#0a84ff]/50 bg-[#0a84ff]/5 p-1.5 px-2 rounded-lg space-y-0.5">
                  <div className="flex items-center gap-2 pb-0.5 border-b border-[#0a84ff]/20">
                    <span className="bg-[#0039a6] text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-xs select-none font-sans shadow-md">C</span>
                    <span className="text-xs font-black font-mono tracking-widest whitespace-normal break-words text-[#0a84ff]">NOSTRAND AV &times; C_LOCAL</span>
                  </div>
                  {['N', 'S'].map(dir => {
                    const dest = dir === 'N' ? 'MANHATTAN' : 'EUCLID AV';
                    const arrivals = transit?.['C']?.[dir as 'N' | 'S'] || [];
                    return (
                      <div key={dir} className="flex justify-between items-center px-1 py-0 gap-2 rounded border border-transparent overflow-hidden">
                        <span className="text-xs label-dim font-black tracking-widest font-mono whitespace-nowrap truncate mr-2">{dest}</span>
                        <div className="flex flex-wrap gap-1 justify-end text-right">
                          {arrivals.length === 0 ? (
                            <span className="text-[10px] label-dim italic font-bold">NO RUNNING DEP</span>
                          ) : (
                            arrivals.map((min, index) => renderArrivalPill(min, index))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}

            <div className="mt-auto">
              <div className="border-t-2 border-[#005a18] pt-3 text-xs label-dim font-extrabold flex justify-between items-center gap-2">
                <span>STOPS: A42 / G29</span>
                <div className="flex items-center gap-2 shrink-0">
                  {transitStatus === 'updating' && <span className="text-[#00ff41] font-black animate-pulse">[UPDATING]</span>}
                  {transitStatus === 'error' && <span className="text-[#ff453a] font-black animate-pulse">[SIGNAL LOST]</span>}
                  <span>LAST UPDATED: {transitLastUpdated}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

    </div>
  );
}
