export type ExpiryStatus = 'green' | 'yellow' | 'red';

export interface Item {
  id: string;
  name: string;
  mfgDate: string; // YYYY-MM-DD (Tanggal pembuatan)
  expDate: string; // YYYY-MM-DD (Tanggal kedaluwarsa)
  batchNumber?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  qrPayload?: string;
  scannedCount?: number;
  lastScannedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface ScanLog {
  id: string;
  itemId: string;
  itemName?: string;
  status: ExpiryStatus;
  daysRemaining: number;
  scannedAt: string;
  deviceInfo?: string;
}

export interface ExpiryCalculation {
  status: ExpiryStatus;
  label: string;
  badgeText: string;
  daysRemaining: number;
  totalShelfLifeDays: number;
  midpointDays: number;
  percentRemaining: number;
  percentPassed: number;
  statusMessage: string;
  subMessage: string;
  isTodayExp: boolean;
  isExpired: boolean;
  isHalfway: boolean;
  isFresh: boolean;
  colorClasses: {
    bg: string;
    bgSubtle: string;
    border: string;
    text: string;
    ring: string;
    badgeBg: string;
    badgeText: string;
    indicatorDot: string;
  };
}

export type ActiveTab = 'scanner' | 'generator' | 'items' | 'analytics';
