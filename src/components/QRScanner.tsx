import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Flashlight,
  Upload,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Package,
  MinusCircle,
  PlusCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  Eye,
} from 'lucide-react';
import { Item } from '../types';
import {
  calculateExpiryStatus,
  parseQRPayload,
  formatIndonesianDate,
  getTodayDateString,
  addDaysToDateString,
} from '../utils/expiry';
import { playStatusAudio, triggerHaptic, playStockDecrementSound } from '../utils/audio';
import {
  recordScan,
  decrementOrUpdateItemStock,
} from '../services/itemService';
import confetti from 'canvas-confetti';

interface QRScannerProps {
  existingItems: Item[];
  onItemUpdated?: (item: Item) => void;
  onNavigateToGenerator?: (itemData: Partial<Item>) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  existingItems,
  onItemUpdated,
  onNavigateToGenerator,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedItem, setScannedItem] = useState<Partial<Item> | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [viewDetails, setViewDetails] = useState(false);

  // Stock mutation state
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [stockFeedback, setStockFeedback] = useState<string | null>(null);
  const [scanSavedFeedback, setScanSavedFeedback] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingScan = useRef<boolean>(false);
  const readerElementId = 'qr-camera-reader';

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(readerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      const qrCodeScanner = html5QrCodeRef.current;

      if (qrCodeScanner.isScanning) {
        await qrCodeScanner.stop();
      }

      await qrCodeScanner.start(
        { facingMode: { ideal: facingMode } },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // ignore scan frame misses
        }
      );

      setIsScanning(true);

      // Check torch
      try {
        const capabilities = qrCodeScanner.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      console.warn('Camera start error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
        setCameraError(
          'Izin kamera tidak diberikan. Mohon izinkan akses kamera di browser HP Anda atau gunakan tombol "Unggah Foto QR".'
        );
      } else {
        setCameraError(
          'Tidak dapat mengaktifkan kamera HP. Anda bisa mengunggah foto QR dari galeri atau mencoba tombol Uji Coba Cepat di bawah.'
        );
      }
      setIsScanning(false);
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
    setIsScanning(false);
  };

  // Toggle Camera Front / Back
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await stopCamera();
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  // Toggle Torch/Flash
  const toggleTorch = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Handle successful QR detection
  const handleScanSuccess = async (text: string) => {
    if (isProcessingScan.current) return;
    isProcessingScan.current = true;

    // 1. Try to parse item data from QR
    const parsed = parseQRPayload(text);

    // 2. Check if item exists in Firestore database
    let matchedItem: Partial<Item> = parsed || {
      id: `scanned_${Date.now()}`,
      name: 'Barang Terpindai',
      mfgDate: getTodayDateString(),
      expDate: getTodayDateString(),
      quantity: 1,
    };

    if (parsed?.id) {
      const foundInDb = existingItems.find((it) => it.id === parsed.id);
      if (foundInDb) {
        matchedItem = { ...foundInDb, ...parsed };
      }
    }

    setScannedItem(matchedItem);
    setCurrentStock(typeof matchedItem.quantity === 'number' ? matchedItem.quantity : 1);

    // 3. Calculate status according to prompt requirements
    const calc = calculateExpiryStatus(
      matchedItem.mfgDate || getTodayDateString(),
      matchedItem.expDate || getTodayDateString()
    );

    // 4. Audio & Haptics Feedback
    if (soundEnabled) {
      playStatusAudio(calc.status);
    }
    triggerHaptic(calc.status);

    // Confetti if green
    if (calc.status === 'green') {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.6 },
      });
    }

    // 5. Automatically record scan event in Firestore
    try {
      await recordScan(matchedItem, calc.status, calc.daysRemaining);
      setScanSavedFeedback(true);
      setTimeout(() => setScanSavedFeedback(false), 2500);
    } catch (e) {
      console.warn('Could not record scan log:', e);
    }

    // Notice: we KEEP the camera frame open so user can see the AR transformation right over the camera!
  };

  // 1-Tap Stock Decrement (-1)
  const handleDecrementStock = async () => {
    if (!scannedItem) return;
    setIsUpdatingStock(true);

    try {
      playStockDecrementSound();
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([60]);
      }

      const { item: updated, newQty } = await decrementOrUpdateItemStock(
        { ...scannedItem, quantity: currentStock },
        -1
      );

      setCurrentStock(newQty);
      setScannedItem(updated);
      if (onItemUpdated) onItemUpdated(updated);

      setStockFeedback(`-1 Barang Keluar! Sisa: ${newQty} ${scannedItem.unit || 'pcs'}`);
      setTimeout(() => setStockFeedback(null), 3000);
    } catch (err) {
      console.error('Error decrementing stock:', err);
      alert('Gagal memperbarui stok di Firebase.');
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Add stock (+1)
  const handleIncrementStock = async () => {
    if (!scannedItem) return;
    setIsUpdatingStock(true);

    try {
      const { item: updated, newQty } = await decrementOrUpdateItemStock(
        { ...scannedItem, quantity: currentStock },
        1
      );

      setCurrentStock(newQty);
      setScannedItem(updated);
      if (onItemUpdated) onItemUpdated(updated);

      setStockFeedback(`+1 Ditambahkan! Sisa: ${newQty} ${scannedItem.unit || 'pcs'}`);
      setTimeout(() => setStockFeedback(null), 3000);
    } catch (err) {
      console.error('Error incrementing stock:', err);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Handle file photo scan from gallery
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(readerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }
      const decoded = await html5QrCodeRef.current.scanFile(file, true);
      handleScanSuccess(decoded);
    } catch {
      alert('Tidak ditemukan kode QR pada gambar tersebut. Coba foto dengan lebih jelas.');
    }
  };

  // Clean up camera on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const resumeScanning = () => {
    isProcessingScan.current = false;
    setScannedItem(null);
    setStockFeedback(null);
    setViewDetails(false);
    if (!isScanning) {
      startCamera();
    }
  };

  // Quick Test Buttons for Instant Verification (Hijau, Kuning, Merah)
  const handleQuickTest = (type: 'green' | 'yellow' | 'red') => {
    const today = getTodayDateString();
    let testItem: Partial<Item>;

    if (type === 'green') {
      testItem = {
        id: 'test_sample_hijau',
        name: 'Susu Segar Premium 1L',
        mfgDate: addDaysToDateString(today, -2),
        expDate: addDaysToDateString(today, 20),
        category: 'Dairy',
        batchNumber: 'LOT-HIJAU-01',
        quantity: 12,
        unit: 'botol',
      };
    } else if (type === 'yellow') {
      testItem = {
        id: 'test_sample_kuning',
        name: 'Roti Gandum Utuh',
        mfgDate: addDaysToDateString(today, -8),
        expDate: addDaysToDateString(today, 4),
        category: 'Bakery',
        batchNumber: 'LOT-KUNING-02',
        quantity: 5,
        unit: 'pack',
      };
    } else {
      testItem = {
        id: 'test_sample_merah',
        name: 'Yogurt Buah Strawberry',
        mfgDate: addDaysToDateString(today, -15),
        expDate: today,
        category: 'Dairy',
        batchNumber: 'LOT-MERAH-03',
        quantity: 2,
        unit: 'cup',
      };
    }

    const payload = JSON.stringify({
      app: 'qrexp',
      ...testItem,
      mfg: testItem.mfgDate,
      exp: testItem.expDate,
    });
    handleScanSuccess(payload);
  };

  const calc = scannedItem
    ? calculateExpiryStatus(
        scannedItem.mfgDate || getTodayDateString(),
        scannedItem.expDate || getTodayDateString()
      )
    : null;

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-20">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Kamera AR Scanner & Stok
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            QR berubah warna otomatis (AR) + tombol kurangi stok 1x klik.
          </p>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
          className={`p-2 rounded-xl border transition-all active:scale-95 ${
            soundEnabled
              ? 'bg-slate-800 text-emerald-400 border-slate-700'
              : 'bg-slate-800/50 text-slate-500 border-slate-800'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Camera Viewport with AR (Augmented Reality) HUD Target System */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden relative">
        <div className="relative w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden bg-black flex items-center justify-center">
          {/* HTML5 QR Code Video Target */}
          <div id={readerElementId} className="w-full h-full object-cover" />

          {/* =========================================================================
              AUGMENTED REALITY (AR) HUD OVERLAY LAYER
              Changes color dynamically: Green, Yellow, or Red upon detection!
             ========================================================================= */}
          {isScanning && !scannedItem && (
            /* Standby AR Scanning Reticle */
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-5">
              {/* AR Top Brackets */}
              <div className="flex justify-between items-start">
                <div className="w-9 h-9 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl shadow-[0_0_10px_#22d3ee]" />
                <span className="text-[10px] font-mono tracking-widest text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                  AR SCANNER: ACTIVE
                </span>
                <div className="w-9 h-9 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl shadow-[0_0_10px_#22d3ee]" />
              </div>

              {/* AR Center Reticle Target */}
              <div className="relative flex items-center justify-center my-auto">
                {/* Rotating Sci-Fi HUD Ring */}
                <div className="w-44 h-44 rounded-full border border-dashed border-cyan-400/50 animate-ar-spin flex items-center justify-center" />
                <div className="absolute w-36 h-36 rounded-full border border-cyan-400/30 animate-ar-spin-reverse" />
                {/* Crosshairs */}
                <div className="absolute w-5 h-0.5 bg-cyan-400/70" />
                <div className="absolute h-5 w-0.5 bg-cyan-400/70" />
                {/* Scanning Radar Line */}
                <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-ar-radar" />
              </div>

              {/* AR Bottom Brackets */}
              <div className="flex justify-between items-end">
                <div className="w-9 h-9 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl shadow-[0_0_10px_#22d3ee]" />
                <span className="text-[9px] font-mono text-cyan-400/80 bg-slate-950/60 px-2 py-0.5 rounded">
                  Arahkan QR ke dalam kotak
                </span>
                <div className="w-9 h-9 border-b-4 border-r-4 border-cyan-400 rounded-br-xl shadow-[0_0_10px_#22d3ee]" />
              </div>
            </div>
          )}

          {/* =========================================================================
              AR LOCKED-ON MODE: COLOR TRANSFORMATION (HIJAU / KUNING / MERAH)
             ========================================================================= */}
          {scannedItem && calc && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20 transition-all duration-300">
              {/* Floating Holographic AR Header Badge */}
              <div className="flex justify-between items-start animate-in slide-in-from-top-4 duration-300">
                {/* Top-Left AR Corner */}
                <div
                  className={`w-10 h-10 border-t-4 border-l-4 rounded-tl-xl transition-all ${
                    calc.status === 'red'
                      ? 'border-red-500 shadow-[0_0_15px_#ef4444]'
                      : calc.status === 'yellow'
                      ? 'border-amber-400 shadow-[0_0_15px_#f59e0b]'
                      : 'border-emerald-400 shadow-[0_0_15px_#10b981]'
                  }`}
                />

                {/* Floating AR Hologram Pill */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-black tracking-wide flex items-center gap-1.5 backdrop-blur-md shadow-2xl border ${
                    calc.status === 'red'
                      ? 'bg-red-600/90 text-white border-red-400 shadow-red-500/50 animate-pulse'
                      : calc.status === 'yellow'
                      ? 'bg-amber-500/90 text-slate-950 border-amber-300 shadow-amber-500/50'
                      : 'bg-emerald-600/90 text-white border-emerald-300 shadow-emerald-500/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      calc.status === 'red'
                        ? 'bg-white animate-ping'
                        : calc.status === 'yellow'
                        ? 'bg-slate-950 animate-pulse'
                        : 'bg-white'
                    }`}
                  />
                  <span>AR: {calc.badgeText}</span>
                </div>

                {/* Top-Right AR Corner */}
                <div
                  className={`w-10 h-10 border-t-4 border-r-4 rounded-tr-xl transition-all ${
                    calc.status === 'red'
                      ? 'border-red-500 shadow-[0_0_15px_#ef4444]'
                      : calc.status === 'yellow'
                      ? 'border-amber-400 shadow-[0_0_15px_#f59e0b]'
                      : 'border-emerald-400 shadow-[0_0_15px_#10b981]'
                  }`}
                />
              </div>

              {/* Center AR Reticle Lock-On with Status Glow */}
              <div className="relative flex items-center justify-center my-auto">
                <div
                  className={`w-48 h-48 rounded-2xl border-2 transition-all flex items-center justify-center backdrop-blur-[2px] ${
                    calc.status === 'red'
                      ? 'border-red-500 bg-red-500/10 shadow-[inset_0_0_20px_#ef4444,0_0_25px_#ef4444]'
                      : calc.status === 'yellow'
                      ? 'border-amber-400 bg-amber-400/10 shadow-[inset_0_0_20px_#f59e0b,0_0_25px_#f59e0b]'
                      : 'border-emerald-400 bg-emerald-400/10 shadow-[inset_0_0_20px_#10b981,0_0_25px_#10b981]'
                  }`}
                >
                  {/* Rotating Inner AR Ring */}
                  <div
                    className={`w-40 h-40 rounded-full border border-dashed animate-ar-spin-fast ${
                      calc.status === 'red'
                        ? 'border-red-400/70'
                        : calc.status === 'yellow'
                        ? 'border-amber-400/70'
                        : 'border-emerald-400/70'
                    }`}
                  />

                  {/* Center Lock Reticle Icon */}
                  <div className="absolute text-center">
                    <span
                      className={`text-xs font-mono font-black uppercase px-2 py-0.5 rounded-md shadow-md ${
                        calc.status === 'red'
                          ? 'bg-red-600 text-white'
                          : calc.status === 'yellow'
                          ? 'bg-amber-400 text-slate-950 font-extrabold'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {calc.status === 'red'
                        ? '🔴 EXP HARI INI'
                        : calc.status === 'yellow'
                        ? '🟡 PERTENGAHAN'
                        : '🟢 AMAN (SEGAR)'}
                    </span>
                    <span className="block text-[10px] font-mono font-bold text-white drop-shadow mt-1">
                      {calc.daysRemaining > 0
                        ? `Sisa ${calc.daysRemaining} Hari`
                        : calc.daysRemaining === 0
                        ? 'Hari Ini Terakhir!'
                        : `Lewat ${Math.abs(calc.daysRemaining)} Hari`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom AR Corners with Target Info */}
              <div className="flex justify-between items-end animate-in slide-in-from-bottom-4 duration-300">
                <div
                  className={`w-10 h-10 border-b-4 border-l-4 rounded-bl-xl transition-all ${
                    calc.status === 'red'
                      ? 'border-red-500 shadow-[0_0_15px_#ef4444]'
                      : calc.status === 'yellow'
                      ? 'border-amber-400 shadow-[0_0_15px_#f59e0b]'
                      : 'border-emerald-400 shadow-[0_0_15px_#10b981]'
                  }`}
                />

                {/* Floating AR Holographic Product Tag */}
                <div className="bg-slate-950/90 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-xl text-center max-w-[210px] pointer-events-auto">
                  <span className="text-[10px] font-bold text-white line-clamp-1 block">
                    {scannedItem.name || 'Produk Terdeteksi'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-300">
                    EXP: {scannedItem.expDate}
                  </span>
                </div>

                <div
                  className={`w-10 h-10 border-b-4 border-r-4 rounded-br-xl transition-all ${
                    calc.status === 'red'
                      ? 'border-red-500 shadow-[0_0_15px_#ef4444]'
                      : calc.status === 'yellow'
                      ? 'border-amber-400 shadow-[0_0_15px_#f59e0b]'
                      : 'border-emerald-400 shadow-[0_0_15px_#10b981]'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Camera Error / Permission Missing State */}
          {!isScanning && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-30">
              <CameraOff className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="font-bold text-white text-sm mb-1">
                Kamera Belum Aktif
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mb-4">
                {cameraError || 'Klik tombol di bawah untuk menyalakan kamera HP Anda.'}
              </p>
              <button
                onClick={startCamera}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 active:scale-95 transition-all"
              >
                Aktifkan Kamera Sekarang
              </button>
            </div>
          )}
        </div>

        {/* =========================================================================
            FEATURE 2: TOMBOL KURANGI STOK (-1) & KONTROL STOK REAL-TIME
           ========================================================================= */}
        {scannedItem && (
          <div className="mt-3.5 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
            {/* Feedback Pop-up Alert when Stock is updated */}
            {stockFeedback && (
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-cyan-400" />
                  <span>{stockFeedback}</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">Real-time</span>
              </div>
            )}

            {/* Sisa Stock Information Banner */}
            <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Sisa Stok Real-time (Firebase):
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span
                    className={`text-2xl font-black font-mono transition-transform ${
                      currentStock <= 0
                        ? 'text-red-400'
                        : currentStock <= 5
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentStock}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {scannedItem.unit || 'pcs'}
                  </span>
                  {currentStock <= 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800 animate-pulse">
                      Stok Habis!
                    </span>
                  )}
                </div>
              </div>

              {/* Status Pill in Stock Panel */}
              {calc && (
                <div className="text-right">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-block ${
                      calc.status === 'red'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : calc.status === 'yellow'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {calc.badgeText}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                    EXP: {scannedItem.expDate}
                  </span>
                </div>
              )}
            </div>

            {/* THE PRIMARY 1-TAP ACTION BUTTON REQUESTED BY USER:
                "tombol yang jika di tekan 1x maka stock akan berkurang 1" */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrementStock}
                disabled={isUpdatingStock || currentStock <= 0}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <MinusCircle className="w-5 h-5 text-white" />
                <span>-1 Kurangi Stok (Keluar Barang)</span>
              </button>

              {/* Quick +1 Add / Undo Button */}
              <button
                type="button"
                onClick={handleIncrementStock}
                disabled={isUpdatingStock}
                title="Tambah Stok (+1)"
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition-all"
              >
                <PlusCircle className="w-5 h-5 text-emerald-400" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={resumeScanning}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold border border-slate-700 active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Pindai Barang Berikutnya</span>
              </button>

              <button
                type="button"
                onClick={() => setViewDetails(!viewDetails)}
                className="flex items-center gap-1 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium border border-slate-700"
              >
                <span>{viewDetails ? 'Sembunyikan' : 'Rincian'}</span>
                {viewDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Detailed View */}
            {viewDetails && calc && (
              <div className="pt-3 border-t border-slate-800 space-y-3 text-xs animate-in fade-in">
                <div className="grid grid-cols-2 gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Tgl Pembuatan (MFG)
                    </span>
                    <span className="font-mono font-medium text-slate-200">
                      {scannedItem.mfgDate}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {formatIndonesianDate(scannedItem.mfgDate)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Tgl Kedaluwarsa (EXP)
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        calc.status === 'red'
                          ? 'text-red-400'
                          : calc.status === 'yellow'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {scannedItem.expDate}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      {formatIndonesianDate(scannedItem.expDate)}
                    </span>
                  </div>
                </div>

                {scannedItem.batchNumber && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    Nomor Batch: <span className="text-cyan-400">{scannedItem.batchNumber}</span>
                  </p>
                )}

                {scannedItem.notes && (
                  <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    Catatan: {scannedItem.notes}
                  </p>
                )}

                {onNavigateToGenerator && (
                  <button
                    onClick={() => onNavigateToGenerator(scannedItem)}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ubah / Lengkapi Data Barang</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Camera Controls Bar (Flip camera, Torch, Upload Gallery) */}
        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCameraFacing}
              title="Ganti Kamera Depan / Belakang"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <SwitchCamera className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Ganti Kamera</span>
            </button>

            {hasTorch && (
              <button
                onClick={toggleTorch}
                title="Flashlight / Senter"
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Flashlight className="w-4 h-4" />
                <span className="hidden sm:inline">Senter</span>
              </button>
            )}
          </div>

          {/* Gallery Upload Input */}
          <label className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Unggah Foto QR</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Quick Demo Test Buttons */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulasi Uji Coba AR & Tombol -1 Stok:</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickTest('green')}
              className="py-2 px-1 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-[10px]">🟢 AR HIJAU</span>
              <span className="text-[9px] font-normal text-emerald-400/80">Di Atas EXP</span>
            </button>

            <button
              onClick={() => handleQuickTest('yellow')}
              className="py-2 px-1 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-700/60 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-[10px]">🟡 AR KUNING</span>
              <span className="text-[9px] font-normal text-amber-400/80">Pertengahan</span>
            </button>

            <button
              onClick={() => handleQuickTest('red')}
              className="py-2 px-1 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-700/60 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-[10px]">🔴 AR MERAH</span>
              <span className="text-[9px] font-normal text-red-400/80">Hari EXP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
