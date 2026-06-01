'use client';

import { useRef, useEffect, useState } from 'react';
import { renderQrWithLogo } from './qr-with-logo';

interface Props {
  url: string;
  stationName: string;
  size?: number;
}

const DEFAULT_QR_SIZE = 280;

export function QrDisplay({ url, size = DEFAULT_QR_SIZE }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    renderQrWithLogo(canvasRef.current, url, size)
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [url, size]);

  return (
    <div className="relative inline-block">
      {/* Viewfinder corner brackets — premium scanner cue */}
      <CornerBracket position="top-left" />
      <CornerBracket position="top-right" />
      <CornerBracket position="bottom-left" />
      <CornerBracket position="bottom-right" />

      <div
        className={`relative rounded-2xl border border-separator/25 bg-card-surface p-4 shadow-lg dark:border-[#001A05] ${
          ready ? '' : 'animate-pulse'
        }`}
        style={{ width: size + 32, height: size + 32 }}
      >
        <canvas ref={canvasRef} className="block" style={{ width: size, height: size }} />
      </div>
    </div>
  );
}

interface BracketProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function CornerBracket({ position }: BracketProps) {
  const base = 'pointer-events-none absolute h-7 w-7 border-[#DDAF3B]';
  const cls = {
    'top-left': 'top-[-10px] left-[-10px] border-l-[3px] border-t-[3px] rounded-tl-xl',
    'top-right': 'top-[-10px] right-[-10px] border-r-[3px] border-t-[3px] rounded-tr-xl',
    'bottom-left': 'bottom-[-10px] left-[-10px] border-l-[3px] border-b-[3px] rounded-bl-xl',
    'bottom-right': 'bottom-[-10px] right-[-10px] border-r-[3px] border-b-[3px] rounded-br-xl',
  }[position];
  return <span aria-hidden="true" className={`${base} ${cls}`} />;
}
