import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Item, ScanLog } from '../types';
import { encodeQRPayload, getTodayDateString, addDaysToDateString } from '../utils/expiry';

const ITEMS_COLLECTION = 'items';
const SCANS_COLLECTION = 'scans';

/**
 * Real-time subscription to items collection
 */
export function subscribeToItems(
  onData: (items: Item[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const itemsRef = collection(db, ITEMS_COLLECTION);
  const q = query(itemsRef, orderBy('updatedAt', 'desc'), limit(100));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: Item[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || '',
          mfgDate: data.mfgDate || '',
          expDate: data.expDate || '',
          batchNumber: data.batchNumber || '',
          category: data.category || '',
          quantity: data.quantity ?? 1,
          unit: data.unit || 'pcs',
          notes: data.notes || '',
          qrPayload: data.qrPayload || '',
          scannedCount: data.scannedCount || 0,
          lastScannedAt: data.lastScannedAt || '',
          createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
          createdBy: data.createdBy || '',
        };
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, ITEMS_COLLECTION);
    }
  );

  return unsubscribe;
}

/**
 * Real-time subscription to recent scans across all connected smartphones
 */
export function subscribeToScans(
  onData: (scans: ScanLog[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const scansRef = collection(db, SCANS_COLLECTION);
  const q = query(scansRef, orderBy('scannedAt', 'desc'), limit(50));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const scans: ScanLog[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          itemId: data.itemId || '',
          itemName: data.itemName || '',
          status: data.status || 'green',
          daysRemaining: data.daysRemaining || 0,
          scannedAt: typeof data.scannedAt?.toDate === 'function' ? data.scannedAt.toDate().toISOString() : data.scannedAt || new Date().toISOString(),
          deviceInfo: data.deviceInfo || '',
        };
      });
      onData(scans);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, SCANS_COLLECTION);
    }
  );

  return unsubscribe;
}

/**
 * Save or update an item in Firestore
 */
export async function saveItem(item: Partial<Item>): Promise<Item> {
  const itemId = item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const qrPayload = encodeQRPayload({ ...item, id: itemId });
  const nowIso = new Date().toISOString();

  const itemData = {
    id: itemId,
    name: (item.name || 'Produk Baru').slice(0, 100),
    mfgDate: item.mfgDate || getTodayDateString(),
    expDate: item.expDate || addDaysToDateString(getTodayDateString(), 30),
    batchNumber: (item.batchNumber || '').slice(0, 50),
    category: (item.category || 'Umum').slice(0, 50),
    quantity: Math.max(0, item.quantity ?? 1),
    unit: (item.unit || 'pcs').slice(0, 20),
    notes: (item.notes || '').slice(0, 500),
    qrPayload: qrPayload.slice(0, 1000),
    scannedCount: item.scannedCount ?? 0,
    lastScannedAt: item.lastScannedAt || nowIso,
    createdAt: item.createdAt || nowIso,
    updatedAt: nowIso,
    createdBy: item.createdBy || 'smartphone_user',
  };

  const path = `${ITEMS_COLLECTION}/${itemId}`;
  try {
    await setDoc(doc(db, ITEMS_COLLECTION, itemId), itemData, { merge: true });
    return itemData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete an item from Firestore
 */
export async function deleteItem(itemId: string): Promise<void> {
  const path = `${ITEMS_COLLECTION}/${itemId}`;
  try {
    await deleteDoc(doc(db, ITEMS_COLLECTION, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Decrements stock by delta (default -1) and persists in real-time to Firestore
 */
export async function decrementOrUpdateItemStock(
  item: Partial<Item>,
  delta: number = -1
): Promise<{ item: Item; newQty: number }> {
  const currentQty = typeof item.quantity === 'number' ? item.quantity : 1;
  const newQty = Math.max(0, currentQty + delta);
  const nowIso = new Date().toISOString();

  if (item.id && !item.id.startsWith('unknown_')) {
    try {
      await updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
        quantity: newQty,
        updatedAt: nowIso,
      });
      return {
        item: { ...item, quantity: newQty, updatedAt: nowIso } as Item,
        newQty,
      };
    } catch {
      // If document does not exist yet in Firestore, save it fully
    }
  }

  // Fallback / save full document
  const saved = await saveItem({
    ...item,
    quantity: newQty,
  });
  return { item: saved, newQty };
}

/**
 * Log a scan event and increment item scan counter in real-time
 */
export async function recordScan(
  item: Partial<Item>,
  status: 'green' | 'yellow' | 'red',
  daysRemaining: number
): Promise<void> {
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = new Date().toISOString();

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const deviceInfo = isMobile ? 'Kamera HP (Mobile)' : 'Web Browser';

  const scanData: ScanLog = {
    id: scanId,
    itemId: item.id || `unknown_${Date.now()}`,
    itemName: (item.name || 'Barang Terpindai').slice(0, 100),
    status,
    daysRemaining,
    scannedAt: nowIso,
    deviceInfo,
  };

  try {
    await setDoc(doc(db, SCANS_COLLECTION, scanId), scanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SCANS_COLLECTION}/${scanId}`);
  }

  // Update item scanned count if itemId exists in items collection
  if (item.id && !item.id.startsWith('unknown_')) {
    try {
      const currentCount = (item.scannedCount || 0) + 1;
      await updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
        scannedCount: currentCount,
        lastScannedAt: nowIso,
        updatedAt: nowIso,
      });
    } catch {
      // If item was scanned from QR but wasn't in DB yet, non-fatal
    }
  }
}

/**
 * Seed initial sample demo items covering Green, Yellow, and Red if collection is empty
 */
export async function seedSampleDataIfEmpty(currentItemsCount: number): Promise<void> {
  if (currentItemsCount > 0) return;

  const today = getTodayDateString();

  const samples: Array<Partial<Item>> = [
    // 1. HIJAU (Masih lama di atas tanggal kedaluwarsa)
    {
      id: 'item_sample_green_1',
      name: 'Susu Pasteurisasi Segar 1L',
      mfgDate: addDaysToDateString(today, -3), // 3 days ago
      expDate: addDaysToDateString(today, 25), // 25 days remaining (total 28 days, midpoint = 14) -> GREEN
      category: 'Minuman Susu',
      batchNumber: 'LOT-SUSU-2026',
      quantity: 24,
      unit: 'botol',
      notes: 'Simpan dalam chiller suhu 2-4°C.',
    },
    // 2. KUNING (Pertengahan dari tanggal EXP)
    {
      id: 'item_sample_yellow_1',
      name: 'Roti Gandum Utuh Organic',
      mfgDate: addDaysToDateString(today, -8), // 8 days ago
      expDate: addDaysToDateString(today, 4), // 4 days remaining (total 12 days, midpoint = 6) -> 4 <= 6 -> YELLOW
      category: 'Roti & Bakery',
      batchNumber: 'LOT-ROTI-088',
      quantity: 15,
      unit: 'pack',
      notes: 'Masa simpan sudah melewati 50%. Taruh di display depan untuk promo FIFO.',
    },
    // 3. MERAH (Sudah hari EXP / Kedaluwarsa)
    {
      id: 'item_sample_red_1',
      name: 'Yogurt Strawberry Cup 150g',
      mfgDate: addDaysToDateString(today, -20),
      expDate: today, // Today is EXP! (diffDays == 0) -> RED
      category: 'Dairy Product',
      batchNumber: 'LOT-YOG-019',
      quantity: 6,
      unit: 'cup',
      notes: 'HARI INI TANGGAL EXP! Segera tarik dari display rak penjualan.',
    },
  ];

  for (const sample of samples) {
    try {
      await saveItem(sample);
    } catch (e) {
      console.warn('Initial seed skipped:', e);
    }
  }
}
