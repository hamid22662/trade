import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { createTrade, getChecklist, getSettings, getStrategies, getSymbols, listTrades } from '@/db/repositories';
import { ChecklistItem, Emotion, Market, PositionType, StrategyRow, SymbolRow, Trade } from '@/types';
import { useApp } from '@/context/AppContext';
import { useFeedback } from '@/components/feedback';
import { BackButton, Badge, Button, Card, ChipGroup, CollapsibleCard, Empty, Field, HeroCard, InfoRow, MiniKpi, MetricHero, ModalCloseButton, ResponsiveRow, Screen, SectionHeading, Segmented, Title } from '@/components/ui';
import { calculateMarginRequired, calculatePositionSize, calculatePriceDistancePercent, calculateRr, estimateLiquidationDistancePercent, formatMoney, formatNumber, needsEntryPriceForPipValue } from '@/services/calculations';
import { MAX_TRADE_IMAGES, pickAndPersistChartImage } from '@/services/images';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

const emotions: Emotion[] = ['greed', 'fear', 'neutral', 'confident', 'rushed'];
const DRAFT_KEY_PREFIX = 'tradelog:new_trade_draft:v1';
const LEVERAGE_PRESETS = [2, 3, 5, 10, 20, 50, 100];

type DisplayMode = 'simple' | 'pro';
type SymbolPickerFilter = Market | 'all';

type DraftState = {
  market: Market;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry: string;
  sl: string;
  tp: string;
  lot: string;
  quantity: string;
  risk: string;
  balance: string;
  strategy: string;
  emotion: Emotion;
  setup: string;
  checked: Record<string, number>;
  images: string[];
  updatedAt: string;
  positionType: PositionType;
  leverage: string;
};

const toInputNumber = (value: string) => {
  const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasMeaningfulDraft = (draft: Partial<DraftState>) => Boolean(
  draft.entry ||
  draft.sl ||
  draft.tp ||
  draft.lot ||
  draft.quantity ||
  draft.strategy ||
  draft.setup ||
  (draft.images?.length ?? 0) > 0 ||
  Object.values(draft.checked ?? {}).some((value) => value === 1),
);

const formatDraftDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

export default function NewTradeScreen() {
  const { t } = useTranslation();
  const { theme, isRTL, accountBalance, defaultRisk, currency, refresh, refreshKey } = useApp();
  const draftKey = `${DRAFT_KEY_PREFIX}:local`;
  const { showToast, confirm } = useFeedback();
  const { isPhone, isDesktop } = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const clonedTradeRef = useRef<number | null>(null);
  const skipNextSizeResetRef = useRef(false);
  const draftReadyRef = useRef(false);
  const [market, setMarket] = useState<Market>('forex');
  const [allSymbols, setAllSymbols] = useState<SymbolRow[]>([]);
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [recentSymbolNames, setRecentSymbolNames] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('EURUSD');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [lot, setLot] = useState('');
  const [quantity, setQuantity] = useState('');
  const [positionType, setPositionType] = useState<PositionType>('spot');
  const [leverage, setLeverage] = useState('10');
  const [risk, setRisk] = useState(String(defaultRisk));
  const [balance, setBalance] = useState(String(accountBalance));
  const [strategy, setStrategy] = useState('');
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [setup, setSetup] = useState('');
  const [checked, setChecked] = useState<Record<string, number>>({});
  const [images, setImages] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('simple');
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [symbolPickerFilter, setSymbolPickerFilter] = useState<SymbolPickerFilter>('all');
  const [symbolPickerQuery, setSymbolPickerQuery] = useState('');
  const [draftCandidate, setDraftCandidate] = useState<DraftState | null>(null);
  const [isCloned, setIsCloned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getSymbols(), getStrategies(), getChecklist(), getSettings(), listTrades({ limit: 20 })]).then(([loadedSymbols, loadedStrategies, loadedChecklist, settings, recentTrades]) => {
      setAllSymbols(loadedSymbols);
      setStrategies(loadedStrategies);
      setChecklistItems(loadedChecklist);
      setDisplayMode(settings.experience_mode === 'pro' ? 'pro' : 'simple');
      const names = Array.from(new Set(recentTrades.map((trade) => trade.symbol))).slice(0, 8);
      setRecentSymbolNames(names);
      const currentSymbolStillExists = loadedSymbols.some((item) => item.symbol === symbol && item.market === market);
      const firstForMarket = loadedSymbols.find((item) => item.market === market);
      if (!currentSymbolStillExists && firstForMarket) setSymbol(firstForMarket.symbol);
    }).catch(() => showToast({
      title: isRTL ? 'اطلاعات ثبت ترید بارگذاری نشد' : 'Trade form data could not be loaded',
      message: isRTL ? 'فضای ذخیره‌سازی محلی در دسترس نیست؛ اپ را ببند و دوباره باز کن.' : 'Local storage is unavailable. Restart the app and reopen this page.',
      tone: 'danger',
    }));
  }, [market, refreshKey]);

  useEffect(() => {
    setRisk(String(defaultRisk));
    setBalance(String(accountBalance));
  }, [accountBalance, defaultRisk]);

  useEffect(() => {
    if (skipNextSizeResetRef.current) {
      skipNextSizeResetRef.current = false;
      return;
    }
    setLot('');
    setQuantity('');
  }, [market, symbol]);

  useEffect(() => {
    if (market !== 'crypto') setPositionType('spot');
  }, [market]);

  useEffect(() => {
    const cloneTrade = route.params?.cloneTrade as Partial<Trade> | undefined;
    if (!cloneTrade?.id || clonedTradeRef.current === cloneTrade.id) return;
    clonedTradeRef.current = cloneTrade.id;
    skipNextSizeResetRef.current = true;
    setIsCloned(true);
    setMarket(cloneTrade.market ?? 'forex');
    setSymbol(cloneTrade.symbol ?? 'EURUSD');
    setDirection(cloneTrade.direction ?? 'BUY');
    setEntry(cloneTrade.entry_price ? String(cloneTrade.entry_price) : '');
    setSl(cloneTrade.stop_loss ? String(cloneTrade.stop_loss) : '');
    setTp(cloneTrade.take_profit ? String(cloneTrade.take_profit) : '');
    setLot(cloneTrade.lot_size ? String(cloneTrade.lot_size) : '');
    setQuantity(cloneTrade.quantity ? String(cloneTrade.quantity) : '');
    setPositionType(cloneTrade.position_type ?? 'spot');
    setLeverage(cloneTrade.leverage ? String(cloneTrade.leverage) : '10');
    setRisk(cloneTrade.risk_percent ? String(cloneTrade.risk_percent) : String(defaultRisk));
    setBalance(cloneTrade.account_balance ? String(cloneTrade.account_balance) : String(accountBalance));
    setStrategy(cloneTrade.strategy ?? '');
    setEmotion(cloneTrade.emotion_entry ?? 'neutral');
    setSetup(cloneTrade.setup_notes ?? '');
    setChecked({});
    setImages([]);
    setDraftCandidate(null);
  }, [route.params?.cloneTrade, defaultRisk, accountBalance]);

  useEffect(() => {
    draftReadyRef.current = false;
    AsyncStorage.getItem(draftKey).then((raw) => {
      if (raw && !route.params?.cloneTrade) {
        const parsed = JSON.parse(raw) as DraftState;
        if (hasMeaningfulDraft(parsed)) setDraftCandidate(parsed);
      }
    }).catch(() => undefined).finally(() => {
      draftReadyRef.current = true;
    });
  }, [route.params?.cloneTrade, draftKey]);

  const symbols = useMemo(() => allSymbols.filter((item) => item.market === market), [allSymbols, market]);
  const selectedSymbol = allSymbols.find((item) => item.symbol === symbol && item.market === market) ?? symbols[0];
  const entryValue = toInputNumber(entry);
  const slValue = toInputNumber(sl);
  const tpValue = toInputNumber(tp);
  const riskValue = toInputNumber(risk);
  const balanceValue = toInputNumber(balance);
  const manualAmount = market === 'forex' ? toInputNumber(lot) : toInputNumber(quantity);
  const leverageValue = toInputNumber(leverage);
  const isLeveraged = market === 'crypto' && positionType === 'futures';
  const rr = calculateRr(direction, entryValue, slValue, tpValue);
  const sizing = useMemo(() => calculatePositionSize({
    market,
    balance: balanceValue,
    riskPercent: riskValue,
    entry: entryValue,
    stopLoss: slValue,
    pipSize: selectedSymbol?.pip_size ?? 0.0001,
    contractSize: selectedSymbol?.contract_size,
    quoteCurrency: selectedSymbol?.quote_currency,
  }), [market, balanceValue, riskValue, entryValue, slValue, selectedSymbol?.pip_size, selectedSymbol?.contract_size, selectedSymbol?.quote_currency]);

  const requiresEntryForPipValue = market === 'forex' && needsEntryPriceForPipValue(selectedSymbol?.quote_currency);
  const hasPipValue = market !== 'forex' || sizing.pipValue > 0;
  const suggestedAmount = sizing.size;
  const amountForSave = manualAmount > 0 ? manualAmount : suggestedAmount;
  const slDistance = market === 'crypto'
    ? calculatePriceDistancePercent(entryValue, slValue)
    : (selectedSymbol?.pip_size ? Math.abs(entryValue - slValue) / selectedSymbol.pip_size : 0);
  const tpDistance = market === 'crypto'
    ? calculatePriceDistancePercent(entryValue, tpValue)
    : (selectedSymbol?.pip_size ? Math.abs(tpValue - entryValue) / selectedSymbol.pip_size : 0);
  const marginRequired = isLeveraged ? calculateMarginRequired(amountForSave, entryValue, leverageValue) : 0;
  const liquidationDistance = isLeveraged ? estimateLiquidationDistancePercent(leverageValue) : 0;
  const rewardAmount = rr && rr > 0 ? sizing.riskAmount * rr : 0;
  const checklistDone = Object.values(checked).filter((value) => value === 1).length;
  const rrTone = rr === null ? 'default' : rr >= 1.5 ? 'success' : rr < 1 ? 'danger' : 'warning';
  const isPro = displayMode === 'pro';
  const textAlign = isRTL ? 'right' : 'left';
  const rowDirection = isRTL ? 'row-reverse' as const : 'row' as const;

  const levelErrors = useMemo(() => {
    const errors: Partial<Record<'entry' | 'sl' | 'tp' | 'risk' | 'balance' | 'amount' | 'leverage', string>> = {};
    if (entry && entryValue <= 0) errors.entry = isRTL ? 'قیمت ورود باید بیشتر از صفر باشد.' : 'Entry must be greater than zero.';
    if (sl && entryValue > 0) {
      const badSl = direction === 'BUY' ? slValue >= entryValue : slValue <= entryValue;
      if (!slValue || badSl) errors.sl = direction === 'BUY'
        ? (isRTL ? 'برای خرید، حد ضرر باید پایین‌تر از ورود باشد.' : 'For a buy trade, SL must be below entry.')
        : (isRTL ? 'برای فروش، حد ضرر باید بالاتر از ورود باشد.' : 'For a sell trade, SL must be above entry.');
    }
    if (tp && entryValue > 0) {
      const badTp = direction === 'BUY' ? tpValue <= entryValue : tpValue >= entryValue;
      if (!tpValue || badTp) errors.tp = direction === 'BUY'
        ? (isRTL ? 'برای خرید، حد سود باید بالاتر از ورود باشد.' : 'For a buy trade, TP must be above entry.')
        : (isRTL ? 'برای فروش، حد سود باید پایین‌تر از ورود باشد.' : 'For a sell trade, TP must be below entry.');
    }
    if (risk && riskValue <= 0) errors.risk = isRTL ? 'ریسک باید بیشتر از صفر باشد.' : 'Risk must be greater than zero.';
    if (balance && balanceValue <= 0) errors.balance = isRTL ? 'موجودی باید بیشتر از صفر باشد.' : 'Balance must be greater than zero.';
    if (isPro && (market === 'forex' ? lot : quantity) && manualAmount <= 0) errors.amount = isRTL ? 'حجم باید بیشتر از صفر باشد.' : 'Size must be greater than zero.';
    if (isLeveraged && leverageValue <= 1) errors.leverage = isRTL ? 'لورج باید بیشتر از ۱ باشد.' : 'Leverage must be greater than 1.';
    return errors;
  }, [entry, entryValue, sl, slValue, tp, tpValue, risk, riskValue, balance, balanceValue, direction, isRTL, isPro, market, lot, quantity, manualAmount, isLeveraged, leverageValue]);

  const previewWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!selectedSymbol) warnings.push(isRTL ? 'اول یک نماد فعال انتخاب کن.' : 'Select an active symbol first.');
    if (!entryValue) warnings.push(isRTL ? 'قیمت ورود را وارد کن.' : 'Enter the entry price.');
    if (!slValue) warnings.push(isRTL ? 'حد ضرر را وارد کن تا حجم پیشنهادی محاسبه شود.' : 'Enter the stop loss to calculate size.');
    if (levelErrors.sl) warnings.push(levelErrors.sl);
    if (levelErrors.tp) warnings.push(levelErrors.tp);
    if (market === 'forex' && !hasPipValue) warnings.push(requiresEntryForPipValue ? t('trade.pipValueNeedsEntry') : t('trade.pipValueUnavailable'));
    return warnings;
  }, [selectedSymbol, entryValue, slValue, levelErrors.sl, levelErrors.tp, market, hasPipValue, requiresEntryForPipValue, t, isRTL]);

  const canSave = Boolean(selectedSymbol && entryValue > 0 && amountForSave > 0 && !levelErrors.entry && !levelErrors.sl && !levelErrors.tp && !levelErrors.risk && !levelErrors.balance && !levelErrors.leverage && (market !== 'forex' || hasPipValue));
  const saveButtonTitle = saving
    ? (isRTL ? 'در حال ثبت…' : 'Saving…')
    : !canSave
    ? (isRTL ? 'تکمیل اطلاعات ضروری' : 'Complete required fields')
    : isCloned
      ? (isRTL ? 'ثبت ترید کپی‌شده' : 'Save copied trade')
      : t('trade.saveOpen');

  useEffect(() => {
    if (!draftReadyRef.current || draftCandidate || isCloned) return;
    const draft: DraftState = { market, symbol, direction, entry, sl, tp, lot, quantity, risk, balance, strategy, emotion, setup, checked, images, updatedAt: new Date().toISOString(), positionType, leverage };
    const task = hasMeaningfulDraft(draft)
      ? AsyncStorage.setItem(draftKey, JSON.stringify(draft))
      : AsyncStorage.removeItem(draftKey);
    task.catch(() => undefined);
  }, [market, symbol, direction, entry, sl, tp, lot, quantity, risk, balance, strategy, emotion, setup, checked, images, draftCandidate, isCloned, draftKey, positionType, leverage]);

  const optionLabel = (item: ChecklistItem) => isRTL ? item.label_fa : item.label_en;

  const selectSymbol = (item: SymbolRow) => {
    skipNextSizeResetRef.current = true;
    setMarket(item.market);
    setSymbol(item.symbol);
    setSymbolPickerOpen(false);
    setSymbolPickerQuery('');
  };

  const restoreDraft = () => {
    const draft = draftCandidate;
    if (!draft) return;
    skipNextSizeResetRef.current = true;
    setMarket(draft.market);
    setSymbol(draft.symbol);
    setDirection(draft.direction);
    setEntry(draft.entry);
    setSl(draft.sl);
    setTp(draft.tp);
    setLot(draft.lot);
    setQuantity(draft.quantity);
    setPositionType(draft.positionType ?? 'spot');
    setLeverage(draft.leverage ?? '10');
    setRisk(draft.risk);
    setBalance(draft.balance);
    setStrategy(draft.strategy);
    setEmotion(draft.emotion);
    setSetup(draft.setup);
    setChecked(draft.checked);
    setImages(draft.images);
    setDraftCandidate(null);
  };

  const discardDraft = async () => {
    await AsyncStorage.removeItem(draftKey);
    setDraftCandidate(null);
  };

  const resetAfterSave = async () => {
    setEntry('');
    setSl('');
    setTp('');
    setLot('');
    setQuantity('');
    setPositionType('spot');
    setLeverage('10');
    setSetup('');
    setChecked({});
    setImages([]);
    setIsCloned(false);
    await AsyncStorage.removeItem(draftKey);
  };

  const pickImage = async () => {
    if (images.length >= MAX_TRADE_IMAGES) {
      showToast({ title: isRTL ? 'حداکثر ۴ تصویر' : 'Maximum 4 images', message: isRTL ? 'برای هر معامله حداکثر چهار تصویر فشرده نگهداری می‌شود.' : 'Each trade can keep up to four compressed images.', tone: 'warning' });
      return;
    }
    const uri = await pickAndPersistChartImage();
    if (uri) setImages((old) => [...old, uri]);
  };

  const save = async () => {
    if (saving) return;
    if (!selectedSymbol || entryValue <= 0 || amountForSave <= 0) {
      showToast({ title: t('common.checkFields'), message: t('trade.validation'), tone: 'warning' });
      return;
    }
    if (market === 'forex' && !hasPipValue) {
      showToast({ title: t('common.checkFields'), message: t('trade.pipValueNeedsEntry'), tone: 'warning' });
      return;
    }
    if (levelErrors.entry || levelErrors.sl || levelErrors.tp || levelErrors.risk || levelErrors.balance || levelErrors.amount || levelErrors.leverage) {
      showToast({ title: t('common.checkFields'), message: t('trade.invalidLevels'), tone: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const slForSave = sl ? slValue : undefined;
      const tpForSave = tp ? tpValue : undefined;
      const tradeId = await createTrade({
        market,
        symbol,
        direction,
        entry_price: entryValue,
        stop_loss: slForSave,
        take_profit: tpForSave,
        lot_size: market === 'forex' ? amountForSave : undefined,
        quantity: market === 'crypto' ? amountForSave : undefined,
        risk_percent: riskValue,
        account_balance: balanceValue,
        risk_amount: sizing.riskAmount,
        pip_size: selectedSymbol.pip_size,
        contract_size: selectedSymbol.contract_size,
        pip_value_at_entry: market === 'forex' ? sizing.pipValue : undefined,
        position_type: market === 'crypto' ? positionType : null,
        leverage: isLeveraged ? leverageValue : null,
        open_time: new Date().toISOString(),
        strategy: strategy || undefined,
        emotion_entry: isPro ? emotion : 'neutral',
        setup_notes: isPro ? (setup || undefined) : undefined,
        checklist: isPro ? checked : {},
        images: isPro ? images.map((uri) => ({ uri, type: 'entry' as const })) : [],
      });
      refresh();
      await resetAfterSave();
      showToast({ title: t('common.saved'), message: t('trade.openSaved'), tone: 'success' });
      confirm({
        title: isRTL ? 'ترید ثبت شد' : 'Trade saved',
        message: isRTL ? 'می‌خواهی گزارش همین ترید را ببینی یا ترید بعدی را ثبت کنی؟' : 'View this trade report, or keep logging the next trade.',
        confirmLabel: isRTL ? 'مشاهده ترید' : 'View trade',
        cancelLabel: isRTL ? 'ثبت بعدی' : 'New next',
        onConfirm: () => navigation.navigate('TradeDetail', { id: tradeId }),
      });
    } catch (error) {
      showToast({
        title: isRTL ? 'ثبت ترید انجام نشد' : 'Trade was not saved',
        message: error instanceof Error ? error.message : (isRTL ? 'دوباره تلاش کن.' : 'Try again.'),
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const pickerSymbols = useMemo(() => {
    const query = symbolPickerQuery.trim().toUpperCase();
    return allSymbols.filter((item) => {
      const marketMatches = symbolPickerFilter === 'all' || item.market === symbolPickerFilter;
      const queryMatches = !query || item.symbol.includes(query) || item.quote_currency?.toUpperCase().includes(query);
      return marketMatches && queryMatches;
    });
  }, [allSymbols, symbolPickerFilter, symbolPickerQuery]);

  const recentSymbols = useMemo(() => recentSymbolNames
    .map((name) => allSymbols.find((item) => item.symbol === name))
    .filter((item): item is SymbolRow => Boolean(item))
    .filter((item, index, array) => array.findIndex((symbolItem) => symbolItem.symbol === item.symbol) === index)
    .slice(0, 6), [recentSymbolNames, allSymbols]);

  const renderSymbolRow = (item: SymbolRow) => (
    <Pressable
      key={`${item.market}-${item.symbol}`}
      onPress={() => selectSymbol(item)}
      style={({ pressed }) => [{
        opacity: pressed ? 0.75 : 1,
        padding: 14,
        borderRadius: 18,
        backgroundColor: item.symbol === symbol && item.market === market ? theme.colors.primarySoft : theme.colors.backgroundElevated,
        borderWidth: 1,
        borderColor: item.symbol === symbol && item.market === market ? theme.colors.primaryGlow : theme.colors.border,
      }]}
    >
      <View style={{ flexDirection: rowDirection, gap: 10, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '900', textAlign }}>{item.symbol}</Text>
          <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', marginTop: 5, textAlign }}>
            {item.market.toUpperCase()} · {t('trade.pipPoint')}: {formatNumber(item.pip_size, item.market === 'forex' ? 5 : 2)} · {item.quote_currency || currency}
          </Text>
        </View>
        <Badge label={item.market === 'forex' ? t('common.forex') : t('common.crypto')} tone={item.market === 'forex' ? 'info' : 'warning'} />
      </View>
    </Pressable>
  );

  const symbolModal = (
    <Modal visible={symbolPickerOpen} transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={() => setSymbolPickerOpen(false)}>
      <View style={{ flex: 1, justifyContent: isDesktop ? 'center' : 'flex-end', padding: isDesktop ? 20 : 0, backgroundColor: theme.colors.overlay }}>
        <View style={{ position: 'relative', maxHeight: isDesktop ? '82%' : '90%', width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: theme.colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomLeftRadius: isDesktop ? 30 : 0, borderBottomRightRadius: isDesktop ? 30 : 0, borderWidth: 1, borderColor: theme.colors.border, padding: isPhone ? 14 : 18, paddingBottom: isPhone ? 20 : 24 }}>
          <ModalCloseButton onPress={() => setSymbolPickerOpen(false)} style={{ position: 'absolute', top: isPhone ? 14 : 16, left: isRTL ? (isPhone ? 14 : 16) : undefined, right: isRTL ? undefined : (isPhone ? 14 : 16) }} />
          <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 }} />
          <View style={{ marginBottom: 12, paddingLeft: isRTL ? 42 : 0, paddingRight: isRTL ? 0 : 42 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '900', textAlign }}>{isRTL ? 'انتخاب نماد' : 'Select symbol'}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 5, textAlign }}>{isRTL ? 'نمادهای فعال و اخیراً استفاده‌شده' : 'Active and recently used symbols'}</Text>
            </View>
          </View>
          <Field label={t('settings.symbolSearch')} value={symbolPickerQuery} onChangeText={setSymbolPickerQuery} placeholder={t('settings.symbolSearchPlaceholder')} icon="search" />
          <Segmented value={symbolPickerFilter} onChange={(value) => setSymbolPickerFilter(value as SymbolPickerFilter)} options={[{ value: 'all', label: t('common.all') }, { value: 'forex', label: t('common.forex') }, { value: 'crypto', label: t('common.crypto') }]} />
          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
            {recentSymbols.length && !symbolPickerQuery ? (
              <View style={{ gap: 10 }}>
                <SectionHeading title={isRTL ? 'اخیراً استفاده‌شده' : 'Recently used'} icon="clock" />
                <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 8 }}>
                  {recentSymbols.map((item) => <Badge key={`${item.market}-${item.symbol}`} label={item.symbol} tone={item.symbol === symbol ? 'primary' : 'default'} onPress={() => selectSymbol(item)} />)}
                </View>
              </View>
            ) : null}
            <SectionHeading title={isRTL ? 'همه نمادها' : 'All symbols'} icon="layers" meta={`${pickerSymbols.length}`} />
            {pickerSymbols.length ? pickerSymbols.map(renderSymbolRow) : <Empty icon="search" title={t('settings.noSymbolsFound')} text={t('settings.noSymbolsFoundHint')} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Dashboard');
  };

  return <Screen maxContentWidth={960} bottomAction={<Button title={saveButtonTitle} icon={canSave ? 'check' : 'alert-circle'} onPress={save} disabled={saving || (!canSave && Boolean(entry || sl || tp))} />}>
    <BackButton onPress={goBack} />
    <Title eyebrow="Trade Entry Assistant" subtitle={isRTL ? 'نماد، سطوح قیمت و ریسک را سریع و بدون خطا ثبت کن.' : 'Log symbol, levels, and risk with fewer mistakes.'}>{t('trade.new')}</Title>

    {draftCandidate ? (
      <Card compact style={{ borderColor: theme.colors.warning, borderWidth: 1.5 }}>
        <SectionHeading title={isRTL ? 'پیش‌نویس ثبت‌نشده داری' : 'Unsaved draft found'} icon="file-text" />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: '800', lineHeight: 19, textAlign }}>
          {isRTL ? `آخرین تغییر: ${formatDraftDate(draftCandidate.updatedAt)}` : `Last update: ${formatDraftDate(draftCandidate.updatedAt)}`}
        </Text>
        <ResponsiveRow breakpoint={440} gap={10} style={{ marginTop: 12 }}>
          <View style={{ flex: 1 }}><Button title={isRTL ? 'ادامه' : 'Continue'} icon="play" onPress={restoreDraft} /></View>
          <View style={{ flex: 1 }}><Button title={isRTL ? 'حذف' : 'Discard'} icon="trash-2" variant="secondary" onPress={discardDraft} /></View>
        </ResponsiveRow>
      </Card>
    ) : null}

    <HeroCard
      eyebrow={t('trade.livePreview')}
      title={symbol}
      value={rr === null ? '—' : `1:${formatNumber(rr, 2)}`}
      caption={previewWarnings[0] ?? (isRTL ? 'ستاپ از نظر سطوح قیمت قابل ثبت است.' : 'Price levels look ready to save.')}
      tone={previewWarnings.length ? 'warning' : rrTone}
      footer={(
        <View style={{ gap: 9 }}>
          <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
            <MiniKpi label={isRTL ? 'ریسک' : 'Risk'} value={formatMoney(sizing.riskAmount, currency).replace(/^\+/, '')} tone="warning" />
            <MiniKpi label={isRTL ? 'ریوارد' : 'Reward'} value={rewardAmount ? formatMoney(rewardAmount, currency).replace(/^\+/, '') : '—'} tone={rewardAmount ? 'success' : 'default'} />
            <MiniKpi label={market === 'forex' ? 'Lot' : 'Qty'} value={suggestedAmount ? formatNumber(suggestedAmount, 4) : '—'} tone="info" />
          </View>
          {previewWarnings.slice(1, 3).map((item) => <Text key={item} style={{ color: theme.colors.warning, fontSize: 11, fontWeight: '800', lineHeight: 17, textAlign }}>{item}</Text>)}
        </View>
      )}
    />

    <Card>
      <SectionHeading title={isRTL ? '۱. بازار و نماد' : '1. Market and symbol'} icon="layers" />
      <Segmented value={market} onChange={(value) => setMarket(value as Market)} options={[{ value: 'forex', label: t('common.forex') }, { value: 'crypto', label: t('common.crypto') }]} />
      <Pressable onPress={() => { setSymbolPickerFilter(market); setSymbolPickerOpen(true); }} style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1, marginTop: 14, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated }]}>
        <View style={{ flexDirection: rowDirection, gap: 12, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', textAlign }}>{t('trade.symbol')}</Text>
            <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '900', marginTop: 5, textAlign }}>{symbol}</Text>
            <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', marginTop: 6, textAlign }}>
              {selectedSymbol ? `${selectedSymbol.market.toUpperCase()} · ${t('trade.pipPoint')} ${selectedSymbol.pip_size} · ${selectedSymbol.quote_currency || currency}` : (isRTL ? 'نمادی انتخاب نشده' : 'No symbol selected')}
            </Text>
          </View>
          <Badge label={isRTL ? 'تغییر' : 'Change'} tone="primary" icon="chevron-down" />
        </View>
      </Pressable>
      {selectedSymbol ? (
        <View style={{ marginTop: 12, gap: 0, padding: 12, borderRadius: 18, backgroundColor: theme.colors.surfaceMuted }}>
          <InfoRow label={isRTL ? 'نوع بازار' : 'Market type'} value={selectedSymbol.market.toUpperCase()} tone="info" />
          <InfoRow label={t('trade.pipPoint')} value={formatNumber(selectedSymbol.pip_size, selectedSymbol.market === 'forex' ? 5 : 2)} />
          <InfoRow label={isRTL ? 'حجم قرارداد' : 'Contract size'} value={formatNumber(selectedSymbol.contract_size, 0)} />
          <InfoRow label={isRTL ? 'ارز مظنه' : 'Quote currency'} value={selectedSymbol.quote_currency || currency} />
        </View>
      ) : null}
      <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginTop: 16, marginBottom: 8, textAlign }}>{t('trade.direction')}</Text>
      <Segmented value={direction} onChange={(value) => setDirection(value as 'BUY' | 'SELL')} options={[{ value: 'BUY', label: t('common.buy') }, { value: 'SELL', label: t('common.sell') }]} />
      {market === 'crypto' ? (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{t('trade.positionType')}</Text>
          <Segmented value={positionType} onChange={(value) => setPositionType(value as PositionType)} options={[{ value: 'spot', label: t('trade.spot') }, { value: 'futures', label: t('trade.futures') }]} />
          {isLeveraged ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{t('trade.leverage')}</Text>
              <ChipGroup value={leverage} onChange={setLeverage} options={LEVERAGE_PRESETS.map((value) => ({ value: String(value), label: `${value}x` }))} />
              {levelErrors.leverage ? <Text style={{ color: theme.colors.danger, fontSize: 11, fontWeight: '800', marginTop: 6, textAlign }}>{levelErrors.leverage}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>

    <Card>
      <SectionHeading title={t('trade.priceLevels')} icon="crosshair" />
      <Field label={t('trade.entry')} value={entry} onChangeText={setEntry} keyboardType="decimal-pad" icon="log-in" error={levelErrors.entry} />
      <Field label={t('trade.stopLoss')} value={sl} onChangeText={setSl} keyboardType="decimal-pad" icon="shield-off" error={levelErrors.sl} />
      <Field label={t('trade.takeProfit')} value={tp} onChangeText={setTp} keyboardType="decimal-pad" icon="target" error={levelErrors.tp} />
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
          <MiniKpi label={isRTL ? 'فاصله SL' : 'SL distance'} value={slDistance ? (market === 'forex' ? `${formatNumber(slDistance, 1)} pips` : `${formatNumber(slDistance, 2)}%`) : '—'} tone="danger" />
          <MiniKpi label={isRTL ? 'فاصله TP' : 'TP distance'} value={tpDistance ? (market === 'forex' ? `${formatNumber(tpDistance, 1)} pips` : `${formatNumber(tpDistance, 2)}%`) : '—'} tone="success" />
          <MiniKpi label="R/R" value={rr === null ? '—' : `1:${formatNumber(rr, 2)}`} tone={rrTone} />
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ height: 8, borderRadius: 999, overflow: 'hidden', flexDirection: rowDirection, backgroundColor: theme.colors.surfaceMuted }}>
            <View style={{ flex: 1, backgroundColor: theme.colors.danger }} />
            <View style={{ width: 6, backgroundColor: theme.colors.text }} />
            <View style={{ flex: rr && rr > 0 ? Math.min(3, Math.max(1, rr)) : 1, backgroundColor: theme.colors.success }} />
          </View>
          <View style={{ flexDirection: rowDirection, justifyContent: 'space-between' }}>
            <Text style={{ color: theme.colors.danger, fontSize: 11, fontWeight: '900' }}>SL</Text>
            <Text style={{ color: theme.colors.text, fontSize: 11, fontWeight: '900' }}>Entry</Text>
            <Text style={{ color: theme.colors.success, fontSize: 11, fontWeight: '900' }}>TP</Text>
          </View>
        </View>
      </View>
    </Card>

    <Card>
      <SectionHeading title={t('trade.riskSizing')} icon="shield" />
      {isPro ? (
        <ResponsiveRow breakpoint={560} gap={10}>
          <View style={{ flex: 1 }}><Field label={t('trade.accountBalance')} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" suffix={currency} icon="dollar-sign" error={levelErrors.balance} /></View>
          <View style={{ flex: isPhone ? 1 : 0.48, minWidth: isPhone ? 0 : 170 }}><Field label={t('trade.riskPercent')} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" suffix="%" icon="percent" error={levelErrors.risk} /></View>
        </ResponsiveRow>
      ) : (
        <Field label={t('trade.riskPercent')} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" suffix="%" icon="percent" error={levelErrors.risk} hint={isRTL ? `موجودی مبنا: ${formatMoney(balanceValue, currency).replace(/^\+/, '')}` : `Based on balance: ${formatMoney(balanceValue, currency).replace(/^\+/, '')}`} />
      )}
      <MetricHero
        label={market === 'forex' ? t('calculator.suggestedLot') : t('calculator.suggestedQty')}
        value={suggestedAmount ? formatNumber(suggestedAmount, 4) : '—'}
        caption={`${t('trade.riskAmount')}: ${formatMoney(sizing.riskAmount, currency).replace(/^\+/, '')}`}
        tone="info"
      />
      {isLeveraged ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
            <MiniKpi label={t('trade.marginRequired')} value={marginRequired ? formatMoney(marginRequired, currency).replace(/^\+/, '') : '—'} tone="info" />
          </View>
          {liquidationDistance ? (
            <Text style={{ color: theme.colors.warning, fontSize: 11, fontWeight: '800', lineHeight: 17, textAlign }}>
              {t('trade.liquidationWarning', { leverage: leverageValue, percent: formatNumber(liquidationDistance, 1) })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {isPro ? (
        <View style={{ marginTop: 12 }}>
          <Field
            label={market === 'forex' ? t('trade.lotSize') : t('trade.quantity')}
            value={market === 'forex' ? lot : quantity}
            onChangeText={market === 'forex' ? setLot : setQuantity}
            keyboardType="decimal-pad"
            placeholder={market === 'forex' ? '0.01' : '0.001'}
            hint={market === 'forex' && hasPipValue ? `${t('trade.pipValueAtEntry')}: ${formatNumber(sizing.pipValue, 2)} ${currency}` : undefined}
            error={levelErrors.amount}
            suffix={market === 'forex' ? 'Lot' : 'Qty'}
            icon="layers"
          />
          <Button
            title={isRTL ? '↙ استفاده از این مقدار' : '↙ Use suggested'}
            variant="secondary"
            icon="corner-down-left"
            onPress={() => {
              const suggestedValue = suggestedAmount.toFixed(4);
              if (market === 'forex') setLot(suggestedValue);
              else setQuantity(suggestedValue);
            }}
          />
        </View>
      ) : null}
    </Card>

    <Card>
      <SectionHeading title={isRTL ? 'استراتژی' : 'Strategy'} icon="target" />
      {strategies.length ? <ChipGroup value={strategy} onChange={setStrategy} options={strategies.map((item) => ({ value: item.name, label: item.name }))} /> : <Empty icon="target" title={t('settings.noStrategies')} text={t('settings.noStrategiesHint')} />}
      {isPro ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{t('trade.emotionEntry')}</Text>
          <ChipGroup value={emotion} onChange={(value) => setEmotion(value as Emotion)} options={emotions.map((item) => ({ value: item, label: t(`emotions.${item}`) }))} />
        </View>
      ) : null}
    </Card>

    {isPro ? (
      <CollapsibleCard
        title={t('trade.checklist')}
        subtitle={isRTL ? 'قبل از ثبت، کیفیت ستاپ را سریع کنترل کن.' : 'Quickly verify the quality of this setup.'}
        icon="check-square"
        defaultOpen
        meta={`${checklistDone}/${checklistItems.length}`}
      >
        <View style={{ gap: 9 }}>{checklistItems.map((item) => {
          const isChecked = checked[String(item.id)] === 1;
          return <Button key={item.id} title={`${isChecked ? '✓ ' : ''}${optionLabel(item)}`} icon={isChecked ? 'check-circle' : 'circle'} variant={isChecked ? 'primary' : 'secondary'} onPress={() => setChecked((old) => ({ ...old, [String(item.id)]: isChecked ? 0 : 1 }))} />;
        })}</View>
      </CollapsibleCard>
    ) : null}

    {isPro ? (
      <CollapsibleCard
        title={t('trade.journal')}
        subtitle={isRTL ? 'یادداشت و تصویر اختیاری است، اما تحلیل آینده را بهتر می‌کند.' : 'Notes and chart images are optional, but improve later review.'}
        icon="edit-3"
      >
        <Field label={t('trade.setup')} value={setup} onChangeText={setSetup} multiline />
        <Button title={t('trade.addImage')} icon="image" variant="secondary" onPress={pickImage} />
        {images.length ? <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9, marginTop: 12 }}>{images.map((uri) => <Image key={uri} source={{ uri }} style={{ width: 78, height: 78, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.border }} />)}</View> : null}
      </CollapsibleCard>
    ) : null}
    {symbolModal}
  </Screen>;
}
