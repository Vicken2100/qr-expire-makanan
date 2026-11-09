import React from 'react';
import { QrCode, Wifi, Smartphone, Calendar, RefreshCw } from 'lucide-react';
import { formatFullIndonesianDate } from '../utils/expiry';

interface NavbarProps {
  isOnline: boolean;
  itemCount: number;
  todayDateStr: string;
  onRefresh?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  itemCount,
  todayDateStr,
  onRefresh,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white transition-all shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/30">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  QR ExpireTracker
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">
                  Real-time
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>Scanner & Generator Kedaluwarsa</span>
              </p>
            </div>
          </div>

          {/* Right Status Indicators */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Date Indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatFullIndonesianDate(todayDateStr)}</span>
            </div>

            {/* Cloud Real-time Badge */}
            <div
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/70'
              }`}
              title="Koneksi Real-time Firebase Firestore multi-perangkat"
            >
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>
              <Wifi className="w-3 h-3 hidden sm:inline" />
              <span className="text-[11px] font-semibold">
                {isOnline ? 'Cloud Sync' : 'Menghubungkan'}
              </span>
            </div>

            {/* Smartphone Badge */}
            <div
              className="flex items-center gap-1 text-[11px] text-slate-300 bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-700"
              title="Dioptimalkan untuk smartphone"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-white">{itemCount}</span>
              <span className="hidden sm:inline text-slate-400">barang</span>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Muat ulang data"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition-all border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
