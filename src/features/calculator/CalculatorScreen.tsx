import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getSymbols } from '@/db/repositories';
import { useApp } from '@/context/AppContext';
import { Badge, Card, ChipGroup, Field, HeroCard, MiniKpi, ResponsiveRow, Screen, SectionHeading, Segmented, Stat, Title } from '@/components/ui';
import { calculatePositionSize, calculateRr, calculateSlDistance, formatNumber, needsEntryPriceForPipValue } from '@/services/calculations';
import { Direction, Market, SymbolRow } from '@/types';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

const toInputNumber = (value: string) => {
  const number = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
};

export default function CalculatorScreen() {
  const { t } = useTranslation();
  const { theme, isRTL, accountBalance, defaultRisk, currency, refreshKey } = useApp();
  const { isPhone } = useResponsiveLayout();
  const [tab, setTab] = useState<'lot' | 'rr' | 'pip'>('lot');
  const [market, setMarket] = useState<Market>('forex');
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [symbol, setSymbol] = useState('EURUSD');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [balance, setBalance] = useState(String(accountBalance));
  const [risk, setRisk] = useState(String(defaultRisk));
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [lotSize, setLotSize] = useState('1');

  useEffect(() => {
    getSymbols(market).then((rows) => {
      setSymbols(rows);
      if (rows[0] && !rows.some((row) => row.symbol === symbol)) setSymbol(rows[0].symbol);
    }).catch(() => setSymbols([]));
  }, [market, refreshKey]);

  useEffect(() => {
    setBalance(String(accountBalance));
    setRisk(String(defaultRisk));
  }, [accountBalance, defaultRisk]);

  useEffect(() => {
    if (market === 'crypto' && tab === 'pip') setTab('lot');
  }, [market, tab]);

  const selectedSymbol = symbols.find((item) => item.symbol === symbol) ?? symbols[0];
  const pipSize = selectedSymbol?.pip_size ?? 0.0001;
  const contractSize = selectedSymbol?.contract_size ?? 100000;
  const result = useMemo(() => calculatePositionSize({
    market,
    balance: toInputNumber(balance),
    riskPercent: toInputNumber(risk),
    entry: toInputNumber(entry),
    stopLoss: toInputNumber(sl),
    pipSize,
    contractSize,
    quoteCurrency: selectedSymbol?.quote_currency,
  }), [market, balance, risk, entry, sl, pipSize, contractSize, selectedSymbol?.quote_currency]);

  const rr = calculateRr(direction, toInputNumber(entry), toInputNumber(sl), toInputNumber(tp));
  const distance = calculateSlDistance(toInputNumber(entry), toInputNumber(sl), pipSize);
  const reward = calculateSlDistance(toInputNumber(entry), toInputNumber(tp), pipSize);
  const rrValue = rr ?? 0;
  const assessment = rr === null
    ? t('calculator.enterLevels')
    : rrValue < 1 ? t('calculator.weak') : rrValue < 1.5 ? t('calculator.average') : rrValue <= 2 ? t('calculator.good') : t('calculator.excellent');
  const symbolName = selectedSymbol?.symbol ?? '—';
  const pipValueReady = market !== 'forex' || result.pipValue > 0;
  const pipValueHint = needsEntryPriceForPipValue(selectedSymbol?.quote_currency) ? t('trade.pipValueNeedsEntry') : t('trade.pipValueUnavailable');
  const heroTone = tab === 'rr'
    ? rr === null ? 'primary' : rrValue >= 1.5 ? 'success' : rrValue < 1 ? 'danger' : 'warning'
    : tab === 'lot'
      ? pipValueReady ? 'info' : 'warning'
      : pipValueReady ? 'primary' : 'warning';
  const heroValue = tab === 'rr'
    ? rr === null ? '—' : `1:${formatNumber(rr, 2)}`
    : tab === 'lot'
      ? pipValueReady ? formatNumber(result.size, 4) : '—'
      : pipValueReady ? `${currency} ${formatNumber(toInputNumber(lotSize) * result.pipValue, 2)}` : '—';
  const heroTitle = tab === 'rr'
    ? t('trade.rr')
    : tab === 'lot'
      ? market === 'forex' ? t('calculator.suggestedLot') : t('calculator.suggestedQty')
      : t('calculator.pipValue');

  return <Screen maxContentWidth={960}>
    <Title eyebrow="TradeLab" subtitle={isRTL ? 'قبل از ورود، حجم و نسبت ریسک را مثل یک پرو چک کن.' : 'Validate size and reward/risk like a pro before entry.'}>{t('calculator.title')}</Title>
    <Segmented value={tab} onChange={(value) => setTab(value as typeof tab)} options={[{ value: 'lot', label: t('calculator.lot') }, { value: 'rr', label: t('calculator.rr') }, { value: 'pip', label: t('calculator.pip') }]} />

    <HeroCard
      eyebrow={`${symbolName} · ${market.toUpperCase()}`}
      title={heroTitle}
      value={heroValue}
      caption={tab === 'rr' ? assessment : `${t('trade.riskAmount')}: ${currency} ${formatNumber(result.riskAmount, 2)}`}
      tone={heroTone}
      footer={(
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 9 }}>
          <MiniKpi label={t('calculator.slDistance')} value={market === 'forex' ? `${formatNumber(result.distance, 1)} ${t('trade.pips')}` : formatNumber(result.distance, 4)} tone="warning" />
          <MiniKpi label={t('trade.pipPoint')} value={formatNumber(pipSize, 6)} tone="info" />
          <MiniKpi label={t('calculator.pipValue')} value={pipValueReady ? `${formatNumber(result.pipValue, 4)}` : '—'} tone={pipValueReady ? 'primary' : 'warning'} />
        </View>
      )}
    />

    <Card>
      <SectionHeading title={t('trade.market')} icon="sliders" />
      <Segmented value={market} onChange={(value) => setMarket(value as Market)} options={[{ value: 'forex', label: t('common.forex') }, { value: 'crypto', label: t('common.crypto') }]} />
      <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginTop: 16, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>{t('trade.symbol')}</Text>
      <ChipGroup value={symbol} onChange={setSymbol} options={symbols.map((item) => ({ value: item.symbol, label: item.symbol }))} />
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 }}><Badge label={symbolName} tone="info" icon="activity" /><Badge label={market.toUpperCase()} tone="default" /></View>
      {market === 'forex' && !pipValueReady ? <Text style={{ color: theme.colors.warning, fontSize: 12, fontWeight: '800', lineHeight: 19, marginTop: 12, textAlign: isRTL ? 'right' : 'left' }}>{pipValueHint}</Text> : null}
    </Card>

    {tab !== 'pip' ? <Card>
      <SectionHeading title={tab === 'lot' ? t('trade.riskSizing') : t('calculator.rr')} icon={tab === 'lot' ? 'shield' : 'percent'} />
      <Field label={t('trade.entry')} value={entry} onChangeText={setEntry} keyboardType="decimal-pad" icon="log-in" />
      <Field label={t('trade.stopLoss')} value={sl} onChangeText={setSl} keyboardType="decimal-pad" icon="shield-off" />
      {tab === 'rr' ? <>
        <Segmented value={direction} onChange={(value) => setDirection(value as Direction)} options={[{ value: 'BUY', label: t('common.buy') }, { value: 'SELL', label: t('common.sell') }]} />
        <View style={{ height: 12 }} />
        <Field label={t('trade.takeProfit')} value={tp} onChangeText={setTp} keyboardType="decimal-pad" icon="target" />
      </> : <>
        <ResponsiveRow breakpoint={560} gap={10}>
          <View style={{ flex: 1 }}><Field label={t('trade.accountBalance')} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" suffix={currency} icon="dollar-sign" /></View>
          <View style={{ flex: isPhone ? 1 : 0.48, minWidth: isPhone ? 0 : 170 }}><Field label={t('trade.riskPercent')} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" suffix="%" icon="percent" /></View>
        </ResponsiveRow>
      </>}
    </Card> : null}

    {tab === 'lot' ? <Card>
      <SectionHeading title={t('calculator.result')} icon="zap" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        <Stat label={market === 'forex' ? t('calculator.suggestedLot') : t('calculator.suggestedQty')} value={pipValueReady ? formatNumber(result.size, 4) : '—'} tone={pipValueReady ? 'info' : 'warning'} />
        <Stat label={t('trade.riskAmount')} value={`${currency} ${formatNumber(result.riskAmount, 2)}`} tone="warning" />
        <Stat label={t('calculator.slDistance')} value={market === 'forex' ? `${formatNumber(result.distance, 1)} ${t('trade.pips')}` : formatNumber(result.distance, 4)} />
        {market === 'forex' ? <Stat label={t('calculator.pipValue')} value={pipValueReady ? `${currency} ${formatNumber(result.pipValue, 4)}` : '—'} tone={pipValueReady ? 'primary' : 'warning'} /> : null}
      </View>
    </Card> : null}

    {tab === 'rr' ? <Card>
      <SectionHeading title={t('calculator.result')} icon="bar-chart-2" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        <Stat label={t('calculator.risk')} value={`${formatNumber(distance, 1)} ${t('trade.pips')}`} />
        <Stat label={t('calculator.reward')} value={`${formatNumber(reward, 1)} ${t('trade.pips')}`} />
        <Stat label={t('trade.rr')} value={rr === null ? '—' : `1:${formatNumber(rr, 2)}`} tone="info" />
        <Stat label={t('calculator.assessment')} value={assessment} tone={rr === null ? 'default' : rrValue >= 1.5 ? 'success' : rrValue < 1 ? 'danger' : 'warning'} />
      </View>
    </Card> : null}

    {tab === 'pip' ? <Card>
      <SectionHeading title={`${t('calculator.pipValue')} · ${symbolName}`} icon="dollar-sign" />
      <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 19, marginBottom: 12, textAlign: isRTL ? 'right' : 'left', fontWeight: '700' }}>{t('calculator.pipValuePerLotHint')}</Text>
      <Field label={t('trade.lotSize')} value={lotSize} onChangeText={setLotSize} keyboardType="decimal-pad" suffix="Lot" icon="layers" />
      {pipValueReady ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 4 }}>
        <Stat label="1 pip" value={`${currency} ${formatNumber(toInputNumber(lotSize) * result.pipValue, 2)}`} tone="info" />
        <Stat label="10 pips" value={`${currency} ${formatNumber(toInputNumber(lotSize) * result.pipValue * 10, 2)}`} />
        <Stat label="50 pips" value={`${currency} ${formatNumber(toInputNumber(lotSize) * result.pipValue * 50, 2)}`} />
        <Stat label="100 pips" value={`${currency} ${formatNumber(toInputNumber(lotSize) * result.pipValue * 100, 2)}`} />
      </View> : <Text style={{ color: theme.colors.warning, fontWeight: '800', textAlign: isRTL ? 'right' : 'left' }}>{pipValueHint}</Text>}
    </Card> : null}
  </Screen>;
}
