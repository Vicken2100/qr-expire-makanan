import React, { useRef } from 'react';
import { X, Printer, Download, Share2, Check } from 'lucide-react';
import { Item } from '../types';
import { calculateExpiryStatus, formatIndonesianDate } from '../utils/expiry';

interface PrintLabelModalProps {
  item: Item;
  qrDataUrl: string;
  onClose: () => void;
}

export const PrintLabelModal: React.FC<PrintLabelModalProps> = ({
  item,
  qrDataUrl,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const calc = calculateExpiryStatus(item.mfgDate, item.expDate);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_EXP_${item.expDate}.png`;
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Label QR: ${item.name}`,
          text: `Produk: ${item.name} | MFG: ${item.mfgDate} | EXP: ${item.expDate} | Status: ${calc.label}`,
        });
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(
        `Produk: ${item.name}\nMFG: ${item.mfgDate}\nEXP: ${item.expDate}\nStatus: ${calc.label}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Label Stiker Siap Cetak</h3>
            <p className="text-xs text-slate-400">Cocok untuk printer thermal & tempel produk</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Stiker Card (Physical Preview) */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/50">
          <div
            ref={printAreaRef}
            id="printable-label"
            className="w-full max-w-[320px] bg-white text-slate-900 rounded-2xl p-5 shadow-xl border-2 border-slate-300 print:border-none print:shadow-none print:m-0 print:p-4"
          >
            {/* Header label */}
            <div className="border-b border-dashed border-slate-300 pb-2.5 mb-3 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {item.category || 'PRODUK'}
                </span>
                <h4 className="text-base font-extrabold leading-tight text-slate-950 line-clamp-2">
                  {item.name}
                </h4>
                {item.batchNumber && (
                  <span className="text-[10px] font-mono text-slate-600 block mt-0.5">
                    Batch: {item.batchNumber}
                  </span>
                )}
              </div>
              <div
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight text-white shrink-0 ${
                  calc.status === 'red'
                    ? 'bg-red-600'
                    : calc.status === 'yellow'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              >
                {calc.status === 'red' ? 'EXP' : calc.status === 'yellow' ? 'MID' : 'SAFE'}
              </div>
            </div>

            {/* QR Code Centerpiece */}
            <div className="flex flex-col items-center justify-center my-2">
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                <img
                  src={qrDataUrl}
                  alt={`QR ${item.name}`}
                  className="w-44 h-44 object-contain"
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-1.5 tracking-wider">
                ID: {item.id.slice(-8).toUpperCase()}
              </span>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dashed border-slate-300 text-left">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[9px] font-semibold text-slate-500 block uppercase">
                  Tgl Pembuatan (MFG)
                </span>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {item.mfgDate}
                </span>
                <span className="text-[9px] text-slate-400 block">
                  {formatIndonesianDate(item.mfgDate)}
                </span>
              </div>

              <div
                className={`p-2 rounded-lg border ${
                  calc.status === 'red'
                    ? 'bg-red-50 border-red-200'
                    : calc.status === 'yellow'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <span className="text-[9px] font-semibold text-slate-500 block uppercase">
                  Tgl Kedaluwarsa (EXP)
                </span>
                <span
                  className={`text-xs font-bold font-mono ${
                    calc.status === 'red'
                      ? 'text-red-700'
                      : calc.status === 'yellow'
                      ? 'text-amber-800'
                      : 'text-emerald-700'
                  }`}
                >
                  {item.expDate}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {formatIndonesianDate(item.expDate)}
                </span>
              </div>
            </div>

            {/* Footer notice */}
            <div className="mt-3 text-center">
              <span className="text-[9px] text-slate-500 font-medium block">
                Pindai dengan kamera HP untuk cek masa kedaluwarsa
              </span>
            </div>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap gap-2 justify-end">
          <button
            onClick={handleDownload}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Unduh PNG</span>
          </button>

          <button
            onClick={handleShare}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 active:scale-95 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Bagikan</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Stiker Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
