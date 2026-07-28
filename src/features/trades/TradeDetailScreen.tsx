import React, { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { addTradeImage, deleteTrade, deleteTradeImage, getChecklist, getTrade, getTradeImages } from '@/db/repositories';
import { ChecklistItem, Trade, TradeImage } from '@/types';
import { useApp } from '@/context/AppContext';
import { useFeedback } from '@/components/feedback';
import { BackButton, Badge, Button, Card, CollapsibleCard, Empty, HeroCard, InfoRow, MiniKpi, Screen, SectionHeading, Title } from '@/components/ui';
import { formatMoney, formatNumber } from '@/services/calculations';
import { getPnlPercent, getRMultiple, getTradeDurationLabel, formatRMultiple } from '@/services/tradeMetrics';
import { MAX_TRADE_IMAGES, pickAndPersistChartImage } from '@/services/images';

function safeDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function TradeDetailScreen() {
  const { params } = useRoute<any>();
  const id = Number(params?.id);
  const { t } = useTranslation();
  const { theme, isRTL, currency, refresh } = useApp();
  const { showToast, confirm } = useFeedback();
  const navigation = useNavigation<any>();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [images, setImages] = useState<TradeImage[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [imageBusy, setImageBusy] = useState(false);

  const load = useCallback(async () => {
    const [item, imageRows, checklistRows] = await Promise.all([getTrade(id), getTradeImages(id), getChecklist()]);
    setTrade(item ?? null);
    setImages(imageRows);
    setChecklist(checklistRows);
  }, [id]);

  useFocusEffect(useCallback(() => {
    load().catch(() => showToast({ title: isRTL ? 'معامله بارگذاری نشد' : 'Trade could not be loaded', tone: 'danger' }));
  }, [load, isRTL, showToast]));

  if (!trade) return <Screen><BackButton onPress={() => navigation.goBack()} /><Empty /></Screen>;

  let checked: Record<string, number> = {};
  try { checked = JSON.parse(trade.checklist || '{}') as Record<string, number>; } catch { checked = {}; }

  const isOpen = trade.status === 'OPEN';
  const netPnl = Number(trade.pnl_net ?? 0);
  const pnlTone = isOpen ? 'info' : netPnl > 0 ? 'success' : netPnl < 0 ? 'danger' : 'default';
  const pnlValue = isOpen ? (isRTL ? 'در جریان' : 'Live') : formatMoney(netPnl, currency);
  const sizeValue = trade.market === 'forex' ? `${trade.lot_size ?? '—'} Lot` : `${trade.quantity ?? '—'} Qty`;
  const checklistDone = checklist.filter((item) => checked[item.id] === 1 || checked[String(item.id)] === 1).length;
  const duration = getTradeDurationLabel(trade, isRTL);
  const rMultiple = getRMultiple(trade);
  const pnlPercent = getPnlPercent(trade);
  const rowDirection = isRTL ? 'row-reverse' as const : 'row' as const;
  const textAlign = isRTL ? 'right' as const : 'left' as const;
  const priceStops = trade.direction === 'BUY'
    ? [trade.stop_loss, trade.entry_price, trade.take_profit, trade.exit_price]
    : [trade.take_profit, trade.entry_price, trade.stop_loss, trade.exit_price];

  const addImage = async () => {
    if (imageBusy) return;
    if (images.length >= MAX_TRADE_IMAGES) {
      showToast({ title: isRTL ? 'حداکثر ۴ تصویر' : 'Maximum 4 images', tone: 'warning' });
      return;
    }
    setImageBusy(true);
    try {
      const uri = await pickAndPersistChartImage();
      if (!uri) return;
      await addTradeImage(id, uri, isOpen ? 'analysis' : 'exit');
      await load();
      showToast({ title: t('common.saved'), message: t('trade.imageAdded'), tone: 'success' });
    } catch (error) {
      showToast({ title: isRTL ? 'تصویر اضافه نشد' : 'Image was not added', message: error instanceof Error ? error.message : undefined, tone: 'danger' });
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = (image: TradeImage) => confirm({
    title: t('trade.deleteImage'),
    message: t('trade.deleteImageMessage'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    destructive: true,
    onConfirm: async () => {
      await deleteTradeImage(image.id);
      await load();
      showToast({ title: t('common.saved'), message: t('trade.imageDeleted'), tone: 'success' });
    },
  });

  const remove = () => confirm({
    title: t('common.delete'),
    message: t('settings.deleteWarning'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    destructive: true,
    onConfirm: async () => {
      await deleteTrade(id);
      refresh();
      showToast({ title: t('common.saved'), message: t('trade.deleted'), tone: 'success' });
      navigation.goBack();
    },
  });

  const copyTrade = () => navigation.navigate('Tabs', { screen: 'NewTrade', params: { cloneTrade: trade } });

  return (
    <Screen maxContentWidth={980} bottomActionPlacement="screen" bottomAction={isOpen ? <Button title={t('trade.closeTrade')} icon="log-out" onPress={() => navigation.navigate('CloseTrade', { id })} /> : undefined}>
      <BackButton onPress={() => navigation.goBack()} />
      <Title eyebrow={isOpen ? t('common.open') : t('common.closed')} subtitle={trade.strategy || (isRTL ? 'بدون استراتژی' : 'No strategy')}>{trade.symbol}</Title>

      <HeroCard
        eyebrow={`${trade.market.toUpperCase()} · ${trade.direction}`}
        title={isOpen ? (isRTL ? 'وضعیت معامله' : 'Trade status') : t('trade.netPnl')}
        value={pnlValue}
        caption={`${formatRMultiple(rMultiple)} · ${duration}${pnlPercent === null ? '' : ` · ${pnlPercent > 0 ? '+' : ''}${formatNumber(pnlPercent, 2)}%`}`}
        tone={pnlTone}
        footer={(
          <View style={{ flexDirection: rowDirection, flexWrap: 'wrap', gap: 9 }}>
            <MiniKpi label={t('trade.rr')} value={trade.rr_ratio === null || trade.rr_ratio === undefined ? '—' : `1:${formatNumber(Number(trade.rr_ratio), 2)}`} tone="info" />
            <MiniKpi label="R" value={formatRMultiple(rMultiple)} tone={pnlTone} />
            <MiniKpi label={t('trade.pips')} value={trade.pnl_pips === null || trade.pnl_pips === undefined ? '—' : formatNumber(Number(trade.pnl_pips), 1)} tone={pnlTone} />
          </View>
        )}
      />

      <Card>
        <SectionHeading title={isRTL ? 'اقدام سریع' : 'Quick actions'} icon="zap" />
        <View style={{ flexDirection: rowDirection, gap: 9, flexWrap: 'wrap' }}>
          {isOpen ? <View style={{ flexGrow: 1, minWidth: '45%' }}><Button title={t('trade.closeTrade')} icon="log-out" onPress={() => navigation.navigate('CloseTrade', { id })} /></View> : null}
          <View style={{ flexGrow: 1, minWidth: '45%' }}><Button title={t('common.edit')} icon="edit-3" variant="secondary" onPress={() => navigation.navigate('EditTrade', { id })} /></View>
          <View style={{ flexGrow: 1, minWidth: '45%' }}><Button title={isRTL ? 'کپی ترید' : 'Copy trade'} icon="copy" variant="secondary" onPress={copyTrade} /></View>
          <View style={{ flexGrow: 1, minWidth: '45%' }}><Button title={imageBusy ? (isRTL ? 'در حال افزودن…' : 'Adding…') : t('trade.addImage')} icon="image" variant="secondary" disabled={imageBusy || images.length >= MAX_TRADE_IMAGES} onPress={addImage} /></View>
        </View>
      </Card>

      <Card>
        <SectionHeading title={isRTL ? 'نقشه قیمت' : 'Price map'} icon="crosshair" />
        <View style={{ borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated, padding: 14, gap: 12 }}>
          <View style={{ height: 10, borderRadius: 999, overflow: 'hidden', flexDirection: rowDirection, backgroundColor: theme.colors.surfaceMuted }}>
            <View style={{ flex: 1, backgroundColor: theme.colors.danger }} />
            <View style={{ width: 7, backgroundColor: theme.colors.text }} />
            <View style={{ flex: Math.max(1, Math.min(3, Number(trade.rr_ratio ?? 1))), backgroundColor: theme.colors.success }} />
          </View>
          <View style={{ flexDirection: rowDirection, justifyContent: 'space-between', gap: 8 }}>
            <Badge label={`${trade.direction === 'BUY' ? 'SL' : 'TP'} ${priceStops[0] ?? '—'}`} tone={trade.direction === 'BUY' ? 'danger' : 'success'} />
            <Badge label={`${t('trade.entry')} ${trade.entry_price}`} tone="primary" />
            <Badge label={`${trade.direction === 'BUY' ? 'TP' : 'SL'} ${priceStops[2] ?? '—'}`} tone={trade.direction === 'BUY' ? 'success' : 'danger'} />
          </View>
          {!isOpen && trade.exit_price ? <InfoRow label={t('trade.exit')} value={String(trade.exit_price)} tone={pnlTone} /> : null}
        </View>
      </Card>

      <Card>
        <SectionHeading title={isRTL ? 'اطلاعات ورود و خروج' : 'Entry & Exit'} icon="activity" />
        <InfoRow label={t('trade.entry')} value={String(trade.entry_price)} />
        <InfoRow label={t('trade.exit')} value={trade.exit_price === null || trade.exit_price === undefined ? '—' : String(trade.exit_price)} />
        <InfoRow label={t('trade.stopLoss')} value={trade.stop_loss === null || trade.stop_loss === undefined ? '—' : String(trade.stop_loss)} />
        <InfoRow label={t('trade.takeProfit')} value={trade.take_profit === null || trade.take_profit === undefined ? '—' : String(trade.take_profit)} />
        <InfoRow label={trade.market === 'forex' ? t('trade.lotSize') : t('trade.quantity')} value={sizeValue} />
        {trade.market === 'crypto' && trade.position_type ? (
          <InfoRow
            label={t('trade.positionType')}
            value={trade.position_type === 'futures' && trade.leverage ? `${t('trade.futures')} · ${trade.leverage}x` : t('trade.spot')}
            tone={trade.position_type === 'futures' ? 'warning' : 'default'}
          />
        ) : null}
        <InfoRow label={isRTL ? 'زمان ورود' : 'Open time'} value={safeDate(trade.open_time)} />
        <InfoRow label={isRTL ? 'زمان خروج' : 'Close time'} value={safeDate(trade.close_time)} />
      </Card>

      <Card>
        <SectionHeading title={isRTL ? 'عملکرد معامله' : 'Trade Performance'} icon="bar-chart-2" />
        <InfoRow label="R Multiple" value={formatRMultiple(rMultiple)} tone={pnlTone} />
        <InfoRow label={isRTL ? 'مدت معامله' : 'Duration'} value={duration} />
        <InfoRow label={t('trade.pips')} value={trade.pnl_pips === null || trade.pnl_pips === undefined ? '—' : formatNumber(Number(trade.pnl_pips), 1)} tone={pnlTone} />
        <InfoRow label={t('trade.grossPnl')} value={trade.pnl_gross === null || trade.pnl_gross === undefined ? '—' : formatMoney(Number(trade.pnl_gross), currency)} tone={pnlTone} />
        <InfoRow label={t('trade.netPnl')} value={trade.pnl_net === null || trade.pnl_net === undefined ? '—' : formatMoney(Number(trade.pnl_net), currency)} tone={pnlTone} />
        <InfoRow label={t('trade.commission')} value={formatMoney(Number(trade.commission ?? 0), currency).replace(/^\+/, '')} />
        <InfoRow label={t('trade.swap')} value={formatMoney(Number(trade.swap_fee ?? 0), currency).replace(/^\+/, '')} />
        <InfoRow label={t('trade.funding')} value={formatMoney(Number(trade.funding_fee ?? 0), currency).replace(/^\+/, '')} />
      </Card>

      <CollapsibleCard title={t('trade.checklist')} subtitle={isRTL ? 'کیفیت اجرای ستاپ' : 'Setup execution quality'} icon="check-square" defaultOpen meta={`${checklistDone}/${checklist.length}`}>
        {checklist.length ? checklist.map((item) => {
          const ok = checked[item.id] === 1 || checked[String(item.id)] === 1;
          return (
            <View key={item.id} style={{ flexDirection: rowDirection, gap: 10, paddingVertical: 8, alignItems: 'center' }}>
              <Badge label={ok ? '✓' : '×'} tone={ok ? 'success' : 'danger'} />
              <Text style={{ color: theme.colors.text, flex: 1, textAlign, fontWeight: '800' }}>{isRTL ? item.label_fa : item.label_en}</Text>
            </View>
          );
        }) : <Empty />}
      </CollapsibleCard>

      <Card>
        <SectionHeading title={t('trade.journal')} icon="book-open" />
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', textAlign }}>{t('trade.setup')}</Text>
        <Text style={{ color: theme.colors.text, marginTop: 7, lineHeight: 22, textAlign, fontWeight: '700' }}>{trade.setup_notes || '—'}</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginTop: 16, textAlign }}>{isRTL ? 'اشتباهات / دلیل خروج' : 'Mistakes / exit reason'}</Text>
        <Text style={{ color: theme.colors.text, marginTop: 7, lineHeight: 22, textAlign, fontWeight: '700' }}>{trade.exit_notes || '—'}</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '900', marginTop: 16, textAlign }}>{t('trade.lesson')}</Text>
        <Text style={{ color: theme.colors.text, marginTop: 7, lineHeight: 22, textAlign, fontWeight: '700' }}>{trade.lesson_learned || '—'}</Text>
      </Card>

      <Card>
        <SectionHeading title={t('trade.images')} icon="image" meta={`${images.length}`} />
        <Button title={imageBusy ? (isRTL ? 'در حال افزودن…' : 'Adding…') : t('trade.addImage')} icon="image" variant="secondary" disabled={imageBusy || images.length >= MAX_TRADE_IMAGES} onPress={addImage} />
        {images.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 }}>
          {images.map((image) => <Pressable key={image.id} onPress={() => removeImage(image)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
            <View>
              <Image source={{ uri: image.image_uri }} style={{ width: 104, height: 104, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border }} />
              <View style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.dangerSoft, borderWidth: 1, borderColor: theme.colors.danger }}>
                <Feather name="trash-2" size={13} color={theme.colors.danger} />
              </View>
              <Text style={{ color: theme.colors.textSubtle, fontSize: 10, fontWeight: '900', marginTop: 5, textAlign: 'center' }}>{image.image_type}</Text>
            </View>
          </Pressable>)}
        </View> : <Empty icon="image" title={isRTL ? 'عکسی ثبت نشده' : 'No images yet'} text={isRTL ? 'اسکرین‌شات ورود، خروج یا تحلیل را اضافه کن.' : 'Add entry, exit, or analysis screenshots.'} />}
      </Card>

      <Button title={t('common.delete')} icon="trash-2" variant="danger" onPress={remove} />
    </Screen>
  );
}
