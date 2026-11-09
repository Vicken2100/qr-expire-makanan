import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Sparkles,
  Calendar,
  Layers,
  Save,
  Printer,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  PackageCheck,
  Tag,
  Hash,
} from 'lucide-react';
import { Item } from '../types';
import {
  calculateExpiryStatus,
  getTodayDateString,
  addDaysToDateString,
  formatIndonesianDate,
  encodeQRPayload,
} from '../utils/expiry';
import { saveItem } from '../services/itemService';
import { PrintLabelModal } from './PrintLabelModal';
import confetti from 'canvas-confetti';

interface QRGeneratorProps {
  onItemCreated?: (item: Item) => void;
  initialItem?: Partial<Item> | null;
}

const QUICK_PRODUCTS = [
  { name: 'Susu UHT Fresh 1L', cat: 'Minuman', days: 30 },
  { name: 'Roti Gandum Utuh', cat: 'Bakery', days: 7 },
  { name: 'Daging Ayam Fillet', cat: 'Daging & Unggas', days: 3 },
  { name: 'Yogurt Greek Probiotik', cat: 'Dairy', days: 14 },
  { name: 'Serum Wajah Vitamin C', cat: 'Kosmetik', days: 365 },
  { name: 'Obat Sirup Paracetamol', cat: 'Farmasi', days: 730 },
];

export const QRGenerator: React.FC<QRGeneratorProps> = ({
  onItemCreated,
  initialItem,
}) => {
  const today = getTodayDateString();

  const [name, setName] = useState(initialItem?.name || '');
  const [mfgDate, setMfgDate] = useState(initialItem?.mfgDate || today);
  const [expDate, setExpDate] = useState(
    initialItem?.expDate || addDaysToDateString(today, 30)
  );
  const [batchNumber, setBatchNumber] = useState(initialItem?.batchNumber || '');
  const [category, setCategory] = useState(initialItem?.category || 'Makanan & Minuman');
  const [quantity, setQuantity] = useState<number>(initialItem?.quantity ?? 10);
  const [unit, setUnit] = useState(initialItem?.unit || 'pcs');
  const [notes, setNotes] = useState(initialItem?.notes || '');

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [savedItem, setSavedItem] = useState<Item | null>(null);

  // Dynamic live calculation of expiration status
  const calc = calculateExpiryStatus(mfgDate, expDate);

  // Generate QR code whenever key data changes
  useEffect(() => {
    const payload = encodeQRPayload({
      id: initialItem?.id || `item_${Date.now()}`,
      name: name || 'Barang Baru',
      mfgDate,
      expDate,
      batchNumber,
      category,
      quantity,
      unit,
    });

    QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR:', err));
  }, [name, mfgDate, expDate, batchNumber, category, quantity, unit, initialItem]);

  const handleSelectQuickProduct = (prod: typeof QUICK_PRODUCTS[0]) => {
    setName(prod.name);
    setCategory(prod.cat);
    const mfg = today;
    const exp = addDaysToDateString(mfg, prod.days);
    setMfgDate(mfg);
    setExpDate(exp);
    setBatchNumber(`LOT-${prod.cat.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleApplyPresetDays = (days: number) => {
    setExpDate(addDaysToDateString(mfgDate || today, days));
  };

  const handleSaveToFirebase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      alert('Silakan masukkan nama barang terlebih dahulu.');
      return;
    }
    if (!mfgDate || !expDate) {
      alert('Tanggal pembuatan dan tanggal kedaluwarsa wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const itemToSave: Partial<Item> = {
        id: initialItem?.id,
        name: name.trim(),
        mfgDate,
        expDate,
        batchNumber: batchNumber.trim(),
        category: category.trim(),
        quantity: Number(quantity) || 0,
        unit: unit.trim(),
        notes: notes.trim(),
        scannedCount: initialItem?.scannedCount || 0,
        createdBy: 'mobile_user',
      };

      const result = await saveItem(itemToSave);
      setSavedItem(result);
      setSaveSuccess(true);
      if (onItemCreated) onItemCreated(result);

      // Trigger celebratory micro-confetti
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Gagal menyimpan barang:', err);
      alert('Gagal menyimpan ke Firebase. Cek koneksi internet Anda.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Page Title & Intro */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg md:text-xl font-bold text-white">
                Generator QR Tanggal Kedaluwarsa
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Buat kode QR berisi tanggal produksi & exp. Status warna otomatis tersinkron ke semua perangkat.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Aturan Warna:</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
              🟢 Di Atas EXP
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
              🟡 Pertengahan
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800">
              🔴 Hari EXP
            </span>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-2 font-medium">
            💡 Contoh Cepat Produk:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PRODUCTS.map((prod) => (
              <button
                key={prod.name}
                type="button"
                onClick={() => handleSelectQuickProduct(prod)}
                className="text-xs px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 active:scale-95 transition-all flex items-center gap-1"
              >
                <span>{prod.name}</span>
                <span className="text-[10px] text-emerald-400">+{prod.days}h</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Inputs (Left Column / Top on Mobile) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
          <form onSubmit={handleSaveToFirebase} className="space-y-4">
            {/* Nama Produk */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nama Barang / Produk *</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Susu Segar Pasteurisasi 1 Liter"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
              />
            </div>

            {/* DUA TANGGAL WAJIB (MFG & EXP) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
              {/* Tanggal Pembuatan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tgl Pembuatan (MFG) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMfgDate(today)}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    Hari Ini
                  </button>
                </div>
                <input
                  type="date"
                  required
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 transition-all"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  {formatIndonesianDate(mfgDate)}
                </span>
              </div>

              {/* Tanggal Kedaluwarsa */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tgl Kedaluwarsa (EXP) *</span>
                  </label>
                </div>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-white text-sm outline-none transition-all ${
                    calc.status === 'red'
                      ? 'border-red-500 focus:border-red-400'
                      : calc.status === 'yellow'
                      ? 'border-amber-500 focus:border-amber-400'
                      : 'border-emerald-500 focus:border-emerald-400'
                  }`}
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  {formatIndonesianDate(expDate)}
                </span>
              </div>
            </div>

            {/* Quick Expiry Presets */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5">
                ⚡ Tambah Cepat Masa EXP dari Tgl Pembuatan:
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[
                  { label: 'Hari Ini', days: 0 },
                  { label: '+3 Hari', days: 3 },
                  { label: '+7 Hari', days: 7 },
                  { label: '+14 Hari', days: 14 },
                  { label: '+1 Bulan', days: 30 },
                  { label: '+3 Bulan', days: 90 },
                  { label: '+1 Tahun', days: 365 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleApplyPresetDays(preset.days)}
                    className="text-[10px] py-1.5 px-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-center font-medium active:scale-95 transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Batch & Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  <span>No. Batch / Lot</span>
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Contoh: LOT-2026-001"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Kategori Produk</span>
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Makanan, Minuman, Obat"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-purple-500 text-white placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>
            </div>

            {/* Jumlah Stok & Satuan */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Jumlah Stok
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Satuan
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pcs / botol / box / kg"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white text-sm outline-none transition-all"
                />
              </div>
            </div>

            {/* Catatan Tambahan */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Catatan Penyimpanan / Lokasi Rak
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Simpan di rak pendingin 4°C, hindari sinar matahari langsung"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-500 text-sm outline-none transition-all resize-none"
              />
            </div>

            {/* Save Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Tersimpan Real-time!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan ke Firebase & Buat QR</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSavedItem({
                    id: initialItem?.id || `item_${Date.now()}`,
                    name: name || 'Barang Baru',
                    mfgDate,
                    expDate,
                    batchNumber,
                    category,
                    quantity,
                    unit,
                    notes,
                  });
                  setShowPrintModal(true);
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 active:scale-98 transition-all"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Cetak Label</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview & Expiration Status Card (Right Column) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            {/* Expiration Status Card Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                Pratinjau Status Real-time
              </span>
              <div
                className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-sm ${
                  calc.status === 'red'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : calc.status === 'yellow'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    calc.status === 'red'
                      ? 'bg-red-400 animate-ping'
                      : calc.status === 'yellow'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
                <span>{calc.badgeText}</span>
              </div>
            </div>

            {/* Color-Coded Status Explanation Box */}
            <div
              className={`p-4 rounded-2xl border mb-5 transition-colors ${
                calc.status === 'red'
                  ? 'bg-red-950/40 border-red-800/80 text-red-200'
                  : calc.status === 'yellow'
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {calc.status === 'red' ? (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      calc.status === 'yellow' ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  />
                )}
                <div>
                  <h4 className="font-bold text-sm leading-tight">{calc.label}</h4>
                  <p className="text-xs opacity-90 mt-1 leading-relaxed">
                    {calc.statusMessage}
                  </p>
                  <p className="text-[11px] opacity-75 mt-1">{calc.subMessage}</p>
                </div>
              </div>

              {/* Shelf Life Progress Bar */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex justify-between text-[10px] font-medium opacity-80 mb-1">
                  <span>Masa Simpan Terpakai: {calc.percentPassed}%</span>
                  <span>
                    {calc.daysRemaining > 0
                      ? `${calc.daysRemaining} hari tersisa`
                      : '0 hari (Habis)'}
                  </span>
                </div>
                <div className="w-full bg-slate-950/60 rounded-full h-2 overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      calc.status === 'red'
                        ? 'bg-red-500'
                        : calc.status === 'yellow'
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, calc.percentPassed))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                  <span>MFG: {mfgDate}</span>
                  <span>Mid: {calc.midpointDays}h</span>
                  <span>EXP: {expDate}</span>
                </div>
              </div>
            </div>

            {/* Generated QR Code Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              {qrDataUrl ? (
                <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-slate-700/60">
                  <img
                    src={qrDataUrl}
                    alt="Kode QR Barang"
                    className="w-48 h-48 md:w-56 md:h-56 object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-600">
                  Memuat QR...
                </div>
              )}

              <div className="mt-3">
                <h5 className="font-bold text-white text-sm">
                  {name || 'Nama Produk'}
                </h5>
                <p className="text-xs text-slate-400 mt-0.5">
                  MFG: <span className="text-slate-300 font-mono">{mfgDate}</span> • EXP:{' '}
                  <span
                    className={`font-mono font-bold ${
                      calc.status === 'red'
                        ? 'text-red-400'
                        : calc.status === 'yellow'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {expDate}
                  </span>
                </p>
                {batchNumber && (
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                    Batch: {batchNumber}
                  </span>
                )}
              </div>

              {/* Action Buttons for QR */}
              <div className="flex items-center gap-2 mt-4 w-full">
                <a
                  href={qrDataUrl}
                  download={`QR_${(name || 'produk').replace(/[^a-zA-Z0-9]/g, '_')}_${expDate}.png`}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Unduh PNG</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setSavedItem({
                      id: initialItem?.id || `item_${Date.now()}`,
                      name: name || 'Barang Baru',
                      mfgDate,
                      expDate,
                      batchNumber,
                      category,
                      quantity,
                      unit,
                      notes,
                    });
                    setShowPrintModal(true);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cetak Stiker</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Label Modal */}
      {showPrintModal && savedItem && (
        <PrintLabelModal
          item={savedItem}
          qrDataUrl={qrDataUrl}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
