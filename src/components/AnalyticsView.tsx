import React from 'react';
import {
  BarChart3,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Smartphone,
  Clock,
  TrendingUp,
  Package,
} from 'lucide-react';
import { Item, ScanLog } from '../types';
import { calculateExpiryStatus, formatIndonesianDate } from '../utils/expiry';

interface AnalyticsViewProps {
  items: Item[];
  recentScans: ScanLog[];
  onSelectTab: (tab: 'scanner' | 'generator' | 'items') => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  items,
  recentScans,
  onSelectTab,
}) => {
  const inStockItems = items.filter((it) => (it.quantity ?? 1) > 0);

  const itemsWithCalc = inStockItems.map((it) => ({
    ...it,
    calc: calculateExpiryStatus(it.mfgDate, it.expDate),
  }));

  const greenItems = itemsWithCalc.filter((i) => i.calc.status === 'green');
  const yellowItems = itemsWithCalc.filter((i) => i.calc.status === 'yellow');
  const redItems = itemsWithCalc.filter((i) => i.calc.status === 'red');

  const total = inStockItems.length || 1;
  const greenPct = Math.round((greenItems.length / total) * 100);
  const yellowPct = Math.round((yellowItems.length / total) * 100);
  const redPct = Math.round((redItems.length / total) * 100);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
            <BarChart3 className="w-4 h-4" />
          </span>
          <h2 className="text-lg md:text-xl font-bold text-white">
            Laporan & Status Kedaluwarsa Real-time
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Ringkasan kesehatan stok produk dan log aktivitas kamera HP di seluruh perangkat.
        </p>

        {/* 3 Metric Cards based on User Criteria */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {/* HIJAU */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300">
                🟢 DI ATAS EXP
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{greenItems.length}</span>
              <span className="text-xs text-emerald-400 font-semibold">{greenPct}% dari stok</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 mt-1">
              Masa simpan prima, di atas pertengahan tanggal EXP.
            </p>
          </div>

          {/* KUNING */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-300">
                🟡 PERTENGAHAN EXP
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{yellowItems.length}</span>
              <span className="text-xs text-amber-400 font-semibold">{yellowPct}% dari stok</span>
            </div>
            <p className="text-[11px] text-amber-300/80 mt-1">
              Sudah di pertengahan masa simpan. Prioritaskan FIFO.
            </p>
          </div>

          {/* MERAH */}
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-red-300">
                🔴 HARI INI / SUDAH EXP
              </span>
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{redItems.length}</span>
              <span className="text-xs text-red-400 font-semibold">{redPct}% dari stok</span>
            </div>
            <p className="text-[11px] text-red-300/80 mt-1">
              Hari ini EXP atau telah lewat. Pisahkan segera.
            </p>
          </div>
        </div>

        {/* Proportional Distribution Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <span className="text-xs text-slate-400 block mb-1.5 font-medium">
            Proporsi Kesehatan Stok Keseluruhan:
          </span>
          <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex p-0.5 gap-0.5">
            <div
              style={{ width: `${greenPct}%` }}
              className="h-full bg-emerald-500 rounded-l-full transition-all"
              title={`Hijau: ${greenPct}%`}
            />
            <div
              style={{ width: `${yellowPct}%` }}
              className="h-full bg-amber-400 transition-all"
              title={`Kuning: ${yellowPct}%`}
            />
            <div
              style={{ width: `${redPct}%` }}
              className="h-full bg-red-500 rounded-r-full transition-all"
              title={`Merah: ${redPct}%`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Attention Box (Red & Yellow Items) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>Perlu Tindakan Cepat (Merah & Kuning)</span>
            </h3>
            <span className="text-xs text-slate-400">
              {redItems.length + yellowItems.length} barang
            </span>
          </div>

          {redItems.length === 0 && yellowItems.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs text-emerald-400 font-semibold">
                Semua stok saat ini aman dan berada di atas tanggal EXP!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {/* Red Items First */}
              {redItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-red-950/50 border border-red-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                      🔴 {item.calc.isTodayExp ? 'HARI INI EXP' : 'SUDAH LEWAT EXP'}
                    </span>
                    <h5 className="font-bold text-white text-xs">{item.name}</h5>
                    <span className="text-[10px] text-slate-400 font-mono">
                      EXP: {item.expDate} ({item.quantity ?? 0} {item.unit || 'pcs'})
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectTab('items')}
                    className="px-2.5 py-1 rounded-xl bg-red-900 hover:bg-red-800 text-white text-[10px] font-bold active:scale-95 transition-all shrink-0"
                  >
                    Tarik Stok
                  </button>
                </div>
              ))}

              {/* Yellow Items */}
              {yellowItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      🟡 PERTENGAHAN EXP (Sisa {item.calc.daysRemaining} Hari)
                    </span>
                    <h5 className="font-bold text-white text-xs">{item.name}</h5>
                    <span className="text-[10px] text-slate-400 font-mono">
                      EXP: {item.expDate} ({item.quantity ?? 0} {item.unit || 'pcs'})
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectTab('items')}
                    className="px-2.5 py-1 rounded-xl bg-amber-900 hover:bg-amber-800 text-white text-[10px] font-bold active:scale-95 transition-all shrink-0"
                  >
                    Promo FIFO
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Scan Activity Feed Across Devices */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Aktivitas Scan Real-time Antar HP</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              Live Feed
            </span>
          </div>

          {recentScans.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/80">
              <Smartphone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                Belum ada aktivitas scan terbaru. Gunakan tab Kamera Scan untuk mulai memindai QR code!
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {recentScans.slice(0, 15).map((scan) => (
                <div
                  key={scan.id}
                  className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        scan.status === 'red'
                          ? 'bg-red-500'
                          : scan.status === 'yellow'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <div>
                      <h5 className="font-bold text-white line-clamp-1">
                        {scan.itemName || 'Barang Terpindai'}
                      </h5>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-slate-500" />
                        <span>{scan.deviceInfo || 'Kamera HP'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        scan.status === 'red'
                          ? 'bg-red-950 text-red-300'
                          : scan.status === 'yellow'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {scan.status === 'red'
                        ? 'Hari EXP'
                        : scan.status === 'yellow'
                        ? 'Pertengahan'
                        : 'Aman'}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">
                      {new Date(scan.scannedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
