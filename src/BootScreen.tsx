import { useEffect, useState } from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import type { DeviceType } from './types';

interface Props {
  onSelect: (device: DeviceType) => void;
}

const OPTIONS: { id: DeviceType; label: string; subtitle: string; Icon: typeof Monitor }[] = [
  { id: 'desktop', label: 'DESKTOP', subtitle: '1440px+ // WIDE LANDSCAPE', Icon: Monitor },
  { id: 'tablet',  label: 'TABLET',  subtitle: '1024–1366px // LANDSCAPE', Icon: Tablet },
  { id: 'mobile',  label: 'MOBILE',  subtitle: '375–480px // PORTRAIT',    Icon: Smartphone },
];

export default function BootScreen({ onSelect }: Props) {
  const [hoverId, setHoverId] = useState<DeviceType | null>(null);
  const [bootTick, setBootTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setBootTick(n => n + 1), 350);
    return () => clearInterval(t);
  }, []);

  const bootMessages = [
    '> RTC_SYNC ........ OK',
    '> WEATHER_SAT ..... OK',
    '> ADSB_RX ........ OK',
    '> MTA_GTFS-RT .... OK',
    '> AWAITING DEVICE PROFILE_',
  ];

  return (
    <div className="min-h-screen w-screen bg-black text-[#00ff41] font-mono flex flex-col items-center justify-center p-6 select-none relative overflow-y-auto">
      <div className="crt-overlay"></div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-8">
        <div className="text-center space-y-1">
          <div className="text-xs label-dim font-extrabold tracking-widest">BEDSTUY-CONSOLE // BIOS v1.0</div>
          <div className="text-3xl md:text-4xl font-black phosphor-glow glitch-text tracking-tight">
            [ BOOT SEQUENCE ]
          </div>
          <div className="text-xs label-dim font-extrabold tracking-widest">QUINCY ST &times; NOSTRAND AVE</div>
        </div>

        <div className="w-full border-2 border-[#005a18] bg-black p-4 text-sm font-extrabold space-y-1 leading-relaxed">
          {bootMessages.slice(0, Math.min(bootMessages.length, bootTick + 1)).map((m, i) => (
            <div key={i} className={i === bootMessages.length - 1 ? 'text-[#00ff41] phosphor-glow' : 'label-dim'}>
              {m}
              {i === bootMessages.length - 1 && bootTick >= bootMessages.length - 1 && (
                <span className="blink-cursor">█</span>
              )}
            </div>
          ))}
        </div>

        <div className="w-full">
          <div className="text-xs label-dim font-extrabold tracking-widest mb-2 text-center">
            // SELECT DISPLAY PROFILE
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {OPTIONS.map(opt => {
              const active = hoverId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onMouseEnter={() => setHoverId(opt.id)}
                  onMouseLeave={() => setHoverId(prev => (prev === opt.id ? null : prev))}
                  onFocus={() => setHoverId(opt.id)}
                  onBlur={() => setHoverId(prev => (prev === opt.id ? null : prev))}
                  onClick={() => onSelect(opt.id)}
                  className={`group relative border-2 p-5 flex flex-col items-center gap-3 transition-all duration-150 text-left
                    ${active
                      ? 'border-[#00ff41] bg-[#001704] shadow-[0_0_18px_rgba(0,255,65,0.35)]'
                      : 'border-[#005a18] bg-black hover:border-[#00ff41]'}`}
                >
                  <opt.Icon className={`w-10 h-10 ${active ? 'text-[#00ff41]' : 'text-[#00aa2d]'} transition-colors`} />
                  <div className="text-center">
                    <div className={`text-lg font-black tracking-widest ${active ? 'phosphor-glow' : ''}`}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] label-dim font-bold tracking-wider mt-1">
                      {opt.subtitle}
                    </div>
                  </div>
                  <div className={`text-[10px] font-black tracking-widest ${active ? 'text-[#00ff41]' : 'label-dim'}`}>
                    [ PRESS TO BOOT ]
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[10px] label-dim font-extrabold tracking-widest text-center">
          PROFILE IS NOT REMEMBERED &mdash; REBOOT TO CHANGE
        </div>
      </div>
    </div>
  );
}
