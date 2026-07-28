import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { resetDatabase } from '@/db/database';
import {
  createStrategy,
  createSymbol,
  deleteCustomSymbol,
  deleteStrategy,
  getManagedSymbols,
  getStrategies,
  importTrades,
  getSettings,
  setSetting,
  setSymbolActive,
} from '@/db/repositories';
import { cancelAllNotifications, requestNotificationPermission, scheduleDailyReminder } from '@/services/notifications';
import { exportBackupJson, exportTradesCsv, restoreBackupJson } from '@/services/export';
import { pickMetaTraderReport, PickedMetaTraderReport } from '@/services/metatraderImport';
import { Market, StrategyRow, SymbolRow } from '@/types';
import { useApp } from '@/context/AppContext';
import { useFeedback } from '@/components/feedback';
import { formatMoney, formatNumber } from '@/services/calculations';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import SponsorBanner from '@/components/SponsorBanner';
import {
  Badge,
  Button,
  Card,
  CollapsibleCard,
  Empty,
  Field,
  HeroCard,
  MiniKpi,
  ModalCloseButton,
  ResponsiveRow,
  Screen,
  SectionHeading,
  Segmented,
  Title,
} from '@/components/ui';

type NewSymbolForm = {
  symbol: string;
  market: Market;
  pipSize: string;
  contractSize: string;
  quoteCurrency: string;
};

type SymbolFilter = Market | 'all';
type DisplayMode = 'simple' | 'pro';

const initialNewSymbol: NewSymbolForm = {
  symbol: '',
  market: 'forex',
  pipSize: '0.0001',
  contractSize: '100000',
  quoteCurrency: 'USD',
};

const riskPresets = ['0.5', '1', '1.5', '2'];

const parseInputNumber = (value: string) => {
  const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAccountMoney = (value: number, currency: string) => formatMoney(value, currency).replace(/^\+/, '');

export default function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const {
    theme,
    isRTL,
    language,
    themeMode,
    setLanguage,
    setThemeMode,
    accountBalance,
    defaultRisk,
    currency,
    saveAccount,
    refresh,
    refreshKey,
    experienceMode,
    setExperienceMode,
  } = useApp();
  const { showToast, confirm } = useFeedback();
  const { isPhone } = useResponsiveLayout();
  const [balance, setBalance] = useState(String(accountBalance));
  const [risk, setRisk] = useState(String(defaultRisk));
  const [baseCurrency, setBaseCurrency] = useState(currency);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(experienceMode);
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [newStrategy, setNewStrategy] = useState('');
  const [symbolModalOpen, setSymbolModalOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState<NewSymbolForm>(initialNewSymbol);
  const [symbolSaving, setSymbolSaving] = useState(false);
  const [busySymbolId, setBusySymbolId] = useState<number | null>(null);
  const [symbolFilter, setSymbolFilter] = useState<SymbolFilter>('all');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationHour, setNotificationHour] = useState('20');
  const [notificationMinute, setNotificationMinute] = useState('00');
  const [importPreview, setImportPreview] = useState<PickedMetaTraderReport | null>(null);
  const [importingTrades, setImportingTrades] = useState(false);

  const activeSymbols = useMemo(() => symbols.filter((symbol) => symbol.active === 1).length, [symbols]);
  const forexSymbols = useMemo(() => symbols.filter((symbol) => symbol.market === 'forex').length, [symbols]);
  const cryptoSymbols = useMemo(() => symbols.filter((symbol) => symbol.market === 'crypto').length, [symbols]);
  const customSymbols = useMemo(() => symbols.filter((symbol) => symbol.is_custom === 1).length, [symbols]);
  const numericBalance = parseInputNumber(balance);
  const numericRisk = parseInputNumber(risk);
  const riskPerTrade = numericBalance > 0 && numericRisk > 0 ? (numericBalance * numericRisk) / 100 : 0;

  const filteredSymbols = useMemo(() => {
    const query = symbolSearch.trim().toUpperCase();
    return symbols.filter((symbol) => {
      const marketMatches = symbolFilter === 'all' || symbol.market === symbolFilter;
      const queryMatches = !query || symbol.symbol.includes(query);
      return marketMatches && queryMatches;
    });
  }, [symbols, symbolFilter, symbolSearch]);

  const loadManagedData = useCallback(async () => {
    const [symbolRows, strategyRows] = await Promise.all([getManagedSymbols(), getStrategies()]);
    setSymbols(symbolRows);
    setStrategies(strategyRows);
  }, []);

  useEffect(() => {
    setBalance(String(accountBalance));
    setRisk(String(defaultRisk));
    setBaseCurrency(currency);
  }, [accountBalance, defaultRisk, currency]);

  useEffect(() => {
    setDisplayMode(experienceMode);
  }, [experienceMode]);

  useEffect(() => {
    loadManagedData().catch(() => showToast({
      title: isRTL ? 'نمادها بارگذاری نشدند' : 'Symbols could not be loaded',
      message: isRTL ? 'صفحه را دوباره باز کن و مجدداً تلاش کن.' : 'Reopen the screen and try again.',
      tone: 'danger',
    }));
  }, [loadManagedData, refreshKey, isRTL, showToast]);

  useEffect(() => {
    getSettings().then((settings) => {
      setNotificationsEnabled((settings.notif_enabled ?? '1') === '1');
      setNotificationHour(settings.notif_hour ?? '20');
      setNotificationMinute((settings.notif_minute ?? '0').padStart(2, '0'));
    }).catch(() => undefined);
  }, [refreshKey]);

  const textAlign = isRTL ? 'right' : 'left';
  const rowDirection = isRTL ? 'row-reverse' : 'row';
  const neutralWebDirection = Platform.OS === 'web' ? ({ direction: 'ltr' } as any) : undefined;
  const savedCurrency = baseCurrency.trim().toUpperCase() || 'USD';

  const save = async () => {
    const accountBalanceValue = parseInputNumber(balance);
    const riskValue = parseInputNumber(risk);
    if (accountBalanceValue <= 0 || riskValue <= 0) {
      showToast({ title: t('common.checkFields'), message: t('settings.accountInvalid'), tone: 'warning' });
      return;
    }
    await saveAccount({ accountBalance: accountBalanceValue, defaultRisk: riskValue, currency: savedCurrency });
    setBaseCurrency(savedCurrency);
    showToast({ title: t('common.saved'), tone: 'success' });
  };

  const saveDisplayMode = async (value: DisplayMode) => {
    setDisplayMode(value);
    await setExperienceMode(value);
    showToast({ title: t('common.saved'), message: value === 'pro' ? t('settings.proModeSaved') : t('settings.simpleModeSaved'), tone: 'success' });
  };

  const saveNotificationSettings = async () => {
    const hour = Number(notificationHour);
    const minute = Number(notificationMinute);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      showToast({ title: t('common.checkFields'), message: isRTL ? 'ساعت باید بین ۰ تا ۲۳ و دقیقه بین ۰ تا ۵۹ باشد.' : 'Hour must be 0–23 and minute must be 0–59.', tone: 'warning' });
      return;
    }
    if (notificationsEnabled && !(await requestNotificationPermission())) {
      await setSetting('notif_enabled', '0');
      setNotificationsEnabled(false);
      showToast({ title: isRTL ? 'مجوز نوتیفیکیشن داده نشد' : 'Notification permission denied', tone: 'warning' });
      return;
    }
    await Promise.all([
      setSetting('notif_enabled', notificationsEnabled ? '1' : '0'),
      setSetting('notif_hour', String(hour)),
      setSetting('notif_minute', String(minute)),
    ]);
    if (notificationsEnabled) await scheduleDailyReminder(hour, minute);
    else await cancelAllNotifications();
    setNotificationHour(String(hour));
    setNotificationMinute(String(minute).padStart(2, '0'));
    showToast({ title: t('common.saved'), tone: 'success' });
  };

  const toggleSymbol = async (symbol: SymbolRow, active: boolean) => {
    if (busySymbolId !== null) return;
    setBusySymbolId(symbol.id);
    try {
      await setSymbolActive(symbol.id, active);
      await loadManagedData();
      refresh();
    } catch {
      showToast({
        title: isRTL ? 'تغییر نماد انجام نشد' : 'Symbol update failed',
        message: isRTL ? 'دوباره تلاش کن.' : 'Try again.',
        tone: 'danger',
      });
    } finally {
      setBusySymbolId(null);
    }
  };

  const setNewSymbolMarket = (market: Market) => {
    setNewSymbol((old) => ({
      ...old,
      market,
      pipSize: market === 'forex' ? '0.0001' : '1',
      contractSize: market === 'forex' ? '100000' : '1',
      quoteCurrency: market === 'forex' ? 'USD' : 'USDT',
    }));
  };

  const closeSymbolModal = () => {
    if (symbolSaving) return;
    setSymbolModalOpen(false);
    setNewSymbol(initialNewSymbol);
  };

  const addSymbol = async () => {
    if (symbolSaving) return;
    setSymbolSaving(true);
    try {
      await createSymbol({
        symbol: newSymbol.symbol,
        market: newSymbol.market,
        pip_size: parseInputNumber(newSymbol.pipSize),
        contract_size: parseInputNumber(newSymbol.contractSize),
        quote_currency: newSymbol.quoteCurrency,
      });
      setNewSymbol(initialNewSymbol);
      setSymbolModalOpen(false);
      setSymbolFilter('all');
      setSymbolSearch('');
      await loadManagedData();
      refresh();
      showToast({ title: t('common.saved'), message: t('settings.symbolAdded'), tone: 'success' });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      showToast({
        title: t('common.checkFields'),
        message: code === 'SYMBOL_EXISTS' ? t('settings.symbolExists') : t('settings.symbolInvalid'),
        tone: 'warning',
      });
    } finally {
      setSymbolSaving(false);
    }
  };

  const removeSymbol = (symbol: SymbolRow) => confirm({
    title: t('settings.deleteSymbolTitle'),
    message: `${t('settings.deleteSymbolMessage')} “${symbol.symbol}”`,
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    destructive: true,
    onConfirm: async () => {
      if (busySymbolId !== null) return;
      setBusySymbolId(symbol.id);
      try {
        await deleteCustomSymbol(symbol.id);
        await loadManagedData();
        refresh();
        showToast({ title: t('common.saved'), message: t('settings.symbolDeleted'), tone: 'success' });
      } catch {
        showToast({
          title: isRTL ? 'حذف نماد انجام نشد' : 'Symbol deletion failed',
          message: isRTL ? 'فقط نمادهای سفارشی قابل حذف‌اند. دوباره تلاش کن.' : 'Only custom symbols can be deleted. Try again.',
          tone: 'danger',
        });
      } finally {
        setBusySymbolId(null);
      }
    },
  });

  const addStrategy = async () => {
    if (!newStrategy.trim()) {
      showToast({ title: t('common.checkFields'), message: t('settings.strategyRequired'), tone: 'warning' });
      return;
    }
    try {
      await createStrategy(newStrategy);
      setNewStrategy('');
      await loadManagedData();
      refresh();
      showToast({ title: t('common.saved'), message: t('settings.strategyAdded'), tone: 'success' });
    } catch {
      showToast({ title: t('common.checkFields'), message: t('settings.strategyDuplicate'), tone: 'warning' });
    }
  };

  const removeStrategy = (strategy: StrategyRow) => confirm({
    title: t('settings.deleteStrategyTitle'),
    message: `${t('settings.deleteStrategyMessage')} “${strategy.name}”`,
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    destructive: true,
    onConfirm: async () => {
      await deleteStrategy(strategy.id);
      await loadManagedData();
      refresh();
      showToast({ title: t('common.saved'), message: t('settings.strategyDeleted'), tone: 'success' });
    },
  });

  const chooseMetaTraderReport = async () => {
    try {
      const report = await pickMetaTraderReport();
      if (report) setImportPreview(report);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const message = code === 'REPORT_TOO_LARGE'
        ? (isRTL ? 'حجم فایل بیشتر از ۱۵ مگابایت است.' : 'The report is larger than 15 MB.')
        : code === 'UNSUPPORTED_METATRADER_COLUMNS'
          ? (isRTL ? 'ستون‌های فایل شناخته نشد. خروجی History یا Account Statement متاتریدر را با فرمت CSV/HTML انتخاب کن.' : 'Columns were not recognized. Export MetaTrader History or Account Statement as CSV/HTML.')
          : code === 'NO_TRADES_DETECTED'
            ? (isRTL ? 'هیچ معامله قابل واردکردنی در فایل پیدا نشد.' : 'No importable trades were found in the file.')
            : (isRTL ? 'فایل متاتریدر خوانده نشد. CSV یا HTML دیگری امتحان کن.' : 'The MetaTrader report could not be read. Try another CSV or HTML export.');
      showToast({ title: isRTL ? 'خطا در خواندن گزارش' : 'Report import failed', message, tone: 'danger' });
    }
  };

  const commitMetaTraderImport = async () => {
    if (!importPreview || importingTrades) return;
    setImportingTrades(true);
    try {
      const result = await importTrades(importPreview.trades);
      setImportPreview(null);
      await loadManagedData();
      refresh();
      showToast({
        title: isRTL ? `${result.imported} معامله وارد شد` : `${result.imported} trades imported`,
        message: isRTL
          ? `${result.skipped} مورد تکراری رد شد${result.symbolsCreated ? ` و ${result.symbolsCreated} نماد جدید ساخته شد` : ''}.`
          : `${result.skipped} duplicate(s) skipped${result.symbolsCreated ? ` and ${result.symbolsCreated} new symbol(s) created` : ''}.`,
        tone: 'success',
      });
    } catch (error) {
      showToast({
        title: isRTL ? 'ورود اطلاعات کامل نشد' : 'Import did not complete',
        message: error instanceof Error ? error.message : (isRTL ? 'خطای ناشناخته' : 'Unknown error'),
        tone: 'danger',
      });
    } finally {
      setImportingTrades(false);
    }
  };

  const erase = () => confirm({
    title: t('settings.deleteAll'),
    message: t('settings.deleteWarning'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    destructive: true,
    onConfirm: async () => {
      await resetDatabase();
      await loadManagedData();
      refresh();
      showToast({ title: t('common.saved'), message: t('settings.resetComplete'), tone: 'success' });
    },
  });

  const renderMutedText = (text: string, marginBottom = 12) => (
    <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 20, fontWeight: '700', marginBottom, textAlign }}>{text}</Text>
  );

  return <Screen maxContentWidth={1080}>
    <Title eyebrow="TradeLog" subtitle={t('settings.controlCenterSubtitle')}>{t('settings.title')}</Title>
    <SponsorBanner />

    <Card>
      <SectionHeading title={Platform.OS === 'web' ? (isRTL ? 'اعلان‌های مرورگر' : 'Browser notifications') : (isRTL ? 'نوتیفیکیشن‌ها' : 'Notifications')} icon="bell" />
      {Platform.OS === 'web' ? renderMutedText(isRTL ? 'یادآور در مرورگر فعال است و تا وقتی وب‌اپ باز باشد طبق ساعت انتخابی اجرا می‌شود. اعلان پس‌زمینه کامل بعداً با Web Push سرور اضافه می‌شود.' : 'Browser reminders work while the web app is open. Full background delivery can later be added with server-side Web Push.') : null}
      <View style={[{ flexDirection: rowDirection, alignItems: 'center', justifyContent: 'space-between', marginBottom: notificationsEnabled ? 16 : 0 }, neutralWebDirection]}>
        <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '800', textAlign }}>{isRTL ? 'یادآور روزانه' : 'Daily reminder'}</Text>
        <Switch style={neutralWebDirection} value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: theme.colors.border, true: theme.colors.successSoft }} thumbColor={notificationsEnabled ? theme.colors.success : theme.colors.textSubtle} />
      </View>
      {notificationsEnabled ? <View style={{ marginBottom: 14 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign }}>{isRTL ? 'ساعت یادآور' : 'Reminder time'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isRTL ? 'flex-end' : 'flex-start', gap: 8 }}>
          <TextInput value={notificationHour} onChangeText={setNotificationHour} keyboardType="number-pad" maxLength={2} placeholder="20" style={{ width: 64, height: 46, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, color: theme.colors.text, textAlign: 'center', fontSize: 16, fontWeight: '800' }} />
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '900' }}>:</Text>
          <TextInput value={notificationMinute} onChangeText={setNotificationMinute} keyboardType="number-pad" maxLength={2} placeholder="00" style={{ width: 64, height: 46, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, color: theme.colors.text, textAlign: 'center', fontSize: 16, fontWeight: '800' }} />
        </View>
      </View> : null}
      <Button title={isRTL ? 'ذخیره تنظیمات نوتیف' : 'Save notification settings'} icon="save" onPress={saveNotificationSettings} />
    </Card>

    <HeroCard
      eyebrow={t('settings.tradingSetup')}
      title={t('settings.accountSummary')}
      value={formatAccountMoney(numericBalance, savedCurrency)}
      caption={t('settings.setupHint')}
      tone="primary"
      right={<Badge label={displayMode === 'pro' ? t('settings.pro') : t('settings.simple')} tone={displayMode === 'pro' ? 'primary' : 'info'} icon={displayMode === 'pro' ? 'zap' : 'shield'} />}
      footer={<View style={{ flexDirection: rowDirection, gap: 8, flexWrap: 'wrap' }}>
        <MiniKpi label={t('settings.defaultRisk')} value={`${formatNumber(numericRisk, 2)}%`} tone="warning" />
        <MiniKpi label={t('settings.riskPerTrade')} value={formatAccountMoney(riskPerTrade, savedCurrency)} tone="success" />
        <MiniKpi label={t('settings.symbolsActive')} value={`${activeSymbols}/${symbols.length || 0}`} tone="info" />
      </View>}
    />

    <Card elevated>
      <SectionHeading title={t('settings.workspace')} icon="sliders" />
      {renderMutedText(t('settings.workspaceHint'))}
      <Text style={{ color: theme.colors.textMuted, fontWeight: '900', fontSize: 11, marginBottom: 8, textAlign }}>{t('settings.language')}</Text>
      <Segmented value={language} onChange={(value) => setLanguage(value as 'fa' | 'en')} options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]} />
      <Text style={{ color: theme.colors.textMuted, fontWeight: '900', fontSize: 11, marginTop: 16, marginBottom: 8, textAlign }}>{t('settings.theme')}</Text>
      <Segmented value={themeMode} onChange={(value) => setThemeMode(value as 'dark' | 'light')} options={[{ value: 'dark', label: t('settings.dark') }, { value: 'light', label: t('settings.light') }]} />
      <Text style={{ color: theme.colors.textMuted, fontWeight: '900', fontSize: 11, marginTop: 16, marginBottom: 8, textAlign }}>{t('settings.displayMode')}</Text>
      <Segmented value={displayMode} onChange={(value) => saveDisplayMode(value as DisplayMode)} options={[{ value: 'simple', label: t('settings.simple') }, { value: 'pro', label: t('settings.pro') }]} />
      <ResponsiveRow breakpoint={560} gap={10} style={{ marginTop: 12 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: displayMode === 'simple' ? theme.colors.info : theme.colors.border, backgroundColor: displayMode === 'simple' ? theme.colors.infoSoft : theme.colors.surfaceMuted, borderRadius: 18, padding: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign, fontSize: 13 }}>{t('settings.simple')}</Text>
          <Text style={{ color: theme.colors.textMuted, fontWeight: '700', textAlign, fontSize: 10, lineHeight: 16, marginTop: 5 }}>{t('settings.simpleHint')}</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: displayMode === 'pro' ? theme.colors.primaryGlow : theme.colors.border, backgroundColor: displayMode === 'pro' ? theme.colors.primarySoft : theme.colors.surfaceMuted, borderRadius: 18, padding: 12 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign, fontSize: 13 }}>{t('settings.pro')}</Text>
          <Text style={{ color: theme.colors.textMuted, fontWeight: '700', textAlign, fontSize: 10, lineHeight: 16, marginTop: 5 }}>{t('settings.proHint')}</Text>
        </View>
      </ResponsiveRow>
    </Card>

    <Card elevated>
      <SectionHeading title={t('settings.account')} icon="credit-card" meta={savedCurrency} />
      {renderMutedText(t('settings.accountHint'))}
      <Field label={t('trade.accountBalance')} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" icon="dollar-sign" suffix={savedCurrency} />
      <Field label={`${t('settings.defaultRisk')} (%)`} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" icon="shield" suffix="%" />
      <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {riskPresets.map((preset) => {
          const active = parseInputNumber(risk) === parseInputNumber(preset);
          return <Pressable key={preset} onPress={() => setRisk(preset)} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1, borderWidth: active ? 1.5 : 1, borderColor: active ? theme.colors.warning : theme.colors.border, backgroundColor: active ? theme.colors.warningSoft : theme.colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 })}>
            <Text style={{ color: active ? theme.colors.warning : theme.colors.textMuted, fontWeight: '900', fontSize: 12 }}>{preset}%</Text>
          </Pressable>;
        })}
      </View>
      <Field label={t('settings.currency')} value={baseCurrency} onChangeText={(value) => setBaseCurrency(value.toUpperCase())} autoCapitalize="characters" icon="globe" />
      <View style={{ borderWidth: 1, borderColor: theme.colors.success, backgroundColor: theme.colors.successSoft, borderRadius: 20, padding: 14, marginTop: 4, marginBottom: 12 }}>
        <View style={{ flexDirection: isPhone ? 'column' : rowDirection, justifyContent: 'space-between', gap: 12, alignItems: isPhone ? 'stretch' : 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.success, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase', textAlign }}>{t('settings.riskPreview')}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', lineHeight: 17, marginTop: 5, textAlign }}>{t('settings.riskPreviewHint')}</Text>
          </View>
          <Text style={{ color: theme.colors.success, fontSize: isPhone ? 20 : 24, fontWeight: '900', textAlign }}>{formatAccountMoney(riskPerTrade, savedCurrency)}</Text>
        </View>
      </View>
      <Button title={t('settings.saveAccount')} icon="save" onPress={save} />
    </Card>

    <CollapsibleCard
      title={t('settings.symbolManagement')}
      subtitle={t('settings.symbolManagementHint')}
      icon="bar-chart-2"
      meta={`${activeSymbols}/${symbols.length || 0}`}
      defaultOpen={false}
    >
      <View style={{ flexDirection: rowDirection, gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Badge label={`${t('common.forex')}: ${forexSymbols}`} tone="info" />
        <Badge label={`${t('common.crypto')}: ${cryptoSymbols}`} tone="primary" />
        <Badge label={`${t('settings.customSymbol')}: ${customSymbols}`} tone="warning" />
      </View>
      <Button title={t('settings.addSymbol')} icon="plus" onPress={() => setSymbolModalOpen(true)} />
      <View style={{ height: 12 }} />
      <Segmented
        value={symbolFilter}
        onChange={(value) => setSymbolFilter(value as SymbolFilter)}
        options={[
          { value: 'all', label: t('common.all') },
          { value: 'forex', label: t('common.forex') },
          { value: 'crypto', label: t('common.crypto') },
        ]}
      />
      <View style={{ height: 10 }} />
      <Field label={t('settings.symbolSearch')} value={symbolSearch} onChangeText={(value) => setSymbolSearch(value.toUpperCase())} placeholder={t('settings.symbolSearchPlaceholder')} autoCapitalize="characters" icon="search" />
      {filteredSymbols.length ? <View style={{ gap: 9 }}>
        {filteredSymbols.map((symbol) => {
          const isActive = symbol.active === 1;
          const isCustom = symbol.is_custom === 1;
          return <View key={symbol.id} style={[{ borderWidth: 1, borderColor: isActive ? `${theme.colors.success}66` : theme.colors.border, backgroundColor: isActive ? theme.colors.surfaceMuted : theme.colors.backgroundElevated, borderRadius: 20, padding: 13 }, neutralWebDirection]}>
            <View style={{ flexDirection: rowDirection, justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '900', fontSize: 17, textAlign }}>{symbol.symbol}</Text>
                  <Badge label={symbol.market === 'forex' ? t('common.forex') : t('common.crypto')} tone={symbol.market === 'forex' ? 'info' : 'primary'} />
                  <Badge label={isActive ? t('settings.activeLabel') : t('settings.inactiveLabel')} tone={isActive ? 'success' : 'default'} />
                </View>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', marginTop: 7, lineHeight: 17, textAlign }}>
                  Pip {formatNumber(symbol.pip_size, 6)} · Contract {formatNumber(symbol.contract_size, 2)} · {symbol.quote_currency || '—'}
                </Text>
                <Text style={{ color: isCustom ? theme.colors.warning : theme.colors.textSubtle, fontSize: 10, fontWeight: '900', marginTop: 5, textAlign }}>{isCustom ? t('settings.customSymbol') : t('settings.defaultSymbol')}</Text>
              </View>
              <Switch
                style={neutralWebDirection}
                value={isActive}
                onValueChange={(value) => toggleSymbol(symbol, value)}
                disabled={busySymbolId !== null}
                trackColor={{ false: theme.colors.border, true: theme.colors.successSoft }}
                thumbColor={isActive ? theme.colors.success : theme.colors.textSubtle}
              />
            </View>
            {isCustom ? <Pressable disabled={busySymbolId !== null} onPress={() => removeSymbol(symbol)} style={({ pressed }) => ({ marginTop: 11, alignSelf: isRTL ? 'flex-start' : 'flex-end', flexDirection: rowDirection, alignItems: 'center', gap: 6, opacity: busySymbolId !== null ? 0.45 : pressed ? 0.7 : 1 })}>
              <Feather name="trash-2" size={14} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontSize: 11, fontWeight: '900' }}>{t('common.delete')}</Text>
            </Pressable> : null}
          </View>;
        })}
      </View> : <Empty title={t('settings.noSymbolsFound')} text={t('settings.noSymbolsFoundHint')} icon="search" />}
    </CollapsibleCard>

    <CollapsibleCard
      title={t('settings.strategyManagement')}
      subtitle={t('settings.strategyManagementHint')}
      icon="target"
      meta={`${strategies.length}`}
      defaultOpen={false}
    >
      <Field label={t('settings.strategyName')} value={newStrategy} onChangeText={setNewStrategy} placeholder={t('settings.strategyPlaceholder')} icon="edit-3" />
      <Button title={t('settings.addStrategy')} icon="plus" onPress={addStrategy} />
      {strategies.length ? <View style={{ gap: 8, marginTop: 14 }}>
        {strategies.map((strategy, index) => <View key={strategy.id} style={{ flexDirection: rowDirection, alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted, borderRadius: 18, padding: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign, fontSize: 14 }}>{strategy.name}</Text>
            <Text style={{ color: theme.colors.textSubtle, fontWeight: '800', textAlign, fontSize: 10, marginTop: 4 }}>{index < 3 ? t('settings.featuredStrategy') : t('settings.savedStrategy')}</Text>
          </View>
          <Pressable onPress={() => removeStrategy(strategy)} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
            <Feather name="trash-2" size={16} color={theme.colors.danger} />
          </Pressable>
        </View>)}
      </View> : <Empty title={t('settings.noStrategies')} text={t('settings.noStrategiesHint')} icon="target" />}
    </CollapsibleCard>

    <CollapsibleCard title={t('settings.data')} subtitle={t('settings.dataHint')} icon="database" defaultOpen={false}>
      <View style={{ borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft, borderRadius: 20, padding: 14, marginBottom: 12 }}>
        <View style={{ flexDirection: rowDirection, gap: 10, alignItems: 'center' }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface }}>
            <Feather name="upload-cloud" size={20} color={theme.colors.primaryGlow} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign, fontSize: 14 }}>{isRTL ? 'ورود خودکار از MetaTrader 4/5' : 'Auto-import from MetaTrader 4/5'}</Text>
            <Text style={{ color: theme.colors.textMuted, fontWeight: '700', textAlign, lineHeight: 18, fontSize: 11, marginTop: 5 }}>{isRTL ? 'فایل History یا Account Statement با فرمت CSV/HTML را انتخاب کن؛ نماد، جهت، حجم، قیمت‌ها، زمان، کمیسیون، سواپ و سود خودکار تشخیص داده می‌شوند.' : 'Choose a History or Account Statement CSV/HTML file. Symbol, side, size, prices, times, commission, swap and P&L are detected automatically.'}</Text>
          </View>
        </View>
      </View>
      <Button title={isRTL ? 'انتخاب فایل متاتریدر' : 'Choose MetaTrader report'} icon="upload" variant="secondary" onPress={chooseMetaTraderReport} />
      <View style={{ height: 16 }} />
      <View style={{ borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted, borderRadius: 20, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign, fontSize: 14 }}>{t('settings.exportCsv')}</Text>
        <Text style={{ color: theme.colors.textMuted, fontWeight: '700', textAlign, lineHeight: 18, fontSize: 11, marginTop: 6 }}>{t('settings.exportDescription')}</Text>
      </View>
      <Button title={t('settings.exportCsv')} icon="share-2" variant="secondary" onPress={async () => { await exportTradesCsv(); showToast({ title: t('settings.exportReady'), tone: 'success' }); }} />
      <View style={{ height: 10 }} />
      <View style={{ borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted, borderRadius: 20, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign, fontSize: 14 }}>{t('settings.backupJson')}</Text>
        <Text style={{ color: theme.colors.textMuted, fontWeight: '700', textAlign, lineHeight: 18, fontSize: 11, marginTop: 6 }}>{t('settings.backupDescription')}</Text>
      </View>
      <ResponsiveRow breakpoint={520} gap={10}>
        <View style={{ flex: 1 }}><Button title={t('settings.backup')} icon="download" variant="secondary" onPress={async () => {
          try {
            await exportBackupJson();
            showToast({ title: t('settings.backupReady'), message: t('settings.backupReadyHint'), tone: 'success' });
          } catch {
            showToast({ title: t('common.checkFields'), message: t('settings.backupFailed'), tone: 'danger' });
          }
        }} /></View>
        <View style={{ flex: 1 }}><Button title={t('settings.restoreLatest')} icon="upload" variant="secondary" onPress={() => confirm({
          title: t('settings.restoreLatest'),
          message: t('settings.restoreWarning'),
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
          destructive: true,
          onConfirm: async () => {
            try {
              const file = await restoreBackupJson();
              if (!file) {
                showToast({ title: t('common.noData'), message: t('settings.noBackupFound'), tone: 'warning' });
                return;
              }
              refresh();
              showToast({ title: t('settings.restoreComplete'), tone: 'success' });
            } catch {
              showToast({ title: t('common.checkFields'), message: t('settings.restoreFailed'), tone: 'danger' });
            }
          },
        })} /></View>
      </ResponsiveRow>
    </CollapsibleCard>

    <Card>
      <SectionHeading title={t('privacy.title')} icon="shield" />
      {renderMutedText(t('privacy.settingsHint'))}
      <Button
        title={t('privacy.open')}
        icon="lock"
        variant="secondary"
        onPress={() => navigation.navigate('Privacy')}
      />
    </Card>

    <CollapsibleCard title={t('settings.dangerZone')} subtitle={t('settings.dangerHint')} icon="alert-triangle" defaultOpen={false}>
      <View style={{ borderWidth: 1, borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft, borderRadius: 20, padding: 14, marginBottom: 12 }}>
        <Text style={{ color: theme.colors.danger, fontWeight: '900', textAlign, fontSize: 14 }}>{t('settings.deleteAll')}</Text>
        <Text style={{ color: theme.colors.textMuted, fontWeight: '700', textAlign, lineHeight: 18, fontSize: 11, marginTop: 6 }}>{t('settings.deleteWarning')}</Text>
      </View>
      <Button title={t('settings.deleteAll')} icon="trash-2" variant="danger" onPress={erase} />
    </CollapsibleCard>

    <Modal transparent visible={Boolean(importPreview)} animationType="fade" onRequestClose={() => !importingTrades && setImportPreview(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: theme.colors.overlay }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ position: 'relative', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 28, padding: 18, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
            <ModalCloseButton disabled={importingTrades} onPress={() => setImportPreview(null)} style={{ position: 'absolute', top: 14, left: isRTL ? 14 : undefined, right: isRTL ? undefined : 14 }} />
            <View style={{ marginBottom: 14, paddingLeft: isRTL ? 44 : 0, paddingRight: isRTL ? 0 : 44 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: theme.colors.primaryGlow, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, textAlign }}>MetaTrader Import</Text>
                <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: '900', textAlign, marginTop: 3 }}>{isRTL ? 'پیش‌نمایش معاملات' : 'Trade preview'}</Text>
                <Text numberOfLines={2} style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '700', textAlign, marginTop: 5 }}>{importPreview?.fileName}</Text>
              </View>
            </View>

            <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9, marginBottom: 14 }}>
              <MiniKpi label={isRTL ? 'پلتفرم' : 'Platform'} value={importPreview?.platform ?? '—'} tone="info" />
              <MiniKpi label={isRTL ? 'فرمت' : 'Format'} value={(importPreview?.format ?? '—').toUpperCase()} />
              <MiniKpi label={isRTL ? 'معاملات' : 'Trades'} value={String(importPreview?.trades.length ?? 0)} tone="success" />
              <MiniKpi label={isRTL ? 'ردشده' : 'Rejected'} value={String(importPreview?.rejectedRows ?? 0)} tone={(importPreview?.rejectedRows ?? 0) ? 'warning' : 'default'} />
            </View>

            {importPreview?.warnings.length ? <View style={{ borderWidth: 1, borderColor: theme.colors.warning, backgroundColor: theme.colors.warningSoft, borderRadius: 18, padding: 12, marginBottom: 14 }}>
              {importPreview.warnings.map((warning) => <Text key={warning} style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', lineHeight: 18, textAlign }}>• {warning}</Text>)}
            </View> : null}

            <View style={{ gap: 8, maxHeight: 330 }}>
              {(importPreview?.trades ?? []).slice(0, 8).map((trade, index) => (
                <View key={`${trade.source_id ?? index}-${trade.open_time}`} style={{ borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated, borderRadius: 17, padding: 12 }}>
                  <View style={{ flexDirection: rowDirection, justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '900', textAlign }}>{trade.symbol} · {trade.direction}</Text>
                      <Text style={{ color: theme.colors.textSubtle, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign }}>{new Date(trade.open_time).toLocaleString(isRTL ? 'fa-IR' : 'en-US')} · {trade.status}</Text>
                    </View>
                    <Text style={{ color: Number(trade.pnl_net ?? 0) >= 0 ? theme.colors.success : theme.colors.danger, fontSize: 14, fontWeight: '900' }}>{trade.status === 'CLOSED' ? formatNumber(Number(trade.pnl_net ?? 0), 2) : (isRTL ? 'باز' : 'Open')}</Text>
                  </View>
                </View>
              ))}
            </View>
            {(importPreview?.trades.length ?? 0) > 8 ? <Text style={{ color: theme.colors.textSubtle, fontSize: 11, textAlign: 'center', marginTop: 10, fontWeight: '800' }}>{isRTL ? `و ${(importPreview?.trades.length ?? 0) - 8} معامله دیگر…` : `And ${(importPreview?.trades.length ?? 0) - 8} more…`}</Text> : null}

            <ResponsiveRow breakpoint={540} gap={10} style={{ marginTop: 18 }}>
              <View style={{ flex: 1 }}><Button title={t('common.cancel')} variant="secondary" disabled={importingTrades} onPress={() => setImportPreview(null)} /></View>
              <View style={{ flex: 1 }}><Button title={importingTrades ? (isRTL ? 'در حال ورود…' : 'Importing…') : (isRTL ? `ورود ${importPreview?.trades.length ?? 0} معامله` : `Import ${importPreview?.trades.length ?? 0} trades`)} icon="database" disabled={importingTrades} onPress={commitMetaTraderImport} /></View>
            </ResponsiveRow>
          </View>
        </ScrollView>
      </View>
    </Modal>

    <Modal transparent visible={symbolModalOpen} animationType="fade" onRequestClose={closeSymbolModal}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 18, backgroundColor: theme.colors.overlay }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ position: 'relative', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 28, padding: 18, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
            <ModalCloseButton disabled={symbolSaving} onPress={closeSymbolModal} style={{ position: 'absolute', top: 14, left: isRTL ? 14 : undefined, right: isRTL ? undefined : 14 }} />
            <View style={{ marginBottom: 12, paddingLeft: isRTL ? 44 : 0, paddingRight: isRTL ? 0 : 44 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.primaryGlow, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, textAlign }}>{t('settings.symbolMarket')}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 21, fontWeight: '900', textAlign, marginTop: 3 }}>{t('settings.addSymbolTitle')}</Text>
              </View>
            </View>
            <Field label={t('settings.symbolName')} value={newSymbol.symbol} onChangeText={(value) => setNewSymbol((old) => ({ ...old, symbol: value.toUpperCase() }))} placeholder={t('settings.symbolPlaceholder')} autoCapitalize="characters" icon="hash" />
            <Text style={{ color: theme.colors.textMuted, fontWeight: '900', fontSize: 11, marginBottom: 8, textAlign }}>{t('settings.symbolMarket')}</Text>
            <Segmented value={newSymbol.market} onChange={(value) => setNewSymbolMarket(value as Market)} options={[{ value: 'forex', label: t('common.forex') }, { value: 'crypto', label: t('common.crypto') }]} />
            <View style={{ height: 12 }} />
            <Field label={t('settings.pipSize')} value={newSymbol.pipSize} onChangeText={(value) => setNewSymbol((old) => ({ ...old, pipSize: value }))} keyboardType="decimal-pad" placeholder={newSymbol.market === 'forex' ? '0.0001' : '1'} icon="activity" />
            <Field label={t('settings.contractSize')} value={newSymbol.contractSize} onChangeText={(value) => setNewSymbol((old) => ({ ...old, contractSize: value }))} keyboardType="decimal-pad" placeholder={newSymbol.market === 'forex' ? '100000' : '1'} icon="box" />
            <Field label={t('settings.quoteCurrency')} value={newSymbol.quoteCurrency} onChangeText={(value) => setNewSymbol((old) => ({ ...old, quoteCurrency: value.toUpperCase() }))} placeholder={newSymbol.market === 'forex' ? 'USD' : 'USDT'} autoCapitalize="characters" icon="dollar-sign" />
            <ResponsiveRow breakpoint={520} gap={10} style={{ marginTop: 8 }}>
              <View style={{ flex: 1 }}><Button title={t('common.cancel')} variant="secondary" disabled={symbolSaving} onPress={closeSymbolModal} /></View>
              <View style={{ flex: 1 }}><Button title={symbolSaving ? (isRTL ? 'در حال ذخیره…' : 'Saving…') : t('settings.saveSymbol')} icon="save" disabled={symbolSaving} onPress={addSymbol} /></View>
            </ResponsiveRow>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </Screen>;
}
