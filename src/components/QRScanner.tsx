import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
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
  Sparkles,
  Volume2,
  VolumeX,
  Package,
  MinusCircle,
  PlusCircle,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Scan,
} from 'lucide-react';
import { Item, ExpiryStatus } from '../types';
import {
  calculateExpiryStatus,
  parseQRPayload,
  formatIndonesianDate,
  getTodayDateString,
  addDaysToDateString,
} from '../utils/expiry';
import {
  playStatusAudio,
  triggerHaptic,
  playStockDecrementSound,
} from '../utils/audio';
import {
  recordScan,
  decrementOrUpdateItemStock,
} from '../services/itemService';
import confetti from 'canvas-confetti';

interface QRScannerProps {
  existingItems: Item[];
  onItemUpdated?: (item: Item) => void;
  onItemDeleted?: (itemId: string) => void;
  onNavigateToGenerator?: (itemData: Partial<Item>) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  existingItems,
  onItemUpdated,
  onItemDeleted,
  onNavigateToGenerator,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [viewDetails, setViewDetails] = useState(false);

  // Active Scanned Item (Updates continuously on live scan)
  const [scannedItem, setScannedItem] = useState<Partial<Item> | null>(null);
  const [activeStatus, setActiveStatus] = useState<ExpiryStatus | null>(null);

  // Stock mutation state
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [stockFeedback, setStockFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // State trackers for continuous scanning
  const lastScannedRawRef = useRef<string>('');
  const lastDetectedLocationRef = useRef<any>(null);
  const lastDetectedStatusRef = useRef<ExpiryStatus | null>(null);
  const lastDetectedItemRef = useRef<Partial<Item> | null>(null);
  const lastDetectedTimestampRef = useRef<number>(0);

  // Stop camera media stream
  const stopStream = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);
    setTorchOn(false);
  }, []);

  /**
   * Continuous frame scanner loop:
   * Analyzes camera feed continuously, detects QR codes in real-time,
   * and draws the dynamic AR color highlight (Green/Yellow/Red) directly over the QR code!
   */
  const scanLoop = useCallback(() => {
    if (!videoRef.current || !processingCanvasRef.current || !overlayCanvasRef.current) {
      animationFrameId.current = requestAnimationFrame(scanLoop);
      return;
    }

    const video = videoRef.current;
    const procCanvas = processingCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
      const overlayCtx = overlayCanvas.getContext('2d');

      if (procCtx && overlayCtx) {
        // Match canvas dimensions to video
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        if (procCanvas.width !== width || procCanvas.height !== height) {
          procCanvas.width = width;
          procCanvas.height = height;
        }

        if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
          overlayCanvas.width = width;
          overlayCanvas.height = height;
        }

        // Draw current video frame to processing canvas
        procCtx.drawImage(video, 0, 0, width, height);

        // Detect QR using jsQR
        let detectedCode = null;
        try {
          const imageData = procCtx.getImageData(0, 0, width, height);
          detectedCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
        } catch {
          // ignore scan frame exception
        }

        const now = Date.now();

        // If a QR is detected in the current frame
        if (detectedCode && detectedCode.data && detectedCode.data.trim()) {
          const rawText = detectedCode.data.trim();
          lastDetectedLocationRef.current = detectedCode.location;
          lastDetectedTimestampRef.current = now;

          // If it's a new or changed QR code, update state and trigger audio/haptics!
          if (rawText !== lastScannedRawRef.current) {
            lastScannedRawRef.current = rawText;

            const parsed = parseQRPayload(rawText);
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

            const calc = calculateExpiryStatus(
              matchedItem.mfgDate || getTodayDateString(),
              matchedItem.expDate || getTodayDateString()
            );

            lastDetectedStatusRef.current = calc.status;
            lastDetectedItemRef.current = matchedItem;

            setScannedItem(matchedItem);
            setActiveStatus(calc.status);
            const stock = typeof matchedItem.quantity === 'number' ? matchedItem.quantity : 1;
            setCurrentStock(stock);

            // Audio & Haptic feedback on detection of new QR
            if (soundEnabled) {
              playStatusAudio(calc.status);
            }
            triggerHaptic(calc.status);

            if (calc.status === 'green') {
              confetti({
                particleCount: 20,
                spread: 45,
                origin: { y: 0.7 },
              });
            }

            // Record scan log in Firebase
            try {
              recordScan(matchedItem, calc.status, calc.daysRemaining);
            } catch (e) {
              console.warn('Could not record scan log:', e);
            }
          }
        }

        // =========================================================================
        // DRAW LIVE AR COLOR HIGHLIGHT DIRECTLY OVER THE QR CODE IN REAL TIME!
        // =========================================================================
        overlayCtx.clearRect(0, 0, width, height);

        // Render AR overlay if detected recently (within last 350ms to prevent visual flickering)
        const isRecentlyDetected = now - lastDetectedTimestampRef.current < 350;
        const location = lastDetectedLocationRef.current;
        const status = lastDetectedStatusRef.current;
        const item = lastDetectedItemRef.current;

        if (isRecentlyDetected && location && status && item) {
          const { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } = location;

          const colorHex =
            status === 'red' ? '#ef4444' : status === 'yellow' ? '#f59e0b' : '#10b981';

          const bgFill =
            status === 'red'
              ? 'rgba(239, 68, 68, 0.35)'
              : status === 'yellow'
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(16, 185, 129, 0.35)';

          overlayCtx.save();

          // 1. Fill QR polygon with vibrant color tint
          overlayCtx.fillStyle = bgFill;
          overlayCtx.beginPath();
          overlayCtx.moveTo(topLeftCorner.x, topLeftCorner.y);
          overlayCtx.lineTo(topRightCorner.x, topRightCorner.y);
          overlayCtx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
          overlayCtx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
          overlayCtx.closePath();
          overlayCtx.fill();

          // 2. Neon glowing border on the 4 edges of the QR code
          overlayCtx.lineWidth = 6;
          overlayCtx.strokeStyle = colorHex;
          overlayCtx.shadowColor = colorHex;
          overlayCtx.shadowBlur = 16;
          overlayCtx.beginPath();
          overlayCtx.moveTo(topLeftCorner.x, topLeftCorner.y);
          overlayCtx.lineTo(topRightCorner.x, topRightCorner.y);
          overlayCtx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
          overlayCtx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
          overlayCtx.closePath();
          overlayCtx.stroke();

          // 3. Draw targeting corner pins
          [topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner].forEach((pt) => {
            overlayCtx.fillStyle = '#ffffff';
            overlayCtx.beginPath();
            overlayCtx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
            overlayCtx.fill();
            overlayCtx.strokeStyle = colorHex;
            overlayCtx.lineWidth = 3;
            overlayCtx.stroke();
          });

          // 4. Floating Hologram Badge Tag anchored right above the QR code
          const badgeX = Math.min(topLeftCorner.x, topRightCorner.x);
          const badgeY = Math.min(topLeftCorner.y, topRightCorner.y) - 18;

          const calcInfo = calculateExpiryStatus(
            item.mfgDate || getTodayDateString(),
            item.expDate || getTodayDateString()
          );

          const badgeTitle =
            status === 'red'
              ? `🔴 KEDALUWARSA (${calcInfo.daysRemaining === 0 ? 'HARI INI EXP' : `${Math.abs(calcInfo.daysRemaining)}h lalu`})`
              : status === 'yellow'
              ? `🟡 PERTENGAHAN EXP (Sisa ${calcInfo.daysRemaining} Hari)`
              : `🟢 AMAN & SEGAR (Sisa ${calcInfo.daysRemaining} Hari)`;

          const fontSize = Math.max(14, Math.round(width / 42));
          overlayCtx.font = `bold ${fontSize}px sans-serif`;
          const textMetrics = overlayCtx.measureText(badgeTitle);
          const badgeW = textMetrics.width + 24;
          const badgeH = fontSize + 14;

          overlayCtx.fillStyle = colorHex;
          overlayCtx.beginPath();
          overlayCtx.roundRect(
            Math.max(10, badgeX - 10),
            Math.max(10, badgeY - badgeH),
            badgeW,
            badgeH,
            8
          );
          overlayCtx.fill();

          overlayCtx.fillStyle = status === 'yellow' ? '#0f172a' : '#ffffff';
          overlayCtx.shadowBlur = 0;
          overlayCtx.fillText(
            badgeTitle,
            Math.max(10, badgeX - 10) + 12,
            Math.max(10, badgeY - badgeH) + fontSize + 2
          );

          overlayCtx.restore();
        }
      }
    }

    // Keep scanning continuously!
    animationFrameId.current = requestAnimationFrame(scanLoop);
  }, [existingItems, soundEnabled]);

  // Robust Camera Starter
  const startCamera = useCallback(async () => {
    setIsLoadingCamera(true);
    setCameraError(null);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Peramban ini tidak mendukung akses kamera secara langsung (MediaDevices API tidak tersedia). Gunakan browser Chrome/Safari modern atau upload foto QR dari galeri.'
      );
      setIsLoadingCamera(false);
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode === 'environment' ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err1) {
      console.warn('Strategy 1 camera request failed, trying simple video constraint...', err1);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err2: unknown) {
        console.error('All camera requests failed:', err2);
        const errMsg = err2 instanceof Error ? err2.message : String(err2);

        if (
          errMsg.includes('Permission') ||
          errMsg.includes('NotAllowedError') ||
          errMsg.includes('denied')
        ) {
          setCameraError(
            'Izin akses kamera diblokir browser. Ketuk ikon gembok / izin situs di bilah alamat browser HP Anda, aktifkan izin Kamera, lalu tekan "Coba Lagi".'
          );
        } else {
          setCameraError(
            `Kamera belum dapat dibuka (${errMsg}). Silakan coba tekan "Coba Lagi" atau gunakan opsi "Unggah Foto QR" dari galeri.`
          );
        }
        setIsLoadingCamera(false);
        return;
      }
    }

    if (stream) {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play interrupted:', playErr);
        }
      }

      setIsStreaming(true);
      setIsLoadingCamera(false);

      try {
        const track = stream.getVideoTracks()[0];
        // @ts-ignore
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }

      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(scanLoop);
      }
    }
  }, [facingMode, stopStream, scanLoop]);

  // Flip camera front / back
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [facingMode]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          // @ts-ignore
          await track.applyConstraints({
            advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
          });
          setTorchOn(!torchOn);
        } catch (e) {
          console.warn('Torch toggle failed:', e);
        }
      }
    }
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

      const currentItemName = scannedItem.name || 'Barang';
      const currentItemId = scannedItem.id;

      const { item: updated, newQty, deleted } = await decrementOrUpdateItemStock(
        { ...scannedItem, quantity: currentStock },
        -1
      );

      if (deleted) {
        // Stock reached 0: automatically removed from Firestore and UI!
        setCurrentStock(0);
        setScannedItem(null);
        lastDetectedItemRef.current = null;
        lastDetectedStatusRef.current = null;
        lastDetectedLocationRef.current = null;
        lastScannedRawRef.current = '';

        if (currentItemId && onItemDeleted) {
          onItemDeleted(currentItemId);
        }

        setStockFeedback(`Stok "${currentItemName}" telah habis dan langsung otomatis dihapus dari daftar stok!`);
        setTimeout(() => setStockFeedback(null), 4000);
      } else if (updated) {
        setCurrentStock(newQty);
        setScannedItem(updated);
        lastDetectedItemRef.current = updated;
        if (onItemUpdated) onItemUpdated(updated);

        setStockFeedback(`-1 Barang Keluar! Sisa: ${newQty} ${scannedItem.unit || 'pcs'}`);
        setTimeout(() => setStockFeedback(null), 3000);
      }
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

      if (updated) {
        setCurrentStock(newQty);
        setScannedItem(updated);
        lastDetectedItemRef.current = updated;
        if (onItemUpdated) onItemUpdated(updated);
      }

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
      const img = new Image();
      img.onload = () => {
        const uploadCanvas = document.createElement('canvas');
        uploadCanvas.width = img.width;
        uploadCanvas.height = img.height;
        const ctx = uploadCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, uploadCanvas.width, uploadCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          const parsed = parseQRPayload(code.data);
          let matchedItem: Partial<Item> = parsed || {
            id: `scanned_${Date.now()}`,
            name: 'Barang Terpindai',
            mfgDate: getTodayDateString(),
            expDate: getTodayDateString(),
            quantity: 1,
          };
          setScannedItem(matchedItem);
          const stock = typeof matchedItem.quantity === 'number' ? matchedItem.quantity : 1;
          setCurrentStock(stock);

          const calc = calculateExpiryStatus(
            matchedItem.mfgDate || getTodayDateString(),
            matchedItem.expDate || getTodayDateString()
          );

          setActiveStatus(calc.status);
          lastDetectedStatusRef.current = calc.status;
          lastDetectedItemRef.current = matchedItem;
          lastScannedRawRef.current = code.data;

          if (soundEnabled) playStatusAudio(calc.status);
          triggerHaptic(calc.status);
        } else {
          alert('Tidak ditemukan kode QR pada gambar tersebut. Pastikan foto QR jelas dan tidak blur.');
        }
      };
      img.src = URL.createObjectURL(file);
    } catch {
      alert('Gagal memproses gambar foto.');
    }
  };

  // Quick Test Buttons for Instant Live Demonstration (Hijau, Kuning, Merah)
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

    const calc = calculateExpiryStatus(testItem.mfgDate!, testItem.expDate!);

    setScannedItem(testItem);
    setCurrentStock(testItem.quantity || 1);
    setActiveStatus(calc.status);

    lastDetectedStatusRef.current = calc.status;
    lastDetectedItemRef.current = testItem;
    lastScannedRawRef.current = JSON.stringify(testItem);
    lastDetectedTimestampRef.current = Date.now();

    // Mock center position on overlay canvas
    if (overlayCanvasRef.current) {
      const w = overlayCanvasRef.current.width || 640;
      const h = overlayCanvasRef.current.height || 480;
      const cx = w / 2;
      const cy = h / 2;
      const s = Math.min(w, h) * 0.28;

      lastDetectedLocationRef.current = {
        topLeftCorner: { x: cx - s, y: cy - s },
        topRightCorner: { x: cx + s, y: cy - s },
        bottomRightCorner: { x: cx + s, y: cy + s },
        bottomLeftCorner: { x: cx - s, y: cy + s },
      };
    }

    if (soundEnabled) playStatusAudio(calc.status);
    triggerHaptic(calc.status);
  };

  const calc = scannedItem
    ? calculateExpiryStatus(
        scannedItem.mfgDate || getTodayDateString(),
        scannedItem.expDate || getTodayDateString()
      )
    : null;

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-20">
      {/* Hidden processing canvas */}
      <canvas ref={processingCanvasRef} className="hidden" />

      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse">
              <Scan className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Pemindai Live Berkelanjutan</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                LIVE AR
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Kamera aktif terus-menerus. Warna otomatis berubah di atas setiap QR baru!
          </p>
        </div>

        <div className="flex items-center gap-1.5">
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

          <button
            onClick={startCamera}
            title="Muat Ulang Kamera"
            className="p-2 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingCamera ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          CONTINUOUS LIVE CAMERA VIEWPORT
          Video stays active continuously. AR overlay directly changes color on the QR code!
         ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden relative">
        <div className="relative w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner">
          {/* Continuous Live Video */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isStreaming ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Real-time Augmented Reality (AR) Overlay Canvas directly above the video */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />

          {/* Standby Viewfinder Radar (Displayed when no QR code is in view) */}
          {isStreaming && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-0">
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 border-t-4 border-l-4 border-cyan-400/80 rounded-tl-xl shadow-[0_0_8px_#22d3ee]" />
                <span className="text-[10px] font-mono text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                  SCAN CONTINUOUS: LIVE
                </span>
                <div className="w-8 h-8 border-t-4 border-r-4 border-cyan-400/80 rounded-tr-xl shadow-[0_0_8px_#22d3ee]" />
              </div>

              {/* Scanning Laser Beam */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-pulse" />

              <div className="flex justify-between items-end">
                <div className="w-8 h-8 border-b-4 border-l-4 border-cyan-400/80 rounded-bl-xl shadow-[0_0_8px_#22d3ee]" />
                <span className="text-[9px] font-mono text-cyan-400/90 bg-slate-950/70 px-2 py-0.5 rounded">
                  Arahkan kamera ke QR barang apa saja
                </span>
                <div className="w-8 h-8 border-b-4 border-r-4 border-cyan-400/80 rounded-br-xl shadow-[0_0_8px_#22d3ee]" />
              </div>
            </div>
          )}

          {/* Camera Loading Spinner */}
          {isLoadingCamera && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-3" />
              <p className="text-xs text-cyan-300 font-semibold">
                Membuka Kamera HP...
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Harap izinkan akses kamera pada pop-up browser
              </p>
            </div>
          )}

          {/* Camera Error / Permission Missing State */}
          {!isStreaming && !isLoadingCamera && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-30">
              <CameraOff className="w-12 h-12 text-slate-600 mb-3" />
              <h4 className="font-bold text-white text-sm mb-1">
                Kamera Belum Aktif
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
                {cameraError || 'Tekan tombol di bawah untuk menyalakan kamera HP Anda.'}
              </p>

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={startCamera}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Aktifkan Kamera Sekarang</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            PANEL KONTROL STOK REAL-TIME & TOMBOL 1X KLIK KURANGI STOK (-1)
            Updates dynamically to whatever item is currently in view!
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
                  Barang Terpindai:
                </span>
                <h4 className="text-sm font-bold text-white line-clamp-1">
                  {scannedItem.name || 'Barang Terpindai'}
                </h4>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[11px] text-slate-400">Sisa Stok:</span>
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

            {/* TOMBOL 1X TEKAN: KURANGI STOK (-1) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrementStock}
                disabled={isUpdatingStock || currentStock <= 0}
                className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-95 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
                className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition-all"
              >
                <PlusCircle className="w-5 h-5 text-emerald-400" />
              </button>
            </div>

            {/* Toggle Detailed View */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Kamera Live siap membaca QR berikutnya</span>
              </span>

              <button
                type="button"
                onClick={() => setViewDetails(!viewDetails)}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium border border-slate-700"
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

        {/* Quick Demo Test Buttons for Live AR Color Switching */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Uji Coba Ganti Warna AR Secara Instan (1-Klik):</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickTest('green')}
              className="py-2 px-1 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-[10px]">🟢 GANTI HIJAU</span>
              <span className="text-[9px] font-normal text-emerald-400/80">Di Atas EXP</span>
            </button>

            <button
              onClick={() => handleQuickTest('yellow')}
              className="py-2 px-1 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-700/60 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-[10px]">🟡 GANTI KUNING</span>
              <span className="text-[9px] font-normal text-amber-400/80">Pertengahan</span>
            </button>

            <button
              onClick={() => handleQuickTest('red')}
              className="py-2 px-1 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-700/60 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition-all"
            >
              <span className="text-[10px]">🔴 GANTI MERAH</span>
              <span className="text-[9px] font-normal text-red-400/80">Hari EXP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
