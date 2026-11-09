import React, { useState } from 'react';
import QRCode from 'qrcode';
import {
  Package,
  Search,
  Filter,
  Plus,
  QrCode,
  Printer,
  Trash2,
  Calendar,
  Clock,
  Layers,
  ArrowUpDown,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Item, ExpiryStatus } from '../types';
import { calculateExpiryStatus, formatIndonesianDate } from '../utils/expiry';
import { deleteItem, saveItem, seedSampleDataIfEmpty } from '../services/itemService';
import { PrintLabelModal } from './PrintLabelModal';

interface ItemListProps {
  items: Item[];
  onAddNew: () => void;
  onEditItem: (item: Item) => void;
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  onAddNew,
  onEditItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpiryStatus>('all');
  const [sortBy, setSortBy] = useState<'expAsc' | 'createdDesc' | 'nameAsc'>('expAsc');
  const [selectedPrintItem, setSelectedPrintItem] = useState<{
    item: Item;
    qrUrl: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Calculate stats
  const itemsWithCalc = items.map((it) => ({
    ...it,
    calc: calculateExpiryStatus(it.mfgDate, it.expDate),
  }));

  const greenCount = itemsWithCalc.filter((i) => i.calc.status === 'green').length;
  const yellowCount = itemsWithCalc.filter((i) => i.calc.status === 'yellow').length;
  const redCount = itemsWithCalc.filter((i) => i.calc.status === 'red').length;

  // Filter
  const filtered = itemsWithCalc.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (it.category && it.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (it.batchNumber && it.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || it.calc.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'expAsc') {
      return a.expDate.localeCompare(b.expDate);
    }
    if (sortBy === 'createdDesc') {
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    }
    return a.name.localeCompare(b.name);
  });

  const handleOpenPrint = async (item: Item) => {
    const payload = item.qrPayload || JSON.stringify({
      app: 'qrexp',
      id: item.id,
      name: item.name,
      mfg: item.mfgDate,
      exp: item.expDate,
      batch: item.batchNumber,
    });

    try {
      const url = await QRCode.toDataURL(payload, {
        width: 380,
        margin: 2,
      });
      setSelectedPrintItem({ item, qrUrl: url });
    } catch (e) {
      console.error('Failed to generate QR for print:', e);
    }
  };

  const handleUpdateQuantity = async (item: Item, delta: number) => {
    const newQty = Math.max(0, (item.quantity ?? 1) + delta);
    try {
      await saveItem({ ...item, quantity: newQty });
    } catch (err) {
      console.warn('Error updating quantity:', err);
    }
  };

  const handleDelete = async (itemId: string, name: string) => {
    if (confirm(`Yakin ingin menghapus barang "${name}" dari inventaris?`)) {
      setIsDeleting(itemId);
      try {
        await deleteItem(itemId);
      } catch (err) {
        alert('Gagal menghapus barang.');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const handleSeedSamples = async () => {
    await seedSampleDataIfEmpty(0);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header & Stats Pills */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-400" />
              <span>Inventaris & Stok Real-time</span>
            </h2>
            <p className="text-xs text-slate-400">
              Sinkronisasi instan multi-perangkat via Firebase Firestore
            </p>
          </div>

          <button
            onClick={onAddNew}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang Baru</span>
          </button>
        </div>

        {/* Filter Status Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setStatusFilter('all')}
            className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-600 shadow-md ring-1 ring-slate-500'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
            }`}
          >
            <span>Semua Barang</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300">
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('green')}
            className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
              statusFilter === 'green'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-600 shadow-md ring-1 ring-emerald-500'
                : 'bg-emerald-950/30 text-emerald-400/80 border-emerald-900/60 hover:bg-emerald-950/60'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>🟢 Aman</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-900/60 text-emerald-300">
              {greenCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('yellow')}
            className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
              statusFilter === 'yellow'
                ? 'bg-amber-950 text-amber-200 border-amber-600 shadow-md ring-1 ring-amber-500'
                : 'bg-amber-950/30 text-amber-400/80 border-amber-900/60 hover:bg-amber-950/60'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>🟡 Pertengahan</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-900/60 text-amber-300">
              {yellowCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('red')}
            className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
              statusFilter === 'red'
                ? 'bg-red-950 text-red-200 border-red-600 shadow-md ring-1 ring-red-500'
                : 'bg-red-950/30 text-red-400/80 border-red-900/60 hover:bg-red-950/60'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span>🔴 Hari EXP</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-900/60 text-red-300">
              {redCount}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama barang, kategori, atau nomor batch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-2xl text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'expAsc' | 'createdDesc' | 'nameAsc')}
              className="bg-transparent text-white outline-none text-xs cursor-pointer"
            >
              <option value="expAsc" className="bg-slate-900">Paling Cepat EXP</option>
              <option value="createdDesc" className="bg-slate-900">Baru Ditambahkan</option>
              <option value="nameAsc" className="bg-slate-900">Nama (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Item List Cards */}
      {sorted.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-white font-bold text-base">Tidak ada barang yang cocok</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'Coba ubah kata kunci pencarian atau bersihkan filter status.'
              : 'Inventaris Anda masih kosong. Buat QR barang baru atau muat data sampel pengujian.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={onAddNew}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-95 transition-all"
            >
              + Buat QR Barang Sekarang
            </button>
            <button
              onClick={handleSeedSamples}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 active:scale-95 transition-all"
            >
              Muat 3 Contoh Sampel (Hijau, Kuning, Merah)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((item) => (
            <div
              key={item.id}
              className={`bg-slate-900 rounded-3xl p-4 border transition-all duration-200 shadow-md hover:shadow-xl flex flex-col justify-between ${
                item.calc.status === 'red'
                  ? 'border-red-900/60 hover:border-red-600'
                  : item.calc.status === 'yellow'
                  ? 'border-amber-900/60 hover:border-amber-600'
                  : 'border-emerald-900/60 hover:border-emerald-600'
              }`}
            >
              {/* Card Top: Status Badge & Category */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                    {item.category || 'Umum'}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm ${
                      item.calc.status === 'red'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : item.calc.status === 'yellow'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.calc.status === 'red'
                          ? 'bg-red-400 animate-ping'
                          : item.calc.status === 'yellow'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span>{item.calc.badgeText}</span>
                  </span>
                </div>

                {/* Product Name */}
                <h4 className="text-base font-bold text-white leading-snug line-clamp-1">
                  {item.name}
                </h4>

                {item.batchNumber && (
                  <span className="text-[11px] font-mono text-cyan-400 block mt-0.5">
                    Batch: {item.batchNumber}
                  </span>
                )}

                {/* Dates Info Bar */}
                <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-semibold text-slate-500 block">
                      Tgl Pembuatan (MFG)
                    </span>
                    <span className="font-mono font-medium text-slate-300">
                      {item.mfgDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-semibold text-slate-500 block">
                      Tgl Kedaluwarsa (EXP)
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        item.calc.status === 'red'
                          ? 'text-red-400'
                          : item.calc.status === 'yellow'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {item.expDate}
                    </span>
                  </div>
                </div>

                {/* Expiration Countdown Bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>
                      {item.calc.daysRemaining > 0
                        ? `Sisa ${item.calc.daysRemaining} hari`
                        : item.calc.daysRemaining === 0
                        ? 'HARI INI EXP'
                        : `Lewat ${Math.abs(item.calc.daysRemaining)} hari`}
                    </span>
                    <span>Masa Simpan: {item.calc.percentPassed}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.calc.status === 'red'
                          ? 'bg-red-500'
                          : item.calc.status === 'yellow'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, item.calc.percentPassed))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer: Stock & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {/* Stock Stepper */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => handleUpdateQuantity(item, -1)}
                    title="Kurangi stok"
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <MinusCircle className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-white min-w-8 text-center font-mono">
                    {item.quantity ?? 0} {item.unit || 'pcs'}
                  </span>
                  <button
                    onClick={() => handleUpdateQuantity(item, 1)}
                    title="Tambah stok"
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenPrint(item)}
                    title="Lihat QR & Cetak Label"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 active:scale-95 transition-all"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onEditItem(item)}
                    title="Edit Barang"
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 active:scale-95 transition-all"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    disabled={isDeleting === item.id}
                    title="Hapus"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print Label Modal */}
      {selectedPrintItem && (
        <PrintLabelModal
          item={selectedPrintItem.item}
          qrDataUrl={selectedPrintItem.qrUrl}
          onClose={() => setSelectedPrintItem(null)}
        />
      )}
    </div>
  );
};
