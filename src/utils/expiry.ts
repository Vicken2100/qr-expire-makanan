import { ExpiryCalculation, ExpiryStatus, Item } from '../types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Normalizes a date or date string (YYYY-MM-DD) to local midnight (00:00:00)
 */
export function normalizeDate(input: string | Date): Date {
  if (typeof input === 'string') {
    const [year, month, day] = input.split('-').map(Number);
    if (!year || !month || !day) {
      const parsed = new Date(input);
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
    return new Date(year, month - 1, day);
  }
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

/**
 * Calculates expiration status according to user specification:
 * 1. Merah jika sudah hari EXP (today >= expDate, atau sisa hari <= 0)
 * 2. Kuning jika pertengahan dari tanggal EXP (sisa hari <= totalShelfLife / 2)
 * 3. Hijau jika masih di atas waktu EXP (sisa hari > totalShelfLife / 2)
 */
export function calculateExpiryStatus(
  mfgDateStr: string,
  expDateStr: string,
  referenceDate: Date = new Date()
): ExpiryCalculation {
  const today = normalizeDate(referenceDate);
  const mfg = normalizeDate(mfgDateStr || expDateStr);
  const exp = normalizeDate(expDateStr || mfgDateStr);

  // Difference in calendar days between EXP and TODAY
  const diffTime = exp.getTime() - today.getTime();
  const daysRemaining = Math.round(diffTime / MS_PER_DAY);

  // Total shelf life in calendar days between MFG and EXP
  const totalShelfLifeDays = Math.max(1, Math.round((exp.getTime() - mfg.getTime()) / MS_PER_DAY));
  const midpointDays = Math.round(totalShelfLifeDays / 2);

  // Percent of shelf life passed (0% at MFG, 50% at midpoint, 100% at EXP)
  const daysPassed = Math.round((today.getTime() - mfg.getTime()) / MS_PER_DAY);
  const percentPassed = Math.min(100, Math.max(0, Math.round((daysPassed / totalShelfLifeDays) * 100)));
  const percentRemaining = Math.max(0, 100 - percentPassed);

  const isTodayExp = daysRemaining === 0;
  const isExpired = daysRemaining <= 0;
  const isHalfway = daysRemaining > 0 && daysRemaining <= midpointDays;
  const isFresh = daysRemaining > midpointDays;

  let status: ExpiryStatus;
  let label: string;
  let badgeText: string;
  let statusMessage: string;
  let subMessage: string;

  if (isExpired) {
    status = 'red';
    label = isTodayExp ? 'HARI EXP (KEDALUWARSA)' : 'SUDAH KEDALUWARSA';
    badgeText = isTodayExp ? '🔴 Hari Ini EXP' : '🔴 Kedaluwarsa';
    statusMessage = isTodayExp
      ? 'Hari ini adalah tanggal kedaluwarsa produk!'
      : `Produk sudah kedaluwarsa sejak ${Math.abs(daysRemaining)} hari yang lalu!`;
    subMessage = 'Jangan dikonsumsi atau dijual. Segera pisahkan barang ini dari rak stok.';
  } else if (isHalfway) {
    status = 'yellow';
    label = 'PERTENGAHAN EXP (WASPADA)';
    badgeText = '🟡 Pertengahan EXP';
    statusMessage = `Tersisa ${daysRemaining} hari lagi (sudah melewati ${percentPassed}% masa simpan).`;
    subMessage = 'Masa kedaluwarsa sudah di pertengahan. Utamakan untuk didistribusikan / dikonsumsi lebih dulu (FIFO).';
  } else {
    status = 'green';
    label = 'AMAN & SEGAR (DI ATAS EXP)';
    badgeText = '🟢 Aman & Segar';
    statusMessage = `Tersisa ${daysRemaining} hari lagi (masih di atas waktu kedaluwarsa).`;
    subMessage = 'Kualitas produk dalam kondisi prima dan masa simpan masih panjang.';
  }

  const colorClasses = {
    red: {
      bg: 'bg-red-500',
      bgSubtle: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-500',
      text: 'text-red-700 dark:text-red-400',
      ring: 'ring-red-500/30',
      badgeBg: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 border border-red-300 dark:border-red-800',
      badgeText: 'text-red-700 dark:text-red-300',
      indicatorDot: 'bg-red-500 ring-4 ring-red-200 dark:ring-red-900',
    },
    yellow: {
      bg: 'bg-amber-500',
      bgSubtle: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-500',
      text: 'text-amber-800 dark:text-amber-400',
      ring: 'ring-amber-500/30',
      badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800',
      badgeText: 'text-amber-800 dark:text-amber-300',
      indicatorDot: 'bg-amber-500 ring-4 ring-amber-200 dark:ring-amber-900',
    },
    green: {
      bg: 'bg-emerald-500',
      bgSubtle: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      ring: 'ring-emerald-500/30',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      indicatorDot: 'bg-emerald-500 ring-4 ring-emerald-200 dark:ring-emerald-900',
    },
  }[status];

  return {
    status,
    label,
    badgeText,
    daysRemaining,
    totalShelfLifeDays,
    midpointDays,
    percentRemaining,
    percentPassed,
    statusMessage,
    subMessage,
    isTodayExp,
    isExpired,
    isHalfway,
    isFresh,
    colorClasses,
  };
}

/**
 * Format date string (YYYY-MM-DD) to Indonesian formatted readable date
 */
export function formatIndonesianDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const date = normalizeDate(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Compact date format with day of week
 */
export function formatFullIndonesianDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const date = normalizeDate(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Encodes item information into a clean, compact QR Payload
 */
export function encodeQRPayload(item: Partial<Item>): string {
  const payload = {
    app: 'qrexp',
    v: 1,
    id: item.id || '',
    name: item.name || '',
    mfg: item.mfgDate || '',
    exp: item.expDate || '',
    batch: item.batchNumber || '',
    cat: item.category || '',
    qty: item.quantity ?? 1,
    unit: item.unit || 'pcs',
  };
  return JSON.stringify(payload);
}

/**
 * Parses raw scanned QR string back into item fields.
 * Supports:
 * 1. JSON format: {"app":"qrexp", "mfg":"...", "exp":"..."}
 * 2. Key-value pair strings: MFG: 2026-11-01 | EXP: 2026-11-20
 * 3. URL format with query params: ?mfg=2026-11-01&exp=2026-11-20
 */
export function parseQRPayload(rawText: string): Partial<Item> | null {
  if (!rawText || !rawText.trim()) return null;
  const trimmed = rawText.trim();

  // 1. Try parsing JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      return {
        id: data.id || `item_${Date.now()}`,
        name: data.name || data.nama || data.title || 'Barang Tanpa Nama',
        mfgDate: data.mfg || data.mfgDate || data.tgl_buat || '',
        expDate: data.exp || data.expDate || data.tgl_exp || '',
        batchNumber: data.batch || data.batchNumber || data.lot || '',
        category: data.cat || data.category || '',
        quantity: typeof data.qty === 'number' ? data.qty : 1,
        unit: data.unit || 'pcs',
        notes: data.notes || '',
      };
    } catch {
      // Continue to next parsers
    }
  }

  // 2. Try parsing URL query parameters
  if (trimmed.includes('?') && (trimmed.includes('exp=') || trimmed.includes('mfg='))) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://example.com${trimmed}`);
      const params = url.searchParams;
      return {
        id: params.get('id') || `item_${Date.now()}`,
        name: params.get('name') || 'Barang Terpindai',
        mfgDate: params.get('mfg') || '',
        expDate: params.get('exp') || '',
        batchNumber: params.get('batch') || '',
        category: params.get('cat') || '',
        quantity: Number(params.get('qty')) || 1,
        unit: params.get('unit') || 'pcs',
      };
    } catch {
      // Continue
    }
  }

  // 3. Try parsing text lines / delimiters (e.g. MFG: 2026-11-01, EXP: 2026-11-20)
  const dateRegex = /\b(\d{4}-\d{2}-\d{2})\b/g;
  const dates = trimmed.match(dateRegex);

  if (dates && dates.length >= 2) {
    return {
      id: `item_${Date.now()}`,
      name: trimmed.split('\n')[0].replace(/MFG|EXP/gi, '').trim() || 'Barang Terpindai',
      mfgDate: dates[0],
      expDate: dates[1],
      quantity: 1,
      unit: 'pcs',
    };
  } else if (dates && dates.length === 1) {
    // Single date found, treat as EXP
    return {
      id: `item_${Date.now()}`,
      name: 'Barang Terpindai',
      mfgDate: new Date().toISOString().split('T')[0],
      expDate: dates[0],
      quantity: 1,
      unit: 'pcs',
    };
  }

  return null;
}

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to add days to a date string (YYYY-MM-DD)
 */
export function addDaysToDateString(baseDateStr: string, daysToAdd: number): string {
  const base = normalizeDate(baseDateStr);
  base.setDate(base.getDate() + daysToAdd);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
