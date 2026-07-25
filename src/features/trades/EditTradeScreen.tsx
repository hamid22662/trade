import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getTrade, updateTrade } from '@/db/repositories';
import { Direction, Emotion, Market, Trade } from '@/types';
import { useApp } from '@/context/AppContext';
import { useFeedback } from '@/components/feedback';
import { BackButton, Badge, Button, Card, ChipGroup, Field, HeroCard, MiniKpi, ResponsiveRow, Screen, SectionHeading, Segmented, Title } from '@/components/ui';
import { calculateClosedTrade, calculatePositionSize, calculateRr, formatMoney, formatNumber } from '@/services/calculations';
import { getRMultiple, formatRMultiple } from '@/services/tradeMetrics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

const emotions: Emotion[] = ['greed', 'fear', 'neutral', 'confident', 'rushed'];
const toNumber = (value: string) => {
  const number = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
};

export default function EditTradeScreen() {
  const { params } = useRoute<any>();
  const id = Number(params?.id);
  const { t } = useTranslation();
  const { theme, isRTL, currency, refresh } = useApp();
  const { showToast } = useFeedback();
  const { isPhone } = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [market, setMarket] = useState<Market>('forex');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [exit, setExit] = useState('');
  const [lot, setLot] = useState('');
  const [quantity, setQuantity] = useState('');
  const [risk, setRisk] = useState('');
  const [balance, setBalance] = useState('');
  const [strategy, setStrategy] = useState('');
  const [emotionEntry, setEmotionEntry] = useState<Emotion>('neutral');
  const [emotionExit, setEmotionExit] = useState<Emotion>('neutral');
  const [setup, setSetup] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  const [lesson, setLesson] = useState('');
  const [commission, setCommission] = useState('0');
  const [swap, setSwap] = useState('0');
  const [funding, setFunding] = useState('0');
  const [saving, setSaving] = useState(false);

  const hydrate = (item: Trade) => {
    setTrade(item);
    setMarket(item.market);
    setSymbol(item.symbol);
    setDirection(item.direction);
    setEntry(String(item.entry_price ?? ''));
    setSl(item.stop_loss === null || item.stop_loss === undefined ? '' : String(item.stop_loss));
    setTp(item.take_profit === null || item.take_profit === undefined ? '' : String(item.take_profit));
    setExit(item.exit_price === null || item.exit_price === undefined ? '' : String(item.exit_price));
    setLot(item.lot_size === null || item.lot_size === undefined ? '' : String(item.lot_size));
    setQuantity(item.quantity === null || item.quantity === undefined ? '' : String(item.quantity));
    setRisk(item.risk_percent === null || item.risk_percent === undefined ? '' : String(item.risk_percent));
    setBalance(item.account_balance === null || item.account_balance === undefined ? '' : String(item.account_balance));
    setStrategy(item.strategy ?? '');
    setEmotionEntry(item.emotion_entry ?? 'neutral');
    setEmotionExit(item.emotion_exit ?? 'neutral');
    setSetup(item.setup_notes ?? '');
    setExitNotes(item.exit_notes ?? '');
    setLesson(item.lesson_learned ?? '');
    setCommission(String(item.commission ?? 0));
    setSwap(String(item.swap_fee ?? 0));
    setFunding(String(item.funding_fee ?? 0));
  };

  const load = useCallback(() => {
    getTrade(id).then((item) => { if (item) hydrate(item); }).catch(() => showToast({
      title: isRTL ? 'معامله بارگذاری نشد' : 'Trade could not be loaded',
      tone: 'danger',
    }));
  }, [id, isRTL, showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const entryValue = toNumber(entry);
  const slValue = toNumber(sl);
  const tpValue = toNumber(tp);
  const exitValue = toNumber(exit);
  const riskValue = toNumber(risk);
  const balanceValue = toNumber(balance);
  const lotValue = toNumber(lot);
  const quantityValue = toNumber(quantity);
  const commissionValue = toNumber(commission);
  const swapValue = toNumber(swap);
  const fundingValue = toNumber(funding);
  const rr = calculateRr(direction, entryValue, slValue, tpValue);
  const sizing = useMemo(() => calculatePositionSize({
    market,
    balance: balanceValue,
    riskPercent: riskValue,
    entry: entryValue,
    stopLoss: slValue,
    pipSize: trade?.pip_size ?? 0.0001,
    contractSize: trade?.contract_size ?? 1,
    quoteCurrency: trade?.symbol?.slice(-3) ?? currency,
  }), [market, balanceValue, riskValue, entryValue, slValue, trade?.pip_size, trade?.contract_size, trade?.symbol, currency]);
  const preview = useMemo(() => trade && trade.status === 'CLOSED' && exitValue > 0 ? calculateClosedTrade({
    ...trade,
    market,
    symbol,
    direction,
    entry_price: entryValue,
    exit_price: exitValue,
    lot_size: lotValue || null,
    quantity: quantityValue || null,
    commission: commissionValue,
    swap_fee: swapValue,
    funding_fee: fundingValue,
  }) : null, [trade, market, symbol, direction, entryValue, exitValue, lotValue, quantityValue, commissionValue, swapValue, fundingValue]);

  useEffect(() => {
    if (!trade) return;
    if (!risk || !balance) return;
    const suggested = sizing.size;
    if (trade.market === 'forex' && !lot && suggested > 0) setLot(suggested.toFixed(4));
    if (trade.market === 'crypto' && !quantity && suggested > 0) setQuantity(suggested.toFixed(6));
  }, [trade, sizing.size, risk, balance, lot, quantity]);

  if (!trade) return <Screen><BackButton onPress={() => navigation.goBack()} /><Title>{t('trade.details')}</Title></Screen>;

  const isClosed = trade.status === 'CLOSED';
  const textAlign = isRTL ? 'right' : 'left';
  const rowDirection = isRTL ? 'row-reverse' as const : 'row' as const;
  const amount = market === 'forex' ? lotValue : quantityValue;
  const canSave = symbol.trim() && entryValue > 0 && amount > 0 && (!isClosed || exitValue > 0);
  const previewR = preview ? getRMultiple({ pnl_net: preview.netPnl, risk_amount: trade.risk_amount }) : null;

  const save = async () => {
    if (saving) return;
    if (!canSave) {
      showToast({ title: t('common.checkFields'), message: t('trade.validation'), tone: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await updateTrade(id, {
        market,
        symbol: symbol.trim().toUpperCase(),
        direction,
        entry_price: entryValue,
        exit_price: isClosed ? exitValue : null,
        stop_loss: slValue || null,
        take_profit: tpValue || null,
        lot_size: market === 'forex' ? lotValue : null,
        quantity: market === 'crypto' ? quantityValue : null,
        risk_percent: riskValue || null,
        account_balance: balanceValue || null,
        risk_amount: sizing.riskAmount || trade.risk_amount || null,
        open_time: trade.open_time,
        close_time: isClosed ? trade.close_time : null,
        strategy: strategy.trim() || null,
        emotion_entry: emotionEntry,
        emotion_exit: isClosed ? emotionExit : null,
        setup_notes: setup.trim() || null,
        exit_notes: isClosed ? exitNotes.trim() || null : null,
        lesson_learned: lesson.trim() || null,
        commission: commissionValue,
        swap_fee: swapValue,
        funding_fee: fundingValue,
      });
      refresh();
      showToast({ title: t('common.saved'), message: t('trade.updated'), tone: 'success' });
      navigation.goBack();
    } catch (error) {
      showToast({ title: isRTL ? 'ویرایش ذخیره نشد' : 'Changes were not saved', message: error instanceof Error ? error.message : undefined, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return <Screen maxContentWidth={960} bottomActionPlacement="screen" bottomAction={<Button title={saving ? (isRTL ? 'در حال ذخیره…' : 'Saving…') : t('common.save')} icon="save" onPress={save} disabled={!canSave || saving} />}>
    <BackButton onPress={() => navigation.goBack()} />
    <Title eyebrow="Trade Editor" subtitle={isRTL ? 'اطلاعات اشتباه را اصلاح کن؛ محاسبات دوباره انجام می‌شود.' : 'Fix mistakes and let TradeLog recalculate performance.'}>{t('trade.editTrade')}</Title>

    <HeroCard
      eyebrow={trade.status}
      title={symbol || trade.symbol}
      value={preview ? formatMoney(preview.netPnl, currency) : rr === null ? '—' : `1:${formatNumber(rr, 2)}`}
      caption={isClosed && preview ? `${formatRMultiple(previewR)} · ${t('trade.pips')}: ${formatNumber(preview.pips, 1)}` : `${t('trade.riskAmount')}: ${formatMoney(sizing.riskAmount, currency).replace(/^\+/, '')}`}
      tone={preview ? preview.netPnl >= 0 ? 'success' : 'danger' : 'primary'}
      footer={<View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}><MiniKpi label={t('trade.entry')} value={entry || '—'} /><MiniKpi label={t('trade.rr')} value={rr === null ? '—' : `1:${formatNumber(rr, 2)}`} tone="info" /><MiniKpi label={market === 'forex' ? 'Lot' : 'Qty'} value={market === 'forex' ? (lot || '—') : (quantity || '—')} tone="primary" /></View>}
    />

    <Card>
      <SectionHeading title={isRTL ? 'مشخصات اصلی' : 'Core details'} icon="edit-3" />
      <Segmented value={market} onChange={(value) => setMarket(value as Market)} options={[{ value: 'forex', label: t('common.forex') }, { value: 'crypto', label: t('common.crypto') }]} />
      <View style={{ height: 12 }} />
      <Field label={t('trade.symbol')} value={symbol} onChangeText={(value) => setSymbol(value.toUpperCase())} autoCapitalize="characters" icon="hash" />
      <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{t('trade.direction')}</Text>
      <Segmented value={direction} onChange={(value) => setDirection(value as Direction)} options={[{ value: 'BUY', label: t('common.buy') }, { value: 'SELL', label: t('common.sell') }]} />
    </Card>

    <Card>
      <SectionHeading title={t('trade.priceLevels')} icon="crosshair" />
      <Field label={t('trade.entry')} value={entry} onChangeText={setEntry} keyboardType="decimal-pad" icon="log-in" />
      <Field label={t('trade.stopLoss')} value={sl} onChangeText={setSl} keyboardType="decimal-pad" icon="shield-off" />
      <Field label={t('trade.takeProfit')} value={tp} onChangeText={setTp} keyboardType="decimal-pad" icon="target" />
      {isClosed ? <Field label={t('trade.exit')} value={exit} onChangeText={setExit} keyboardType="decimal-pad" icon="log-out" /> : null}
    </Card>

    <Card>
      <SectionHeading title={t('trade.riskSizing')} icon="shield" />
      <ResponsiveRow breakpoint={560} gap={10}>
        <View style={{ flex: 1 }}><Field label={t('trade.accountBalance')} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" suffix={currency} icon="dollar-sign" /></View>
        <View style={{ flex: isPhone ? 1 : 0.48, minWidth: isPhone ? 0 : 170 }}><Field label={t('trade.riskPercent')} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" suffix="%" icon="percent" /></View>
      </ResponsiveRow>
      <Field label={market === 'forex' ? t('trade.lotSize') : t('trade.quantity')} value={market === 'forex' ? lot : quantity} onChangeText={market === 'forex' ? setLot : setQuantity} keyboardType="decimal-pad" suffix={market === 'forex' ? 'Lot' : 'Qty'} icon="box" />
    </Card>

    {isClosed ? <Card>
      <SectionHeading title={t('trade.closeDetails')} icon="credit-card" />
      <Field label={t('trade.commission')} value={commission} onChangeText={setCommission} keyboardType="decimal-pad" suffix={currency} icon="credit-card" />
      <Field label={t('trade.swap')} value={swap} onChangeText={setSwap} keyboardType="decimal-pad" suffix={currency} icon="repeat" />
      <Field label={t('trade.funding')} value={funding} onChangeText={setFunding} keyboardType="decimal-pad" suffix={currency} icon="trending-up" />
    </Card> : null}

    <Card>
      <SectionHeading title={t('trade.journal')} icon="book-open" />
      <Field label={t('trade.strategy')} value={strategy} onChangeText={setStrategy} icon="target" />
      <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{t('trade.emotionEntry')}</Text>
      <ChipGroup value={emotionEntry} onChange={(value) => setEmotionEntry(value as Emotion)} options={emotions.map((item) => ({ value: item, label: t(`emotions.${item}`) }))} />
      {isClosed ? <><View style={{ height: 14 }} /><Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{t('trade.emotionExit')}</Text><ChipGroup value={emotionExit} onChange={(value) => setEmotionExit(value as Emotion)} options={emotions.map((item) => ({ value: item, label: t(`emotions.${item}`) }))} /></> : null}
      <View style={{ height: 14 }} />
      <Field label={t('trade.setup')} value={setup} onChangeText={setSetup} multiline />
      {isClosed ? <Field label={t('trade.exitNotes')} value={exitNotes} onChangeText={setExitNotes} multiline /> : null}
      <Field label={t('trade.lesson')} value={lesson} onChangeText={setLesson} multiline />
    </Card>

    <ResponsiveRow breakpoint={520} gap={10}>
      <View style={{ flex: 1 }}><Button title={t('common.cancel')} variant="secondary" onPress={() => navigation.goBack()} /></View>
      <View style={{ flex: 1 }}><Button title={saving ? (isRTL ? 'در حال ذخیره…' : 'Saving…') : t('common.save')} icon="save" onPress={save} disabled={!canSave || saving} /></View>
    </ResponsiveRow>
  </Screen>;
}
