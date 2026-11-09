import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { QRScanner } from './components/QRScanner';
import { QRGenerator } from './components/QRGenerator';
import { ItemList } from './components/ItemList';
import { AnalyticsView } from './components/AnalyticsView';
import { ActiveTab, Item, ScanLog } from './types';
import { getTodayDateString, calculateExpiryStatus } from './utils/expiry';
import {
  subscribeToItems,
  subscribeToScans,
  seedSampleDataIfEmpty,
} from './services/itemService';
import { testFirestoreConnection } from './lib/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [items, setItems] = useState<Item[]>([]);
  const [recentScans, setRecentScans] = useState<ScanLog[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [itemToEdit, setItemToEdit] = useState<Partial<Item> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = getTodayDateString();

  // Initial connection test & real-time Firestore listeners
  useEffect(() => {
    // 1. Test Firestore connectivity
    testFirestoreConnection().then((connected) => {
      setIsOnline(connected);
    });

    // 2. Real-time items listener
    const unsubscribeItems = subscribeToItems(
      (data) => {
        setItems(data);
        setIsLoading(false);
        setIsOnline(true);

        // Auto seed sample data on first run if database is empty
        if (data.length === 0) {
          seedSampleDataIfEmpty(0);
        }
      },
      (error) => {
        console.warn('Real-time subscription error:', error);
        setIsOnline(false);
        setIsLoading(false);
      }
    );

    // 3. Real-time scan logs across phones
    const unsubscribeScans = subscribeToScans(
      (scanData) => {
        setRecentScans(scanData);
      },
      (error) => {
        console.warn('Scan subscription error:', error);
      }
    );

    return () => {
      unsubscribeItems();
      unsubscribeScans();
    };
  }, []);

  // Compute status counts for bottom bar badges
  const itemsWithCalc = items.map((it) => ({
    ...it,
    calc: calculateExpiryStatus(it.mfgDate, it.expDate),
  }));

  const expiredCount = itemsWithCalc.filter((i) => i.calc.status === 'red').length;
  const warningCount = itemsWithCalc.filter((i) => i.calc.status === 'yellow').length;

  const handleEditItem = (item: Item) => {
    setItemToEdit(item);
    setActiveTab('generator');
  };

  const handleNavigateToGeneratorWithData = (itemData: Partial<Item>) => {
    setItemToEdit(itemData);
    setActiveTab('generator');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isOnline={isOnline}
        itemCount={items.length}
        todayDateStr={todayStr}
        onRefresh={() => {
          testFirestoreConnection().then(setIsOnline);
        }}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 md:py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">
              Menghubungkan ke Database Real-time Firebase...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'scanner' && (
              <QRScanner
                existingItems={items}
                onItemUpdated={(updated) => {
                  setItems((prev) =>
                    prev.map((it) => (it.id === updated.id ? updated : it))
                  );
                }}
                onNavigateToGenerator={handleNavigateToGeneratorWithData}
              />
            )}

            {activeTab === 'generator' && (
              <QRGenerator
                initialItem={itemToEdit}
                onItemCreated={() => {
                  setItemToEdit(null);
                  setActiveTab('items');
                }}
              />
            )}

            {activeTab === 'items' && (
              <ItemList
                items={items}
                onAddNew={() => {
                  setItemToEdit(null);
                  setActiveTab('generator');
                }}
                onEditItem={handleEditItem}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView
                items={items}
                recentScans={recentScans}
                onSelectTab={(tab) => {
                  setItemToEdit(null);
                  setActiveTab(tab);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Smartphone-Optimized Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab !== 'generator') setItemToEdit(null);
          setActiveTab(tab);
        }}
        itemCount={items.length}
        expiredCount={expiredCount}
        warningCount={warningCount}
      />
    </div>
  );
}
