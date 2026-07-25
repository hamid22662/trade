import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getAnalytics, getDashboardSummary, listTrades } from '@/db/repositories';
import { Summary, Trade } from '@/types';
import { useApp } from '@/context/AppContext';
import { ActionTile, AnimatedCard, Badge, Empty, HeroCard, MiniKpi, ProgressRow, ResponsiveRow, Screen, SectionHeading, SkeletonLoader, Title, TradeCard } from '@/components/ui';
import { formatMoney, formatNumber } from '@/services/calculations';
import { formatRMultiple, getRMultiple } from '@/services/tradeMetrics';
import { runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import SponsorBanner from '@/components/SponsorBanner';
import AccountSwitcher from '@/components/AccountSwitcher';

type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;

function AnimatedPnlValue({ value, currency }: { value: number; currency: string }) {
  const animatedPnl = useSharedValue(0);
  const animatedValue = useDerivedValue(() => animatedPnl.value);
  const [displayValue, setDisplayValue] = useState(formatMoney(0, currency));
  const updateDisplayValue = useCallback((current: number) => {
    setDisplayValue(formatMoney(current, currency));
  }, [currency]);

  useAnimatedReaction(
    () => animatedValue.value,
    (current, previous) => {
      if (current !== previous) runOnJS(updateDisplayValue)(current);
    },
    [updateDisplayValue],
  );

  useEffect(() => {
    animatedPnl.value = 0;
    animatedPnl.value = withTiming(value, { duration: 1000 });
  }, [animatedPnl, value]);

  return <Text>{displayValue}</Text>;
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { theme, isRTL, currency, refreshKey, experienceMode } = useApp();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Trade[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const load = useCallback(() => Promise.all([getDashboardSummary(), listTrades({ limit: 5 }), getAnalytics()]), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setSummary(null);
    setRecent([]);
    setAnalytics(null);
    load().then(([nextSummary, nextRecent, nextAnalytics]) => {
      if (!active) return;
      setSummary(nextSummary);
      setRecent(nextRecent);
      setAnalytics(nextAnalytics);
    }).catch(console.warn);
    return () => { active = false; };
  }, [load, refreshKey]));

  if (!summary) return (
    <Screen maxContentWidth={1060}>
      <AccountSwitcher />
      <SkeletonLoader width="100%" height={120} borderRadius={20} />
      <SkeletonLoader width="100%" height={80} borderRadius={20} />
      <SkeletonLoader width="100%" height={200} borderRadius={20} />
    </Screen>
  );

  const pnlTone = summary.pnl > 0 ? 'success' : summary.pnl < 0 ? 'danger' : 'primary';
  const worstEmotion = analytics?.byEmotion ? [...analytics.byEmotion].sort((a, b) => Number(a.avgPnl) - Number(b.avgPnl))[0] : undefined;
  const bestSymbol = analytics?.bySymbol?.[0];
  const bestStrategy = analytics?.byStrategy?.[0];
  const rowDirection = isRTL ? 'row-reverse' as const : 'row' as const;
  const performanceLabel = isRTL
    ? summary.trades === 0 ? 'ژورنال را با اولین معامله شروع کن' : summary.pnl >= 0 ? 'ریتم حساب خوب است؛ همین نظم را حفظ کن.' : 'سیگنال کنترل ریسک؛ حجم یا تعداد معاملات را سبک‌تر کن.'
    : summary.trades === 0 ? 'Start your journal with the first trade' : summary.pnl >= 0 ? 'Account rhythm looks healthy. Keep the process clean.' : 'Risk control signal. Reduce size or frequency.';
  const smartInsight = summary.openTrades > 0
    ? isRTL ? `الان ${summary.openTrades} پوزیشن باز داری؛ قبل از ورود جدید، ریسک باز را چک کن.` : `You have ${summary.openTrades} open position${summary.openTrades === 1 ? '' : 's'}. Review open risk before adding a new trade.`
    : worstEmotion && Number(worstEmotion.avgPnl) < 0
      ? isRTL ? `هشدار رفتاری: میانگین نتیجه در حالت «${t(`emotions.${worstEmotion.emotion}`)}» منفی است.` : `Behavior note: average result under “${t(`emotions.${worstEmotion.emotion}`)}” is negative.`
      : bestStrategy
        ? isRTL ? `بهترین استراتژی فعلی: ${bestStrategy.strategy}` : `Current best strategy: ${bestStrategy.strategy}`
        : performanceLabel;

  return (
    <Screen>
      <AccountSwitcher />
      <Title
        eyebrow="Trade Command"
        subtitle={t('dashboard.greeting')}
        right={<Badge label={experienceMode === 'pro' ? t('settings.pro') : t('settings.simple')} tone={experienceMode === 'pro' ? 'primary' : 'info'} icon={experienceMode === 'pro' ? 'zap' : 'shield'} />}
      >
        {t('dashboard.title')}
      </Title>
      <SponsorBanner />
      <HeroCard
        eyebrow={isRTL ? 'عملکرد ماه' : 'Monthly performance'}
        title={t('dashboard.monthlyPnl')}
        value={<AnimatedPnlValue value={summary.pnl} currency={currency} />}
        caption={performanceLabel}
        tone={pnlTone}
        footer={(
          <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
            <MiniKpi label={t('dashboard.winRate')} value={`${summary.winRate}%`} tone="info" />
            <MiniKpi label={t('dashboard.openTrades')} value={formatNumber(summary.openTrades, 0)} tone={summary.openTrades > 0 ? 'warning' : 'default'} />
            <MiniKpi label={t('dashboard.totalTrades')} value={formatNumber(summary.trades, 0)} />
          </View>
        )}
      />

      <AnimatedCard index={0} compact style={{ borderColor: theme.colors.info, borderWidth: 1.5 }}>
        <SectionHeading title={isRTL ? 'راهنمای امروز' : 'Today’s read'} icon="compass" />
        <Text style={{ color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left', fontWeight: '800', lineHeight: 21, fontSize: 12 }}>{smartInsight}</Text>
        {bestSymbol ? <View style={{ marginTop: 14 }}><ProgressRow label={isRTL ? `نماد اثرگذار: ${bestSymbol.symbol}` : `Impact symbol: ${bestSymbol.symbol}`} value={formatMoney(Number(bestSymbol.pnl), currency)} detail={`${bestSymbol.trades} ${isRTL ? 'ترید' : 'trades'}`} progress={100} tone={Number(bestSymbol.pnl) >= 0 ? 'success' : 'danger'} /></View> : null}
      </AnimatedCard>

      <ResponsiveRow breakpoint={440} gap={10}>
        <View style={{ flex: 1 }}>
          <ActionTile title={isRTL ? 'ثبت ترید' : 'New trade'} subtitle={isRTL ? 'ورود سریع با ریسک' : 'Quick risk entry'} icon="plus-circle" tone="primary" onPress={() => navigation.navigate('NewTrade')} />
        </View>
        <View style={{ flex: 1 }}>
          <ActionTile title={isRTL ? 'ماشین حساب' : 'Calculator'} subtitle={isRTL ? 'لات و R/R' : 'Lot and R/R'} icon="sliders" tone="info" onPress={() => navigation.navigate('Calculator')} />
        </View>
      </ResponsiveRow>

      {summary.openTrades > 0 ? (
        <ActionTile title={isRTL ? `● ${formatNumber(summary.openTrades, 0)} پوزیشن باز دارید` : `● ${formatNumber(summary.openTrades, 0)} open position${summary.openTrades === 1 ? '' : 's'}`} subtitle={isRTL ? 'قبل از ورود جدید، ریسک‌های باز را مرور کن.' : 'Review live exposure before adding another position.'} icon="activity" tone="info" onPress={() => navigation.navigate('Trades')} />
      ) : null}

      <AnimatedCard index={1} compact>
        <SectionHeading title={t('dashboard.recentTrades')} icon="clock" meta={t('dashboard.viewAll')} />
        <View style={{ gap: 10 }}>
          {recent.length ? recent.map((trade) => {
            const isOpen = trade.status === 'OPEN';
            const pnl = Number(trade.pnl_net ?? 0);
            const tone = isOpen ? 'info' : pnl >= 0 ? 'success' : 'danger';
            const size = trade.market === 'forex' ? `${trade.lot_size ?? '—'} Lot` : `${trade.quantity ?? '—'} Qty`;
            const r = getRMultiple(trade);
            return <TradeCard key={trade.id} symbol={trade.symbol} direction={trade.direction} status={isOpen ? t('common.open') : t('common.closed')} pnl={isOpen ? t('common.open') : formatMoney(pnl, currency)} strategy={trade.strategy || (isRTL ? 'بدون استراتژی' : 'No strategy')} meta={`${t('trade.entry')} ${trade.entry_price} · ${size} · ${formatRMultiple(r)}`} date={new Date(trade.open_time).toLocaleDateString()} tone={tone} onPress={() => navigation.navigate('TradeDetail', { id: trade.id })} />;
          }) : <Empty icon="bar-chart-2" title={isRTL ? 'هنوز معامله‌ای ثبت نشده' : 'No trades yet'} text={isRTL ? 'اولین ترید را ثبت کن تا داشبورد زنده شود.' : 'Log your first trade to bring the dashboard to life.'} actionTitle={isRTL ? 'ثبت اولین ترید' : 'Add first trade'} onAction={() => navigation.navigate('NewTrade')} />}
        </View>
      </AnimatedCard>

      <Text style={{ color: theme.colors.textSubtle, textAlign: isRTL ? 'right' : 'left', fontWeight: '700', lineHeight: 20, fontSize: 12 }}>
        {isRTL ? 'هدف این داشبورد سریع‌دیدن وضعیت حساب است؛ جزئیات عمیق‌تر را در Analytics ببین.' : 'This dashboard is for a fast account pulse. Use Analytics for deeper review.'}
      </Text>
    </Screen>
  );
}
