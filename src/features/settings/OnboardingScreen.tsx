import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getManagedSymbols, setSymbolActive } from '@/db/repositories';
import { SymbolRow } from '@/types';
import { useApp } from '@/context/AppContext';
import { Badge, Button, Card, Field, HeroCard, MiniKpi, ResponsiveRow, Screen, Segmented, Title } from '@/components/ui';
import { formatMoney } from '@/services/calculations';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useFeedback } from '@/components/feedback';

const riskPresets = ['0.5', '1', '1.5', '2'];
const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

const parseInputNumber = (value: string) => {
  const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const {
    language,
    setLanguage,
    accountBalance,
    defaultRisk,
    currency,
    saveAccount,
    completeOnboarding,
    theme,
    isRTL,
    experienceMode,
    setExperienceMode,
  } = useApp();
  const [step, setStep] = useState(0);
  const [balance, setBalance] = useState(String(accountBalance || ''));
  const [risk, setRisk] = useState(String(defaultRisk || 1));
  const [baseCurrency, setBaseCurrency] = useState(currency || 'USD');
  const [mode, setMode] = useState<'simple' | 'pro'>(experienceMode);
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const { isPhone } = useResponsiveLayout();
  const { showToast } = useFeedback();

  useEffect(() => {
    getManagedSymbols().then((rows) => {
      const suggested = rows.filter((item) => ['EURUSD', 'XAUUSD', 'BTC/USDT', 'GBPUSD', 'USDJPY'].includes(item.symbol));
      setSymbols(suggested.length ? suggested : rows.slice(0, 6));
      setSelectedSymbols(Object.fromEntries(rows.map((item) => [item.id, ['EURUSD', 'XAUUSD', 'BTC/USDT'].includes(item.symbol) || item.active === 1])));
    }).catch(() => undefined);
  }, []);

  const numericBalance = parseInputNumber(balance);
  const numericRisk = parseInputNumber(risk);
  const riskAmount = numericBalance > 0 && numericRisk > 0 ? (numericBalance * numericRisk) / 100 : 0;
  const textAlign = isRTL ? 'right' : 'left';
  const rowDirection = isRTL ? 'row-reverse' as const : 'row' as const;
  const canContinue = useMemo(() => step !== 1 || (numericBalance > 0 && numericRisk > 0), [step, numericBalance, numericRisk]);

  const start = async () => {
    if (saving || numericBalance <= 0 || numericRisk <= 0) return;
    setSaving(true);
    try {
      await saveAccount({ accountBalance: numericBalance, defaultRisk: numericRisk, currency: baseCurrency.trim().toUpperCase() || 'USD' });
      await setExperienceMode(mode);
      await Promise.all(symbols.map((symbol) => setSymbolActive(symbol.id, selectedSymbols[symbol.id] !== false)));
      await completeOnboarding();
    } catch {
      showToast({ title: isRTL ? 'راه‌اندازی کامل نشد' : 'Setup did not complete', message: isRTL ? 'ذخیره‌سازی محلی در دسترس نیست؛ اپ را دوباره باز کن.' : 'Local storage is unavailable. Restart the app and try again.', tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSymbol = (id: number) => setSelectedSymbols((old) => ({ ...old, [id]: !old[id] }));

  return <Screen maxContentWidth={760} bottomActionPlacement="screen" bottomAction={<Button title={saving ? (isRTL ? 'در حال راه‌اندازی…' : 'Setting up…') : step === 3 ? t('onboarding.start') : t('onboarding.next')} icon={step === 3 ? 'check' : 'arrow-right'} onPress={step === 3 ? start : () => canContinue && setStep((value) => Math.min(3, value + 1))} disabled={!canContinue || saving} />}>
    <Title eyebrow="TradeLog Setup" subtitle={t('onboarding.subtitle')}>{t('onboarding.title')}</Title>

    <HeroCard
      eyebrow={isRTL ? `مرحله ${step + 1} از 4` : `Step ${step + 1} of 4`}
      title={step === 0 ? t('onboarding.language') : step === 1 ? t('settings.tradingSetup') : step === 2 ? t('settings.displayMode') : t('settings.symbolManagement')}
      value={step === 1 ? formatMoney(riskAmount, baseCurrency).replace(/^\+/, '') : step === 2 ? (mode === 'pro' ? t('settings.pro') : t('settings.simple')) : step === 3 ? String(Object.values(selectedSymbols).filter(Boolean).length) : language.toUpperCase()}
      caption={step === 1 ? t('settings.riskPreviewHint') : step === 3 ? t('onboarding.symbolsHint') : t('settings.setupHint')}
      tone={step === 2 && mode === 'pro' ? 'primary' : 'info'}
      footer={step === 1 ? <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}><MiniKpi label={t('settings.currency')} value={baseCurrency} /><MiniKpi label={t('settings.defaultRisk')} value={`${risk}%`} tone="warning" /><MiniKpi label={t('settings.riskPerTrade')} value={formatMoney(riskAmount, baseCurrency).replace(/^\+/, '')} tone="info" /></View> : undefined}
    />

    {step === 0 ? <Card>
      <Text style={{ color: theme.colors.textMuted, fontWeight: '900', marginBottom: 8, textAlign }}>{t('onboarding.language')}</Text>
      <Segmented value={language} onChange={(value) => setLanguage(value as 'fa' | 'en')} options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]} />
      <Text style={{ color: theme.colors.textMuted, fontWeight: '800', marginTop: 16, lineHeight: 20, textAlign }}>{t('onboarding.languageHint')}</Text>
    </Card> : null}

    {step === 1 ? <Card>
      <Field label={t('settings.currency')} value={baseCurrency} onChangeText={(value) => setBaseCurrency(value.toUpperCase())} autoCapitalize="characters" icon="dollar-sign" />
      <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {currencies.map((item) => <Badge key={item} label={item} tone={baseCurrency === item ? 'primary' : 'default'} onPress={() => setBaseCurrency(item)} />)}
      </View>
      <Field label={t('onboarding.balance')} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" suffix={baseCurrency} icon="briefcase" error={balance && numericBalance <= 0 ? t('settings.accountInvalid') : undefined} />
      <Field label={`${t('onboarding.risk')} (%)`} value={risk} onChangeText={setRisk} keyboardType="decimal-pad" suffix="%" icon="percent" error={risk && numericRisk <= 0 ? t('settings.accountInvalid') : undefined} />
      <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 8 }}>
        {riskPresets.map((item) => <Badge key={item} label={`${item}%`} tone={risk === item ? 'warning' : 'default'} onPress={() => setRisk(item)} />)}
      </View>
    </Card> : null}

    {step === 2 ? <Card>
      <Segmented value={mode} onChange={(value) => setMode(value as 'simple' | 'pro')} options={[{ value: 'simple', label: t('settings.simple') }, { value: 'pro', label: t('settings.pro') }]} />
      <ResponsiveRow breakpoint={600} gap={10} style={{ marginTop: 14 }}>
        <View style={{ flex: 1, borderWidth: 1, borderColor: mode === 'simple' ? theme.colors.info : theme.colors.border, backgroundColor: mode === 'simple' ? theme.colors.infoSoft : theme.colors.surfaceMuted, borderRadius: 18, padding: 12, minHeight: isPhone ? 0 : 118 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign }}>{t('settings.simple')}</Text>
          <Text style={{ color: theme.colors.textMuted, fontWeight: '700', fontSize: 11, marginTop: 7, lineHeight: 17, textAlign }}>{t('settings.simpleHint')}</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: mode === 'pro' ? theme.colors.primaryGlow : theme.colors.border, backgroundColor: mode === 'pro' ? theme.colors.primarySoft : theme.colors.surfaceMuted, borderRadius: 18, padding: 12, minHeight: isPhone ? 0 : 118 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '900', textAlign }}>{t('settings.pro')}</Text>
          <Text style={{ color: theme.colors.textMuted, fontWeight: '700', fontSize: 11, marginTop: 7, lineHeight: 17, textAlign }}>{t('settings.proHint')}</Text>
        </View>
      </ResponsiveRow>
    </Card> : null}

    {step === 3 ? <Card>
      <Text style={{ color: theme.colors.textMuted, fontWeight: '800', marginBottom: 12, lineHeight: 20, textAlign }}>{t('onboarding.symbolsHint')}</Text>
      <View style={{ gap: 9 }}>
        {symbols.map((symbol) => {
          const active = selectedSymbols[symbol.id] !== false;
          return <Pressable key={symbol.id} onPress={() => toggleSymbol(symbol.id)} style={({ pressed }) => ({ borderWidth: 1, borderColor: active ? theme.colors.primaryGlow : theme.colors.border, backgroundColor: active ? theme.colors.primarySoft : theme.colors.surfaceMuted, borderRadius: 18, padding: 13, opacity: pressed ? 0.75 : 1 })}>
            <View style={{ flexDirection: rowDirection, alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? theme.colors.primary : theme.colors.backgroundElevated }}>
                <Feather name={active ? 'check' : 'plus'} size={17} color={active ? '#fff' : theme.colors.textSubtle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '900', textAlign }}>{symbol.symbol}</Text>
                <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', marginTop: 4, textAlign }}>{symbol.market.toUpperCase()} · {symbol.quote_currency || baseCurrency}</Text>
              </View>
              <Badge label={active ? t('settings.activeLabel') : t('settings.inactiveLabel')} tone={active ? 'success' : 'default'} />
            </View>
          </Pressable>;
        })}
      </View>
    </Card> : null}

    {step > 0 ? <Button title={t('onboarding.back')} icon="arrow-left" variant="secondary" onPress={() => setStep((value) => Math.max(0, value - 1))} /> : null}
  </Screen>;
}
