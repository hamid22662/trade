import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getSettings, getStrategies, listTrades } from '@/db/repositories';
import { StrategyRow, Trade } from '@/types';
import { useApp } from '@/context/AppContext';
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
  Screen,
  SectionHeading,
  Segmented,
  Title,
} from '@/components/ui';
import { formatMoney, formatNumber } from '@/services/calculations';

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED';
type DateRangeFilter = 'all' | 'week' | 'month';
type MarketFilter = 'all' | 'forex' | 'crypto';
type DirectionFilter = 'all' | 'BUY' | 'SELL';
type ResultFilter = 'all' | 'win' | 'loss';
type SortMode = 'newest' | 'oldest' | 'pnl_desc' | 'pnl_asc' | 'rr_desc';
type DisplayMode = 'simple' | 'pro';

type TradeGroup = {
  key: string;
  title: string;
  trades: Trade[];
};

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const startOfWeek = (date: Date) => {
  const value = new Date(date);
  const day = value.getDay();
  const diff = value.getDate() - day + (day === 0 ? -6 : 1);
  value.setDate(diff);
  value.setHours(0, 0, 0, 0);
  return value;
};

const formatTradeDate = (value: string) => new Date(value).toLocaleDateString();

const formatDuration = (start: string, end?: string | null, isRTL = false) => {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMinutes = Math.max(0, Math.round((endTime - startTime) / 60000));
  if (diffMinutes < 60) return isRTL ? `${diffMinutes}د` : `${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours < 24) return isRTL ? `${hours}س ${minutes}د` : `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return isRTL ? `${days}روز ${restHours}س` : `${days}d ${restHours}h`;
};

const getRangeLabel = (dateRange: DateRangeFilter, isRTL: boolean) => {
  if (dateRange === 'week') return isRTL ? 'این هفته' : 'This week';
  if (dateRange === 'month') return isRTL ? 'این ماه' : 'This month';
  return isRTL ? 'همه زمان‌ها' : 'All time';
};

const groupClosedTrades = (trades: Trade[], isRTL: boolean): TradeGroup[] => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const weekStart = startOfWeek(now);
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const buckets: TradeGroup[] = [
    { key: 'today', title: isRTL ? 'امروز' : 'Today', trades: [] },
    { key: 'yesterday', title: isRTL ? 'دیروز' : 'Yesterday', trades: [] },
    { key: 'week', title: isRTL ? 'این هفته' : 'This week', trades: [] },
    { key: 'month', title: isRTL ? 'این ماه' : 'This month', trades: [] },
    { key: 'older', title: isRTL ? 'قدیمی‌تر' : 'Older', trades: [] },
  ];

  trades.forEach((trade) => {
    const date = new Date(trade.open_time);
    const tradeMonthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (isSameDay(date, now)) buckets[0].trades.push(trade);
    else if (isSameDay(date, yesterday)) buckets[1].trades.push(trade);
    else if (date >= weekStart) buckets[2].trades.push(trade);
    else if (tradeMonthKey === monthKey) buckets[3].trades.push(trade);
    else buckets[4].trades.push(trade);
  });

  return buckets.filter((group) => group.trades.length > 0);
};

export default function TradeListScreen() {
  const { t } = useTranslation();
  const { theme, isRTL, currency, refreshKey } = useApp();
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [strategyFilter, setStrategyFilter] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('simple');
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pageLimit, setPageLimit] = useState(50);

  const load = useCallback(() => listTrades({
    status: status === 'ALL' ? undefined : status,
    query,
    dateRange,
    market: marketFilter,
    direction: directionFilter,
    result: resultFilter,
    strategy: strategyFilter,
    sort,
    limit: pageLimit,
  }), [status, query, dateRange, marketFilter, directionFilter, resultFilter, strategyFilter, sort, pageLimit]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setTrades([]);
    load().then((rows) => { if (active) setTrades(rows); }).catch(console.warn);
    return () => { active = false; };
  }, [load, refreshKey]));

  useEffect(() => {
    let active = true;
    setStrategies([]);
    Promise.all([getSettings(), getStrategies()]).then(([settings, strategyRows]) => {
      if (!active) return;
      setDisplayMode(settings.experience_mode === 'pro' ? 'pro' : 'simple');
      setStrategies(strategyRows);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey]);

  const listStats = useMemo(() => {
    const open = trades.filter((trade) => trade.status === 'OPEN').length;
    const closed = trades.filter((trade) => trade.status === 'CLOSED');
    const pnl = closed.reduce((sum, trade) => sum + Number(trade.pnl_net ?? 0), 0);
    const wins = closed.filter((trade) => Number(trade.pnl_net ?? 0) > 0).length;
    const winRate = closed.length ? Math.round((wins / closed.length) * 100) : 0;
    const avgR = closed.length
      ? closed.reduce((sum, trade) => sum + (Number(trade.risk_amount ?? 0) > 0 ? Number(trade.pnl_net ?? 0) / Number(trade.risk_amount ?? 1) : 0), 0) / closed.length
      : 0;
    return { open, closed: closed.length, pnl, winRate, avgR };
  }, [trades]);

  const openTrades = useMemo(() => trades.filter((trade) => trade.status === 'OPEN'), [trades]);
  const closedTrades = useMemo(() => trades.filter((trade) => trade.status === 'CLOSED'), [trades]);
  const closedGroups = useMemo(() => groupClosedTrades(closedTrades, isRTL), [closedTrades, isRTL]);
  const hasActiveFilters = status !== 'ALL'
    || dateRange !== 'all'
    || query.trim().length > 0
    || marketFilter !== 'all'
    || directionFilter !== 'all'
    || resultFilter !== 'all'
    || strategyFilter.trim().length > 0;
  const strategyOptions = useMemo(() => {
    const saved = strategies.map((item) => item.name).filter(Boolean);
    const fromTrades = trades.map((trade) => trade.strategy).filter((value): value is string => Boolean(value));
    return Array.from(new Set([...saved, ...fromTrades])).slice(0, 12);
  }, [strategies, trades]);
  const rowDirection = isRTL ? 'row-reverse' : 'row';
  const textAlign = isRTL ? 'right' : 'left';
  const heroTone = listStats.pnl > 0 ? 'success' : listStats.pnl < 0 ? 'danger' : 'info';
  const sortOptions: { value: SortMode; label: string }[] = isRTL ? [
    { value: 'newest', label: 'جدیدترین' },
    { value: 'oldest', label: 'قدیمی‌ترین' },
    { value: 'pnl_desc', label: 'بیشترین سود' },
    { value: 'pnl_asc', label: 'بیشترین زیان' },
    { value: 'rr_desc', label: 'بهترین R/R' },
  ] : [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'pnl_desc', label: 'Highest profit' },
    { value: 'pnl_asc', label: 'Highest loss' },
    { value: 'rr_desc', label: 'Best R/R' },
  ];
  const activeSortLabel = sortOptions.find((option) => option.value === sort)?.label ?? sortOptions[0].label;

  const copyTrade = (trade: Trade) => {
    navigation.navigate('NewTrade', {
      cloneTrade: {
        id: trade.id,
        market: trade.market,
        symbol: trade.symbol,
        direction: trade.direction,
        entry_price: trade.entry_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        lot_size: trade.lot_size,
        quantity: trade.quantity,
        risk_percent: trade.risk_percent,
        account_balance: trade.account_balance,
        strategy: trade.strategy,
        emotion_entry: trade.emotion_entry,
        setup_notes: trade.setup_notes,
      },
    });
  };

  const resetFilters = () => {
    setStatus('ALL');
    setDateRange('all');
    setQuery('');
    setSort('newest');
    setMarketFilter('all');
    setDirectionFilter('all');
    setResultFilter('all');
    setStrategyFilter('');
    setPageLimit(50);
  };

  const renderTradeCard = (trade: Trade, index = 0) => {
    const isOpen = trade.status === 'OPEN';
    const pnl = Number(trade.pnl_net ?? 0);
    const tone = isOpen ? 'info' : pnl >= 0 ? 'success' : 'danger';
    const size = trade.market === 'forex' ? `${trade.lot_size ?? '—'} Lot` : `${trade.quantity ?? '—'} Qty`;
    const rr = trade.rr_ratio === null || trade.rr_ratio === undefined ? '—' : `1:${formatNumber(Number(trade.rr_ratio), 2)}`;
    const rMultiple = !isOpen && Number(trade.risk_amount ?? 0) > 0 ? pnl / Number(trade.risk_amount) : null;
    const pnlPct = !isOpen && Number(trade.account_balance ?? 0) > 0 ? (pnl / Number(trade.account_balance)) * 100 : null;
    const duration = formatDuration(trade.open_time, trade.close_time, isRTL);
    const pnlText = isOpen ? (isRTL ? 'پوزیشن باز' : 'Open') : formatMoney(pnl, currency);
    const actionTitle = isOpen ? t('trade.closeTrade') : (isRTL ? 'گزارش' : 'Report');
    const actionIcon = isOpen ? 'log-out' : 'file-text';

    const metaItems = [
      `${t('trade.entry')} ${trade.entry_price}`,
      trade.exit_price ? `${t('trade.exit')} ${trade.exit_price}` : isOpen && trade.take_profit ? `TP ${trade.take_profit}` : undefined,
      `R/R ${rr}`,
      displayMode === 'pro' ? `${isRTL ? 'مدت' : 'Duration'} ${duration}` : undefined,
      displayMode === 'pro' && rMultiple !== null ? `${rMultiple >= 0 ? '+' : ''}${formatNumber(rMultiple, 2)}R` : undefined,
      displayMode === 'pro' && pnlPct !== null ? `${pnlPct >= 0 ? '+' : ''}${formatNumber(pnlPct, 2)}%` : undefined,
      displayMode === 'pro' && trade.risk_amount ? `${isRTL ? 'ریسک' : 'Risk'} ${formatMoney(Number(trade.risk_amount), currency).replace(/^\+/, '')}` : undefined,
    ].filter(Boolean).join(' · ');

    return (
      <Animated.View key={trade.id} entering={FadeInDown.delay(index * 60).springify().damping(14)}>
      <Card compact style={{ borderColor: tone === 'success' ? `${theme.colors.success}66` : tone === 'danger' ? `${theme.colors.danger}66` : `${theme.colors.info}66`, overflow: 'hidden' }}>
        <View style={{ pointerEvents: 'none', position: 'absolute', top: 16, bottom: 16, width: 5, borderRadius: 99, backgroundColor: tone === 'success' ? theme.colors.success : tone === 'danger' ? theme.colors.danger : theme.colors.info, ...(isRTL ? { right: 0 } : { left: 0 }) }} />
        <View style={{ flexDirection: rowDirection, justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }}>{trade.symbol}</Text>
              <Badge label={trade.direction} tone={trade.direction === 'BUY' ? 'success' : 'danger'} />
              <Badge label={isOpen ? t('common.open') : t('common.closed')} tone={tone} />
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '900', marginTop: 10, textAlign }}>{trade.strategy || (isRTL ? 'بدون استراتژی' : 'No strategy')}</Text>
          </View>
          <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
            <Text style={{ color: tone === 'success' ? theme.colors.success : tone === 'danger' ? theme.colors.danger : theme.colors.info, fontSize: 19, fontWeight: '900', letterSpacing: -0.2 }}>{pnlText}</Text>
            <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', marginTop: 8 }}>{formatTradeDate(trade.open_time)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 14, padding: 12, borderRadius: 18, backgroundColor: theme.colors.backgroundElevated, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ color: theme.colors.textSubtle, fontSize: 12, fontWeight: '800', lineHeight: 18, textAlign }}>{metaItems}</Text>
          {displayMode === 'pro' ? <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800', lineHeight: 17, marginTop: 7, textAlign }}>{trade.market.toUpperCase()} · {size} · {isOpen ? (isRTL ? 'نیازمند پیگیری' : 'Needs active follow-up') : (isRTL ? 'ثبت‌شده در ژورنال' : 'Logged in journal')}</Text> : null}
        </View>

        <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9, marginTop: 13 }}>
          <View style={{ flex: 1 }}><Button title={actionTitle} icon={actionIcon as any} variant={isOpen ? 'success' : 'secondary'} onPress={() => isOpen ? navigation.navigate('CloseTrade', { id: trade.id }) : navigation.navigate('TradeDetail', { id: trade.id })} /></View>
          <View style={{ flex: 1 }}><Button title={isRTL ? 'جزئیات' : 'Details'} icon="eye" variant="secondary" onPress={() => navigation.navigate('TradeDetail', { id: trade.id })} /></View>
          {displayMode === 'pro' ? <View style={{ flex: 1 }}><Button title={isRTL ? 'کپی' : 'Copy'} icon="copy" variant="secondary" onPress={() => copyTrade(trade)} /></View> : null}
        </View>
      </Card>
      </Animated.View>
    );
  };

  return (
    <Screen maxContentWidth={1080}>
      <Title eyebrow="Trade Journal" subtitle={isRTL ? 'ژورنال معاملاتی با جست‌وجو، فیلتر و مرتب‌سازی حرفه‌ای.' : 'A searchable, sortable trading journal.'}>{t('tabs.trades')}</Title>

      <HeroCard
        eyebrow={getRangeLabel(dateRange, isRTL)}
        title={isRTL ? 'خلاصه تریدها' : 'Journal snapshot'}
        value={formatMoney(listStats.pnl, currency)}
        caption={isRTL ? 'خلاصه همین بازه و فیلترهای انتخاب‌شده.' : 'Summary for the selected range and filters.'}
        tone={heroTone}
        footer={(
          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
              <MiniKpi label={isRTL ? 'نمایش' : 'Shown'} value={formatNumber(trades.length, 0)} tone="primary" />
              <MiniKpi label={t('dashboard.openTrades')} value={formatNumber(listStats.open, 0)} tone={listStats.open > 0 ? 'warning' : 'default'} />
              <MiniKpi label={t('dashboard.winRate')} value={`${listStats.winRate}%`} tone="info" />
            </View>
            {displayMode === 'pro' ? (
              <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
                <MiniKpi label={isRTL ? 'بسته' : 'Closed'} value={formatNumber(listStats.closed, 0)} />
                <MiniKpi label={isRTL ? 'میانگین R' : 'Avg R'} value={`${listStats.avgR >= 0 ? '+' : ''}${formatNumber(listStats.avgR, 2)}R`} tone={listStats.avgR > 0 ? 'success' : listStats.avgR < 0 ? 'danger' : 'default'} />
              </View>
            ) : null}
          </View>
        )}
      />

      <Card compact>
        <SectionHeading title={isRTL ? 'جست‌وجو و فیلتر سریع' : 'Search and quick filters'} icon="filter" />
        <View style={{ gap: 10 }}>
          <Field label={t('common.search')} value={query} onChangeText={setQuery} placeholder={isRTL ? 'نماد یا استراتژی...' : 'Symbol or strategy...'} icon="search" />
          <Segmented value={status} onChange={(v) => setStatus(v as StatusFilter)} options={[{ value: 'ALL', label: t('common.all') }, { value: 'OPEN', label: t('common.open') }, { value: 'CLOSED', label: t('common.closed') }]} />
          <Segmented value={dateRange} onChange={(v) => setDateRange(v as DateRangeFilter)} options={isRTL ? [{ value: 'all', label: 'همه' }, { value: 'week', label: 'این هفته' }, { value: 'month', label: 'این ماه' }] : [{ value: 'all', label: 'All' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          <View style={{ flexDirection: rowDirection, justifyContent: 'flex-start' }}>
            <Pressable
              onPress={() => setSortModalOpen(true)}
              style={({ pressed }) => ({
                flexDirection: rowDirection,
                alignItems: 'center',
                gap: 8,
                minHeight: 42,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceMuted,
                opacity: pressed ? 0.76 : 1,
              })}
            >
              <Feather name="sliders" size={16} color={theme.colors.primaryGlow} />
              <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '900' }}>{isRTL ? 'مرتب‌سازی' : 'Sort'}</Text>
              <Text style={{ color: theme.colors.textSubtle, fontSize: 11, fontWeight: '800' }}>{activeSortLabel}</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <CollapsibleCard title={isRTL ? 'فیلتر پیشرفته' : 'Advanced filters'} subtitle={isRTL ? 'برای پیدا کردن تریدهای مهم، سودده، ضررده یا یک استراتژی خاص.' : 'Find important trades by direction, result, market or strategy.'} icon="sliders" meta={sort === 'newest' ? (isRTL ? 'جدیدترین' : 'Newest') : (isRTL ? 'فعال' : 'Active')}>
        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{isRTL ? 'بازار' : 'Market'}</Text>
            <Segmented value={marketFilter} onChange={(v) => setMarketFilter(v as MarketFilter)} options={[{ value: 'all', label: t('common.all') }, { value: 'forex', label: t('common.forex') }, { value: 'crypto', label: t('common.crypto') }]} />
          </View>
          <View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{isRTL ? 'جهت معامله' : 'Direction'}</Text>
            <Segmented value={directionFilter} onChange={(v) => setDirectionFilter(v as DirectionFilter)} options={[{ value: 'all', label: t('common.all') }, { value: 'BUY', label: t('common.buy') }, { value: 'SELL', label: t('common.sell') }]} />
          </View>
          <View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginBottom: 8, textAlign }}>{isRTL ? 'نتیجه' : 'Result'}</Text>
            <Segmented value={resultFilter} onChange={(v) => setResultFilter(v as ResultFilter)} options={isRTL ? [{ value: 'all', label: 'همه' }, { value: 'win', label: 'سودده' }, { value: 'loss', label: 'ضررده' }] : [{ value: 'all', label: 'All' }, { value: 'win', label: 'Winning' }, { value: 'loss', label: 'Losing' }]} />
          </View>
          <Field label={t('trade.strategy')} value={strategyFilter} onChangeText={setStrategyFilter} placeholder={isRTL ? 'نام استراتژی...' : 'Strategy name...'} icon="target" />
          {strategyOptions.length ? (
            <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 8 }}>
              {strategyOptions.map((item) => (
                <Badge key={item} label={item} tone={strategyFilter === item ? 'primary' : 'default'} onPress={() => setStrategyFilter(strategyFilter === item ? '' : item)} />
              ))}
            </View>
          ) : null}
          <Button title={isRTL ? 'پاک کردن فیلترها' : 'Reset filters'} variant="secondary" icon="refresh-cw" onPress={resetFilters} />
        </View>
      </CollapsibleCard>

      {trades.length ? (
        <View style={{ gap: 16 }}>
          {openTrades.length ? (
            <Card compact style={{ borderColor: theme.colors.info, borderWidth: 1.5 }}>
              <SectionHeading title={isRTL ? 'پوزیشن‌های باز' : 'Open positions'} icon="activity" meta={`${openTrades.length}`} />
              <View style={{ gap: 10 }}>{openTrades.map(renderTradeCard)}</View>
            </Card>
          ) : null}

          {closedGroups.length ? (
            <View style={{ gap: 14 }}>
              {closedGroups.map((group) => (
                <View key={group.key} style={{ gap: 10 }}>
                  <SectionHeading title={group.title} icon="calendar" meta={`${group.trades.length}`} />
                  {group.trades.map(renderTradeCard)}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Card>
          <Empty
            icon={hasActiveFilters ? 'search' : 'book-open'}
            title={hasActiveFilters ? (isRTL ? 'تریدی با این فیلتر پیدا نشد' : 'No trades match these filters') : (isRTL ? 'هنوز تریدی ثبت نکردی' : 'No trades logged yet')}
            text={hasActiveFilters ? (isRTL ? 'فیلترها را تغییر بده یا همه تریدها را ببین.' : 'Adjust filters or return to all trades.') : (isRTL ? 'اولین معامله‌ات را ثبت کن تا ژورنالت ساخته شود.' : 'Log your first trade to start building your journal.')}
            actionTitle={hasActiveFilters ? (isRTL ? 'نمایش همه' : 'Show all') : (isRTL ? 'ثبت ترید جدید' : 'New trade')}
            onAction={hasActiveFilters ? resetFilters : () => navigation.navigate('NewTrade')}
          />
        </Card>
      )}

      {trades.length >= pageLimit ? <Button title={isRTL ? 'نمایش ۵۰ مورد بیشتر' : 'Show 50 more'} variant="secondary" icon="chevrons-down" onPress={() => setPageLimit((value) => value + 50)} /> : null}

      <Modal transparent visible={sortModalOpen} animationType="fade" onRequestClose={() => setSortModalOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Pressable onPress={() => setSortModalOpen(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
          <View style={{ position: 'relative', borderRadius: 26, padding: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
            <ModalCloseButton onPress={() => setSortModalOpen(false)} style={{ position: 'absolute', top: 14, left: isRTL ? 14 : undefined, right: isRTL ? undefined : 14 }} />
            <View style={{ marginBottom: 14, paddingLeft: isRTL ? 42 : 0, paddingRight: isRTL ? 0 : 42 }}>
              <Text style={{ color: theme.colors.text, fontSize: 19, fontWeight: '900' }}>{isRTL ? 'مرتب‌سازی تریدها' : 'Sort trades'}</Text>
            </View>
            <View style={{ gap: 8 }}>
              {sortOptions.map((option) => {
                const selected = sort === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setSort(option.value);
                      setSortModalOpen(false);
                    }}
                    style={({ pressed }) => ({
                      minHeight: 52,
                      borderRadius: 17,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected ? theme.colors.primarySoft : theme.colors.backgroundElevated,
                      paddingHorizontal: 14,
                      flexDirection: rowDirection,
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: pressed ? 0.76 : 1,
                    })}
                  >
                    <Text style={{ color: selected ? theme.colors.primaryGlow : theme.colors.text, fontSize: 14, fontWeight: '900' }}>{option.label}</Text>
                    <Feather name={selected ? 'check-circle' : 'circle'} size={19} color={selected ? theme.colors.primaryGlow : theme.colors.textSubtle} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
