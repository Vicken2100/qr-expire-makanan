import React from 'react';
import { Camera, PlusCircle, Package, BarChart3 } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  itemCount: number;
  expiredCount: number;
  warningCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  itemCount,
  expiredCount,
  warningCount,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe shadow-2xl">
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around">
        {/* 1. SCANNER KAMERA HP */}
        <button
          onClick={() => onChangeTab('scanner')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 relative ${
            activeTab === 'scanner'
              ? 'text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-0.5 transition-all shadow-md ${
              activeTab === 'scanner'
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/30 ring-2 ring-cyan-400/50 scale-105'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-[11px] tracking-tight">Kamera Scan</span>
        </button>

        {/* 2. GENERATOR QR */}
        <button
          onClick={() => onChangeTab('generator')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 ${
            activeTab === 'generator'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-0.5 transition-all shadow-md ${
              activeTab === 'generator'
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/50 scale-105'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="text-[11px] tracking-tight">Buat QR</span>
        </button>

        {/* 3. DAFTAR BARANG */}
        <button
          onClick={() => onChangeTab('items')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 relative ${
            activeTab === 'items'
              ? 'text-amber-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-0.5 transition-all shadow-md relative ${
              activeTab === 'items'
                ? 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-amber-500/30 ring-2 ring-amber-400/50 scale-105'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <Package className="w-5 h-5" />
            {expiredCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-slate-900 animate-pulse">
                {expiredCount > 9 ? '9+' : expiredCount}
              </span>
            )}
          </div>
          <span className="text-[11px] tracking-tight">
            Stok ({itemCount})
          </span>
        </button>

        {/* 4. ANALISIS & LAPORAN */}
        <button
          onClick={() => onChangeTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-95 relative ${
            activeTab === 'analytics'
              ? 'text-purple-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-0.5 transition-all shadow-md ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-purple-500/30 ring-2 ring-purple-400/50 scale-105'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[11px] tracking-tight">Laporan</span>
        </button>
      </div>
    </nav>
  );
};
