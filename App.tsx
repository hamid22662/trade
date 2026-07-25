import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import '@/i18n';
import { AppProvider, useApp } from '@/context/AppContext';
import { FeedbackProvider } from '@/components/feedback';
import AppNavigator from '@/AppNavigator';
import { getDb } from '@/db/database';
import { getSettings, listTrades } from '@/db/repositories';
import { checkInactivityAndNotify, requestNotificationPermission, scheduleDailyReminder } from '@/services/notifications';

function AppShell() {
  const { theme, isRTL } = useApp();

  useEffect(() => {
    const setupNotifications = async () => {
      const settings = await getSettings();
      if ((settings.notif_enabled ?? '1') !== '1') return;
      if (Platform.OS === 'web' && (typeof Notification === 'undefined' || Notification.permission !== 'granted')) return;
      if (!(await requestNotificationPermission())) return;
      await scheduleDailyReminder(Number(settings.notif_hour ?? '20'), Number(settings.notif_minute ?? '0'));

      if (Platform.OS === 'web') {
        const latest = await listTrades({ limit: 1, sort: 'newest' });
        await checkInactivityAndNotify(latest[0]?.open_time ?? null);
      } else {
        const db = await getDb();
        const latest = await db.getFirstAsync<{ open_time: string | null }>(
          'SELECT open_time FROM trades ORDER BY open_time DESC LIMIT 1',
        );
        await checkInactivityAndNotify(latest?.open_time ?? null);
      }
    };
    setupNotifications().catch(console.warn);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = isRTL ? 'fa' : 'en';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overscrollBehavior = 'none';
    const root = document.getElementById('root');
    if (root) root.style.height = '100%';
  }, [isRTL]);

  return <FeedbackProvider><StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} /><AppNavigator /></FeedbackProvider>;
}

export default function App() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><AppProvider><AppShell /></AppProvider></SafeAreaProvider></GestureHandlerRootView>;
}
