import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  VictoryArea,
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryPie,
  VictoryTheme,
} from 'victory-native';
import { getAnalytics, getTradesByDayOfWeek } from '@/db/repositories';
import { useApp } from '@/context/AppContext';
import { AnimatedCard, Button, Empty, HeroCard, MiniKpi, ProgressRow, Screen, SectionHeading, Title } from '@/components/ui';
import { formatMoney, formatNumber } from '@/services/calculations';
import { generateMonthlyReport } from '@/services/pdfReport';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

type Data = Awaited<ReturnType<typeof getAnalytics>>;
type DayOfWeekData = Awaited<ReturnType<typeof getTradesByDayOfWeek>>;

function ChartFrame({ children, height }: { children: React.ReactNode; height: number }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        width: '100%',
        height,
        marginTop: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.backgroundElevated,
      }}
    >
      {children}
    </View>
  );
}

function BarLegend({ isRTL }: { isRTL: boolean }) {
  const { theme } = useApp();
  const item = (color: string, label: string) => (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: theme.colors.textSubtle, fontSize: 10, fontWeight: '800' }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'flex-start', gap: 14, marginTop: 2 }}>
      {item(theme.colors.success, isRTL ? 'سود' : 'Profit')}
      {item(theme.colors.danger, isRTL ? 'زیان' : 'Loss')}
    </View>
  );
}


export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { theme, isRTL, currency, refreshKey } = useApp();
  const { contentViewportWidth, horizontalPadding, contentMaxWidth, isPhone } = useResponsiveLayout();
  const availableWidth = Math.min(contentViewportWidth, contentMaxWidth ?? contentViewportWidth);
  const chartWidth = Math.max(220, Math.floor(availableWidth - (horizontalPadding * 2) - 42));
  const chartHeight = isPhone ? 210 : 224;
  const compactChartHeight = isPhone ? 206 : 218;
  const chartPadding = { top: 18, bottom: 48, left: isPhone ? 46 : 58, right: isPhone ? 20 : 30 };
  const [data, setData] = useState<Data | null>(null);
  const [dayOfWeekData, setDayOfWeekData] = useState<DayOfWeekData>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loadError, setLoadError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null);
    setDayOfWeekData([]);
    setLoadError('');
    Promise.all([getAnalytics(), getTradesByDayOfWeek()]).then(([analytics, byDayOfWeek]) => {
      if (!active) return;
      setData(analytics);
      setDayOfWeekData(byDayOfWeek);
    }).catch((error) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [refreshKey]));

  const maxEmotion = useMemo(() => Math.max(1, ...(data?.byEmotion.map((item) => Math.abs(Number(item.avgPnl))) ?? [1])), [data]);
  const maxStrategy = useMemo(() => Math.max(1, ...(data?.byStrategy.map((item) => Math.abs(Number(item.pnl))) ?? [1])), [data]);
  const maxSymbol = useMemo(() => Math.max(1, ...(data?.bySymbol.map((item) => Math.abs(Number(item.pnl))) ?? [1])), [data]);
  const cumulativeCurve = useMemo(() => {
    let total = 0;
    return (data?.recentCurve ?? []).map((item) => {
      total += Number(item.pnl);
      return { x: item.day.slice(5), y: total };
    });
  }, [data]);
  const weeklyPnl = useMemo(() => {
    const weeks = new Map<string, number>();
    for (const item of data?.recentCurve ?? []) {
      const date = new Date(`${item.day}T00:00:00`);
      const offsetFromMonday = (date.getDay() + 6) % 7;
      date.setDate(date.getDate() - offsetFromMonday);
      const weekStart = date.toISOString().slice(5, 10);
      weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + Number(item.pnl));
    }
    return [...weeks.entries()].slice(-8).map(([week, pnl]) => ({ week, pnl }));
  }, [data]);
  const pnlByDay = useMemo(() => {
    const labels = isRTL ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const indexed = new Map(dayOfWeekData.map((item) => [(Number(item.dow) + 1) % 7, item]));
    return labels.map((label, index) => {
      const item = indexed.get(index);
      return { label, average: item?.trades ? Number(item.pnl) / Number(item.trades) : 0, trades: Number(item?.trades ?? 0) };
    });
  }, [dayOfWeekData, isRTL]);

  if (loadError) return <Screen><Empty title={isRTL ? 'آمار بارگذاری نشد' : 'Analytics could not be loaded'} text={loadError} icon="alert-circle" /></Screen>;
  if (!data) return <Screen><Empty text={t('common.loading')} /></Screen>;

  const winRate = data.totals.trades ? Math.round((data.totals.wins / data.totals.trades) * 100) : 0;
  const bestStrategy = data.byStrategy[0];
  const worstStrategy = [...data.byStrategy].sort((a, b) => Number(a.pnl) - Number(b.pnl))[0];
  const worstEmotion = [...data.byEmotion].sort((a, b) => Number(a.avgPnl) - Number(b.avgPnl))[0];
  const bestSymbol = data.bySymbol[0];
  const tone = data.totals.pnl > 0 ? 'success' : data.totals.pnl < 0 ? 'danger' : 'primary';
  const rowDirection = isRTL ? 'row-reverse' as const : 'row' as const;
  const textAlign = isRTL ? 'right' as const : 'left' as const;
  const behavioralInsight = worstEmotion && Number(worstEmotion.avgPnl) < 0
    ? isRTL
      ? `بیشترین فشار رفتاری فعلاً از احساس «${t(`emotions.${worstEmotion.emotion}`)}» می‌آید. حجم را در این حالت سبک‌تر کن.`
      : `Your weakest behavior state is “${t(`emotions.${worstEmotion.emotion}`)}”. Reduce size when this emotion appears.`
    : isRTL
      ? 'برای تحلیل رفتاری دقیق‌تر، بعد از هر ترید احساس ورود و خروج را ثبت کن.'
      : 'For stronger behavioral insights, log entry and exit emotions on every trade.';
  const xAxisStyle = {
    axis: { stroke: theme.colors.border, strokeWidth: 1 },
    ticks: { stroke: 'transparent' },
    tickLabels: { fill: theme.colors.textSubtle, fontSize: isPhone ? 8 : 9, fontWeight: '700', padding: 10 },
    grid: { stroke: 'transparent' },
  };
  const yAxisStyle = {
    axis: { stroke: 'transparent' },
    ticks: { stroke: 'transparent' },
    tickLabels: { fill: theme.colors.textSubtle, fontSize: isPhone ? 8 : 9, fontWeight: '700', padding: 6 },
    grid: { stroke: theme.colors.border, strokeDasharray: '4,6', strokeWidth: 1 },
  };
  const weeklyBarWidth = isPhone ? 24 : 36;
  const dailyBarWidth = isPhone ? 22 : 32;
  const weeklyDomainPadding = isPhone ? 30 : 46;
  const dailyDomainPadding = isPhone ? 24 : 36;

  const createPdfReport = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const now = new Date();
      await generateMonthlyReport({
        lang: isRTL ? 'fa' : 'en',
        currency,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Screen>
      <Title eyebrow="Performance Lab" subtitle={isRTL ? 'عددها را به تصمیم قابل اجرا تبدیل کن.' : 'Turn numbers into actionable trading decisions.'}>{t('analytics.title')}</Title>

      <Button
        title={isGeneratingPdf ? (isRTL ? 'در حال ساخت گزارش…' : 'Generating report…') : (isRTL ? 'گزارش PDF این ماه' : 'This month PDF report')}
        variant="secondary"
        icon="file-text"
        disabled={isGeneratingPdf}
        onPress={createPdfReport}
      />

      <HeroCard
        eyebrow={isRTL ? 'نتیجه کل' : 'Total result'}
        title={t('analytics.totalPnl')}
        value={formatMoney(data.totals.pnl, currency)}
        caption={bestStrategy ? `${isRTL ? 'بهترین استراتژی' : 'Best strategy'}: ${bestStrategy.strategy}` : isRTL ? 'برای تحلیل بهتر، تریدهای بیشتری ثبت کن.' : 'Log more trades to unlock better insights.'}
        tone={tone}
        footer={(
          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
              <MiniKpi label={t('dashboard.winRate')} value={`${winRate}%`} tone="info" />
              <MiniKpi label={t('analytics.profitFactor')} value={data.totals.profitFactor >= 99 ? '∞' : formatNumber(data.totals.profitFactor, 2)} tone={data.totals.profitFactor >= 1.4 ? 'success' : data.totals.profitFactor < 1 ? 'danger' : 'warning'} />
              <MiniKpi label={t('analytics.avgRr')} value={`1:${formatNumber(data.totals.avgRr, 2)}`} tone="primary" />
            </View>
            <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
              <MiniKpi label={t('analytics.avgWin')} value={formatMoney(data.totals.avgWin, currency)} tone="success" />
              <MiniKpi label={t('analytics.avgLoss')} value={formatMoney(data.totals.avgLoss, currency)} tone="danger" />
              <MiniKpi label={t('analytics.trades')} value={formatNumber(data.totals.trades, 0)} />
            </View>
          </View>
        )}
      />

      <AnimatedCard index={0}>
        <SectionHeading title={isRTL ? 'رشد سود و زیان' : 'P&L growth'} icon="trending-up" meta="P&L" />
        {cumulativeCurve.length ? (
          <ChartFrame height={chartHeight}>
            <VictoryChart width={chartWidth} height={chartHeight} padding={chartPadding} domainPadding={{ x: isPhone ? 10 : 16 }} theme={VictoryTheme.material}>
              <VictoryAxis crossAxis={false} style={xAxisStyle} />
              <VictoryAxis dependentAxis style={yAxisStyle} />
              <VictoryArea
                data={cumulativeCurve}
                interpolation="monotoneX"
                animate={{ duration: 550, onLoad: { duration: 450 } }}
                style={{ data: { stroke: theme.colors.primaryGlow, strokeWidth: 2.5, fill: theme.colors.primarySoft, fillOpacity: 0.55 } }}
              />
            </VictoryChart>
          </ChartFrame>
        ) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={1}>
        <SectionHeading title={isRTL ? 'سود و زیان هفتگی' : 'Weekly P&L'} icon="bar-chart-2" meta={isRTL ? '۸ هفته اخیر' : 'Last 8 weeks'} />
        {weeklyPnl.length ? <BarLegend isRTL={isRTL} /> : null}
        {weeklyPnl.length ? (
          <ChartFrame height={compactChartHeight}>
            <VictoryChart width={chartWidth} height={compactChartHeight} padding={chartPadding} domainPadding={{ x: weeklyDomainPadding }} theme={VictoryTheme.material}>
              <VictoryAxis crossAxis={false} style={xAxisStyle} />
              <VictoryAxis dependentAxis style={yAxisStyle} />
              <VictoryBar
                data={weeklyPnl}
                x="week"
                y="pnl"
                barWidth={weeklyBarWidth}
                cornerRadius={7}
                animate={{ duration: 550, onLoad: { duration: 450 } }}
                style={{
                  data: {
                    fill: ({ datum }) => Number(datum.pnl) > 0 ? theme.colors.success : Number(datum.pnl) < 0 ? theme.colors.danger : theme.colors.textSubtle,
                    fillOpacity: 0.92,
                  },
                }}
              />
            </VictoryChart>
          </ChartFrame>
        ) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={2}>
        <SectionHeading title={isRTL ? 'عملکرد روزهای هفته' : 'P&L by day of week'} icon="calendar" meta={isRTL ? 'میانگین P&L' : 'Avg P&L'} />
        {dayOfWeekData.length ? <BarLegend isRTL={isRTL} /> : null}
        {dayOfWeekData.length ? (
          <ChartFrame height={compactChartHeight}>
            <VictoryChart width={chartWidth} height={compactChartHeight} padding={chartPadding} domainPadding={{ x: dailyDomainPadding }} theme={VictoryTheme.material}>
              <VictoryAxis crossAxis={false} style={xAxisStyle} />
              <VictoryAxis dependentAxis style={yAxisStyle} />
              <VictoryBar
                data={pnlByDay}
                x="label"
                y="average"
                barWidth={dailyBarWidth}
                cornerRadius={7}
                animate={{ duration: 550, onLoad: { duration: 450 } }}
                style={{
                  data: {
                    fill: ({ datum }) => Number(datum.average) > 0 ? theme.colors.success : Number(datum.average) < 0 ? theme.colors.danger : theme.colors.textSubtle,
                    fillOpacity: 0.92,
                  },
                }}
              />
            </VictoryChart>
          </ChartFrame>
        ) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={3}>
        <SectionHeading title={isRTL ? 'برد در برابر باخت' : 'Win vs loss'} icon="pie-chart" />
        {data.totals.trades ? (
          <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}>
            <VictoryPie
              width={chartWidth}
              height={180}
              padding={12}
              innerRadius={54}
              data={[{ x: 'Win', y: data.totals.wins }, { x: 'Loss', y: data.totals.trades - data.totals.wins }]}
              colorScale={[theme.colors.success, theme.colors.danger]}
              labels={() => null}
            />
            <View style={{ pointerEvents: 'none', position: 'absolute', alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: 'bold' }}>{winRate}%</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' }}>{isRTL ? 'نرخ برد' : 'Win rate'}</Text>
            </View>
          </View>
        ) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={4}>
        <SectionHeading title={isRTL ? 'استراتژی برنده / بازنده' : 'Best / worst strategy'} icon="target" />
        <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
          <MiniKpi label={isRTL ? 'بهترین' : 'Best'} value={bestStrategy?.strategy ?? '—'} tone="success" />
          <MiniKpi label={isRTL ? 'ضعیف‌ترین' : 'Weakest'} value={worstStrategy?.strategy ?? '—'} tone={worstStrategy && Number(worstStrategy.pnl) < 0 ? 'danger' : 'default'} />
        </View>
      </AnimatedCard>

      <AnimatedCard index={5}>
        <SectionHeading title={isRTL ? 'اثر احساسات روی نتیجه' : 'Emotion impact'} icon="heart" meta={isRTL ? 'میانگین P&L' : 'Avg P&L'} />
        {data.byEmotion.length ? data.byEmotion.map((item) => {
          const avg = Number(item.avgPnl);
          const wr = Math.round((Number(item.wins) / Number(item.trades)) * 100 || 0);
          return <ProgressRow key={item.emotion} label={t(`emotions.${item.emotion}`)} value={`${wr}% · ${formatMoney(avg, currency)}`} detail={`${item.trades} ${isRTL ? 'ترید' : 'trades'}`} progress={(Math.abs(avg) / maxEmotion) * 100} tone={avg >= 0 ? 'success' : 'danger'} />;
        }) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={6}>
        <SectionHeading title={isRTL ? 'عملکرد استراتژی‌ها' : 'Strategy performance'} icon="target" meta="P&L" />
        {data.byStrategy.length ? data.byStrategy.map((item) => {
          const pnl = Number(item.pnl);
          const wr = Math.round((Number(item.wins) / Number(item.trades)) * 100 || 0);
          return <ProgressRow key={item.strategy} label={item.strategy} value={formatMoney(pnl, currency)} detail={`${item.trades} ${isRTL ? 'ترید' : 'trades'} · ${wr}% WR · 1:${formatNumber(Number(item.avgRr), 2)}`} progress={(Math.abs(pnl) / maxStrategy) * 100} tone={pnl >= 0 ? 'success' : 'danger'} />;
        }) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={7}>
        <SectionHeading title={isRTL ? 'نمادهای اثرگذار' : 'Symbol impact'} icon="hash" meta={bestSymbol?.symbol} />
        {data.bySymbol.length ? data.bySymbol.map((item) => {
          const pnl = Number(item.pnl);
          const wr = Math.round((Number(item.wins) / Number(item.trades)) * 100 || 0);
          return <ProgressRow key={item.symbol} label={item.symbol} value={formatMoney(pnl, currency)} detail={`${item.trades} ${isRTL ? 'ترید' : 'trades'} · ${wr}% WR`} progress={(Math.abs(pnl) / maxSymbol) * 100} tone={pnl >= 0 ? 'success' : 'danger'} />;
        }) : <Empty />}
      </AnimatedCard>

      <AnimatedCard index={8} compact>
        <SectionHeading title={isRTL ? 'برداشت رفتاری' : 'Behavioral read'} icon="compass" />
        <Text style={{ color: theme.colors.textMuted, textAlign, lineHeight: 21, fontSize: 12, fontWeight: '800' }}>{behavioralInsight}</Text>
      </AnimatedCard>
    </Screen>
  );
}
