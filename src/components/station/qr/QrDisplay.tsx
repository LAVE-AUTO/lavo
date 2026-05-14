'use client';

import { useRef, useEffect, useState } from 'react';
import { renderQrWithLogo } from './qr-with-logo';

interface Props {
  url: string;
  stationName: string;
}

const QR_SIZE = 240;

export function QrDisplay({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    renderQrWithLogo(canvasRef.current, url, QR_SIZE)
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="flex items-center justify-center">
      <div className={`rounded-lg border border-[#E8E4DC] bg-white p-3 dark:border-[#243020] ${ready ? '' : 'animate-pulse'}`}>
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
