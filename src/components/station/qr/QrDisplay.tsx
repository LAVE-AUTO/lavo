'use client';

import { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  url: string;
  stationName: string;
}

const QR_SIZE = 240;
const QR_COLOR_DARK = '#1A1A0A';
const QR_COLOR_LIGHT = '#FFFFFF';

export function QrDisplay({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: QR_SIZE,
      margin: 2,
      color: { dark: QR_COLOR_DARK, light: QR_COLOR_LIGHT },
      errorCorrectionLevel: 'H',
    }).then(() => setReady(true));
  }, [url]);

  return (
    <div className="flex items-center justify-center">
      <div className={`rounded-lg border border-[#E8E4DC] bg-white p-3 dark:border-[#243020] ${ready ? '' : 'animate-pulse'}`}>
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
