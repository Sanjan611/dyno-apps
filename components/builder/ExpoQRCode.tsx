"use client";

import { QRCodeSVG } from "qrcode.react";

interface ExpoQRCodeProps {
  expoUrl: string | null;
  size?: number;
}

export default function ExpoQRCode({ expoUrl, size = 256 }: ExpoQRCodeProps) {
  if (!expoUrl) {
    return (
      <div className="aspect-square w-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-slate-200/50 flex items-center justify-center">
          <span className="text-2xl">⏳</span>
        </div>
        <p className="text-sm font-medium text-slate-400">Loading QR code...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl shadow-lg border-2 border-slate-200">
        <QRCodeSVG
          value={expoUrl}
          size={size}
          level="M"
          includeMargin={true}
        />
      </div>
    </div>
  );
}

