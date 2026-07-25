import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  DimensionValue,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Tone = 'default' | 'success' | 'danger' | 'info' | 'warning' | 'primary';

type IconName = keyof typeof Feather.glyphMap;

function alphaColor(color: string, opacity: number) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
  }
  return color;
}

function shadowStyle(color: string, opacity: number, radius: number, offset: { width: number; height: number }, elevation = 0): ViewStyle {
  if (Platform.OS === 'web') {
    return ({ boxShadow: opacity > 0 ? `${offset.width}px ${offset.height}px ${radius}px ${alphaColor(color, opacity)}` : 'none' } as unknown) as ViewStyle;
  }
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: offset, elevation };
}

function toneColors(theme: ReturnType<typeof useApp>['theme'], tone: Tone) {
  const color = tone === 'success'
    ? theme.colors.success
    : tone === 'danger'
      ? theme.colors.danger
      : tone === 'info'
        ? theme.colors.info
        : tone === 'warning'
          ? theme.colors.warning
          : tone === 'primary'
            ? theme.colors.primaryGlow
            : theme.colors.text;
  const backgroundColor = tone === 'success'
    ? theme.colors.successSoft
    : tone === 'danger'
      ? theme.colors.dangerSoft
      : tone === 'info'
        ? theme.colors.infoSoft
        : tone === 'warning'
          ? theme.colors.warningSoft
          : tone === 'primary'
            ? theme.colors.primarySoft
            : theme.colors.surfaceMuted;

  return { color, backgroundColor, borderColor: tone === 'default' ? theme.colors.border : `${color}55` };
}

export function Screen({
  children,
  scroll = true,
  bottomAction,
  bottomActionPlacement = 'tab',
  maxContentWidth,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  bottomAction?: React.ReactNode;
  bottomActionPlacement?: 'tab' | 'screen';
  maxContentWidth?: number;
}) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const { isDesktop, horizontalPadding, contentMaxWidth } = useResponsiveLayout();
  const resolvedContentMaxWidth = maxContentWidth ?? contentMaxWidth;
  const tabBarClearance = (isDesktop ? 30 : 104) + insets.bottom;
  const bottomActionOffset = bottomActionPlacement === 'tab' ? (isDesktop ? 18 : 90 + insets.bottom) : 14 + insets.bottom;
  const bottomActionClearance = bottomActionPlacement === 'tab' ? (isDesktop ? 104 : 176 + insets.bottom) : 96 + insets.bottom;
  const content = (
    <View style={[
      styles.screen,
      {
        backgroundColor: theme.colors.background,
        width: '100%',
        maxWidth: resolvedContentMaxWidth,
        alignSelf: 'center',
        paddingHorizontal: horizontalPadding,
      },
    ]}>{children}</View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.bgOrb, styles.bgOrbOne, { backgroundColor: theme.colors.primarySoft, pointerEvents: 'none' }]} />
      <View style={[styles.bgOrb, styles.bgOrbTwo, { backgroundColor: theme.colors.infoSoft, pointerEvents: 'none' }]} />
      {scroll ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomAction ? bottomActionClearance : tabBarClearance, width: '100%' },
          ]}
          scrollIndicatorInsets={{ bottom: bottomAction ? bottomActionClearance : tabBarClearance }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : content}
      {bottomAction ? (
        <View style={[styles.bottomAction, { bottom: bottomActionOffset }]}>
          <View style={{ width: '100%', maxWidth: resolvedContentMaxWidth, alignSelf: 'center', paddingHorizontal: horizontalPadding }}>
            {bottomAction}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function AnimatedScreen({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ flex: 1 }}>
      <Screen>{children}</Screen>
    </Animated.View>
  );
}

export function Title({ children, subtitle, eyebrow, right }: { children: React.ReactNode; subtitle?: string; eyebrow?: string; right?: React.ReactNode }) {
  const { theme, isRTL } = useApp();
  const { isPhone } = useResponsiveLayout();
  const textAlign = isRTL ? 'right' : 'left';

  return (
    <View style={[styles.titleWrap, { flexDirection: isPhone ? 'column' : isRTL ? 'row-reverse' : 'row', alignItems: isPhone ? 'stretch' : 'flex-start' }]}> 
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.colors.primaryGlow, textAlign }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>{children}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted, textAlign }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ alignSelf: isPhone ? (isRTL ? 'flex-end' : 'flex-start') : 'auto' }}>{right}</View> : null}
    </View>
  );
}

export function Card({ children, style, compact = false, elevated = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; compact?: boolean; elevated?: boolean }) {
  const { theme } = useApp();

  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        shadowStyle(
          theme.shadow.color,
          elevated ? theme.shadow.opacity : Math.min(theme.shadow.opacity, 0.12),
          elevated ? theme.shadow.radius : 12,
          theme.shadow.offset,
          elevated ? theme.shadow.elevation : 3,
        ),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AnimatedCard({
  children,
  index = 0,
  style,
  compact = false,
  elevated = false,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  elevated?: boolean;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(14)}>
      <Card style={style} compact={compact} elevated={elevated}>{children}</Card>
    </Animated.View>
  );
}

export function SkeletonLoader({
  width,
  height,
  borderRadius = 12,
}: {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
}) {
  const { theme } = useApp();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        animStyle,
        { width, height, borderRadius, backgroundColor: theme.colors.surfaceMuted },
      ]}
    />
  );
}

export function HeroCard({
  eyebrow,
  title,
  value,
  caption,
  tone = 'primary',
  right,
  footer,
}: {
  eyebrow?: string;
  title: string;
  value: React.ReactNode;
  caption?: string;
  tone?: Tone;
  right?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  return (
    <View style={[styles.heroCard, { backgroundColor: theme.colors.surface, borderColor: colors.borderColor }]}> 
      <View style={[styles.heroGlow, { backgroundColor: colors.backgroundColor, pointerEvents: 'none' }]} />
      <View style={[styles.heroTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={[styles.heroEyebrow, { color: colors.color, textAlign: isRTL ? 'right' : 'left' }]}>{eyebrow}</Text> : null}
          <Text style={[styles.heroTitle, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
          <Text style={[styles.heroValue, { color: colors.color, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
          {caption ? <Text style={[styles.heroCaption, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{caption}</Text> : null}
        </View>
        {right ? <View style={styles.heroRight}>{right}</View> : null}
      </View>
      {footer ? <View style={[styles.heroFooter, { borderTopColor: theme.colors.border }]}>{footer}</View> : null}
    </View>
  );
}

export function ActionTile({
  title,
  subtitle,
  icon,
  tone = 'primary',
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  tone?: Tone;
  onPress: () => void;
}) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.backgroundColor }}
      style={({ pressed }) => [
        styles.actionTile,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: colors.borderColor,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.actionTileInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
        <View style={[styles.actionIcon, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}> 
          <Feather name={icon} size={18} color={colors.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
          {subtitle ? <Text style={[styles.actionSubtitle, { color: theme.colors.textSubtle, textAlign: isRTL ? 'right' : 'left' }]}>{subtitle}</Text> : null}
        </View>
        <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={theme.colors.textSubtle} />
      </View>
    </Pressable>
  );
}

export function SectionHeading({ title, icon, meta }: { title: string; icon?: IconName; meta?: string }) {
  const { theme, isRTL } = useApp();

  return (
    <View style={[styles.sectionHeading, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
      {icon ? (
        <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primarySoft, borderColor: `${theme.colors.primary}44` }]}> 
          <Feather name={icon} size={16} color={theme.colors.primaryGlow} />
        </View>
      ) : null}
      <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
      {meta ? <Text style={[styles.sectionMeta, { color: theme.colors.textSubtle, textAlign: isRTL ? 'left' : 'right' }]}>{meta}</Text> : null}
    </View>
  );
}

export function CollapsibleCard({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  meta,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  children: React.ReactNode;
  defaultOpen?: boolean;
  meta?: string;
}) {
  const { theme, isRTL } = useApp();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card compact>
      <Pressable onPress={() => setOpen((value) => !value)} style={[styles.collapsibleHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
        {icon ? <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primarySoft, borderColor: `${theme.colors.primary}44` }]}><Feather name={icon} size={16} color={theme.colors.primaryGlow} /></View> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
          {subtitle ? <Text style={[styles.collapsibleSubtitle, { color: theme.colors.textSubtle, textAlign: isRTL ? 'right' : 'left' }]}>{subtitle}</Text> : null}
        </View>
        {meta ? <Badge label={meta} tone="primary" /> : null}
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </Card>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  editable = true,
  hint,
  error,
  autoCapitalize = 'none',
  suffix,
  icon,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  editable?: boolean;
  hint?: string;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  suffix?: string;
  icon?: IconName;
  secureTextEntry?: boolean;
}) {
  const { theme, isRTL } = useApp();
  const [focused, setFocused] = useState(false);
  const textAlign = isRTL ? 'right' : 'left';

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: focused ? theme.colors.primaryGlow : theme.colors.textMuted, textAlign }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderColor: focused ? theme.colors.borderFocus : theme.colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
          shadowStyle(theme.colors.primary, focused ? 0.20 : 0, focused ? 12 : 0, { width: 0, height: 5 }, focused ? 3 : 0),
        ]}
      >
        {icon ? <Feather name={icon} size={17} color={focused ? theme.colors.primaryGlow : theme.colors.textSubtle} style={styles.inputIcon} /> : null}
        <TextInput
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSubtle}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              textAlign,
              minHeight: multiline ? 108 : 52,
              opacity: editable ? 1 : 0.58,
            },
          ]}
        />
        {suffix ? <Text style={[styles.inputSuffix, { color: theme.colors.textSubtle }]}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={[styles.hint, { color: theme.colors.danger, textAlign }]}>{error}</Text> : hint ? <Text style={[styles.hint, { color: theme.colors.textSubtle, textAlign }]}>{hint}</Text> : null}
    </View>
  );
}

export function PressableScale({
  children,
  onPress,
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        disabled={disabled}
        onPressIn={() => {
          if (!disabled) scale.value = withSpring(0.95, { damping: 10 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10 });
        }}
        onPress={onPress}
        style={({ pressed }) => [style, { opacity: disabled ? 0.46 : pressed ? 0.86 : 1 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  icon?: IconName;
}) {
  const { theme, isRTL } = useApp();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSuccess = variant === 'success';
  const backgroundColor = isPrimary
    ? theme.colors.primary
    : isDanger
      ? theme.colors.dangerSoft
      : isSuccess
        ? theme.colors.successSoft
        : theme.colors.surfaceMuted;
  const borderColor = isPrimary
    ? theme.colors.primary
    : isDanger
      ? theme.colors.danger
      : isSuccess
        ? theme.colors.success
        : theme.colors.border;
  const foregroundColor = isPrimary
    ? '#FFFFFF'
    : isDanger
      ? theme.colors.danger
      : isSuccess
        ? theme.colors.success
        : theme.colors.text;

  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
        },
        shadowStyle(theme.colors.primary, isPrimary ? 0.30 : 0, isPrimary ? 18 : 0, { width: 0, height: 8 }, isPrimary ? 6 : 0),
      ]}
    >
      <View style={[styles.buttonContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
        {icon ? <Feather name={icon} size={18} color={foregroundColor} /> : null}
        <Text style={[styles.buttonText, { color: foregroundColor }]}>{title}</Text>
      </View>
    </PressableScale>
  );
}

export function BackButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const { theme, isRTL } = useApp();
  const neutralWebDirection = Platform.OS === 'web' ? ({ direction: 'ltr' } as any) : undefined;
  return (
    <View style={[{ width: '100%', alignItems: isRTL ? 'flex-end' : 'flex-start', marginTop: 10, marginBottom: 2 }, neutralWebDirection]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? (isRTL ? 'بازگشت' : 'Back')}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 40,
          paddingHorizontal: 13,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceMuted,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 7,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={17} color={theme.colors.text} />
        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '900', writingDirection: isRTL ? 'rtl' : 'ltr' }}>{label ?? (isRTL ? 'بازگشت' : 'Back')}</Text>
      </Pressable>
    </View>
  );
}

export function ModalCloseButton({
  onPress,
  disabled = false,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme, isRTL } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isRTL ? 'بستن پنجره' : 'Close dialog'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modalCloseButton,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.42 : pressed ? 0.68 : 1,
        },
        style,
      ]}
    >
      <Feather name="x" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const { theme } = useApp();
  const { width } = useResponsiveLayout();
  const compact = width < 390 && options.length >= 3;

  return (
    <View style={[styles.segmented, { backgroundColor: theme.colors.backgroundElevated, borderColor: theme.colors.border }]}> 
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              compact && { minHeight: 41, paddingHorizontal: 3 },
              active && { backgroundColor: theme.colors.primary },
              active && shadowStyle(theme.colors.primary, 0.28, 10, { width: 0, height: 4 }, 4),
              pressed && { opacity: 0.82 },
            ]}
          >
            <Text numberOfLines={2} style={[styles.segmentText, compact && { fontSize: 10, lineHeight: 13 }, { color: active ? '#FFFFFF' : theme.colors.textMuted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChipGroup({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const { theme } = useApp();

  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.backgroundElevated,
                borderColor: active ? theme.colors.primaryGlow : theme.colors.border,
                borderWidth: active ? 1.5 : 1,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? theme.colors.primaryGlow : theme.colors.textMuted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ResponsiveRow({
  children,
  breakpoint = 560,
  gap = 10,
  style,
}: {
  children: React.ReactNode;
  breakpoint?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useResponsiveLayout();
  const { isRTL } = useApp();
  const stacked = width < breakpoint;
  return (
    <View style={[{ flexDirection: stacked ? 'column' : isRTL ? 'row-reverse' : 'row', gap, alignItems: 'stretch' }, style]}>
      {children}
    </View>
  );
}

export function ResponsiveGrid({
  children,
  minItemWidth = 320,
  gap = 14,
}: {
  children: React.ReactNode;
  minItemWidth?: number;
  gap?: number;
}) {
  const { contentViewportWidth, contentMaxWidth, horizontalPadding } = useResponsiveLayout();
  const usableWidth = Math.max(0, Math.min(contentViewportWidth, contentMaxWidth ?? contentViewportWidth) - (horizontalPadding * 2));
  const twoColumns = usableWidth >= (minItemWidth * 2) + gap;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }}>
      {React.Children.map(children, (child) => (
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: twoColumns ? minItemWidth : '100%', maxWidth: twoColumns ? '49.4%' : '100%', minWidth: twoColumns ? minItemWidth : 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Badge({ label, tone = 'default', icon, onPress }: { label: string; tone?: Tone; icon?: IconName; onPress?: () => void }) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  const content = (
    <>
      {icon ? <Feather name={icon} size={12} color={colors.color} /> : null}
      <Text style={[styles.badgeText, { color: colors.color }]}>{label}</Text>
    </>
  );
  const badgeStyle = [styles.badge, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor, flexDirection: isRTL ? 'row-reverse' as const : 'row' as const }];

  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => [badgeStyle, { opacity: pressed ? 0.75 : 1 }]}>{content}</Pressable>;
  }

  return <View style={badgeStyle}>{content}</View>;
}

export function MiniKpi({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  return (
    <View style={[styles.miniKpi, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}> 
      <Text style={[styles.miniKpiLabel, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Text style={[styles.miniKpiValue, { color: colors.color, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
    </View>
  );
}

export function InfoRow({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: theme.colors.border }]}> 
      <Text style={[styles.infoLabel, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.color, textAlign: isRTL ? 'left' : 'right' }]}>{value}</Text>
    </View>
  );
}

export function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);

  return (
    <View style={[styles.stat, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}> 
      <Text style={[styles.statLabel, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.color, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
    </View>
  );
}

export function MetricHero({
  label,
  value,
  caption,
  tone = 'default',
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: Tone;
}) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  return (
    <View style={[styles.metricHero, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}> 
      <Text style={[styles.metricLabel, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.color, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
      {caption ? <Text style={[styles.metricCaption, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{caption}</Text> : null}
    </View>
  );
}

export function ProgressRow({
  label,
  value,
  detail,
  progress,
  tone = 'info',
}: {
  label: string;
  value: string;
  detail?: string;
  progress: number;
  tone?: Tone;
}) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  const width = `${Math.max(4, Math.min(100, progress))}%` as DimensionValue;
  return (
    <View style={styles.progressRow}> 
      <View style={[styles.progressHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
        <Text style={[styles.progressLabel, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
        <Text style={[styles.progressValue, { color: colors.color, textAlign: isRTL ? 'left' : 'right' }]}>{value}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.backgroundElevated }]}> 
        <View style={[styles.progressFill, { backgroundColor: colors.color, width }]} />
      </View>
      {detail ? <Text style={[styles.progressDetail, { color: theme.colors.textSubtle, textAlign: isRTL ? 'right' : 'left' }]}>{detail}</Text> : null}
    </View>
  );
}

export function TradeCard({
  symbol,
  direction,
  status,
  pnl,
  strategy,
  meta,
  date,
  onPress,
  tone = 'default',
}: {
  symbol: string;
  direction: string;
  status: string;
  pnl: string;
  strategy?: string;
  meta?: string;
  date?: string;
  onPress?: () => void;
  tone?: Tone;
}) {
  const { theme, isRTL } = useApp();
  const colors = toneColors(theme, tone);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}> 
      <Card compact style={[styles.tradeCard, { borderColor: colors.borderColor }]}> 
        <View style={[styles.tradeAccent, isRTL ? { right: 0 } : { left: 0 }, { backgroundColor: colors.color, pointerEvents: 'none' }]} />
        <View style={[styles.tradeTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
          <View style={{ flex: 1 }}>
            <View style={[styles.tradeBadges, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}> 
              <Text style={[styles.tradeSymbol, { color: theme.colors.text }]}>{symbol}</Text>
              <Badge label={direction} tone={direction === 'BUY' ? 'success' : 'danger'} />
              <Badge label={status} tone={tone} />
            </View>
            {strategy ? <Text style={[styles.tradeStrategy, { color: theme.colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{strategy}</Text> : null}
          </View>
          <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
            <Text style={[styles.tradePnl, { color: colors.color }]}>{pnl}</Text>
            {date ? <Text style={[styles.tradeDate, { color: theme.colors.textSubtle }]}>{date}</Text> : null}
          </View>
        </View>
        {meta ? <Text style={[styles.tradeMeta, { color: theme.colors.textSubtle, textAlign: isRTL ? 'right' : 'left' }]}>{meta}</Text> : null}
      </Card>
    </Pressable>
  );
}

export function Empty({
  title,
  text,
  actionTitle,
  onAction,
  icon = 'inbox',
}: {
  title?: string;
  text?: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: IconName;
}) {
  const { t } = useTranslation();
  const { theme } = useApp();

  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primarySoft, borderColor: `${theme.colors.primary}44` }]}> 
        <Feather name={icon} size={23} color={theme.colors.primaryGlow} />
      </View>
      {title ? <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text> : null}
      <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{text ?? t('common.noData')}</Text>
      {actionTitle && onAction ? <View style={{ marginTop: 14 }}><Button title={actionTitle} onPress={onAction} variant="secondary" icon="plus" /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden' },
  bgOrb: { position: 'absolute', width: 240, height: 240, borderRadius: 120, opacity: 0.72 },
  bgOrbOne: { top: -116, right: -108 },
  bgOrbTwo: { bottom: 88, left: -154 },
  scrollContent: { flexGrow: 1, width: '100%' },
  screen: { flex: 1, paddingBottom: 26, gap: 14 },
  bottomAction: { position: 'absolute', left: 0, right: 0, width: '100%' },
  titleWrap: { marginTop: 12, marginBottom: 8, alignItems: 'flex-start', gap: 12, width: '100%' },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6, textTransform: 'uppercase' },
  title: { fontSize: 31, fontWeight: '900', letterSpacing: -0.9, lineHeight: 38, flexShrink: 1 },
  subtitle: { fontSize: 13, marginTop: 7, lineHeight: 21, fontWeight: '700' },
  card: { borderRadius: 28, borderWidth: 1, padding: 20 },
  cardCompact: { padding: 16, borderRadius: 24 },
  heroCard: { borderRadius: 32, borderWidth: 1, padding: 20, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -58, top: -64, opacity: 0.82 },
  heroTop: { alignItems: 'flex-start', gap: 14 },
  heroRight: { alignSelf: 'stretch', justifyContent: 'center' },
  heroEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  heroTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  heroValue: { fontSize: 42, fontWeight: '900', letterSpacing: -1.4, marginTop: 7, flexShrink: 1 },
  heroCaption: { fontSize: 12, fontWeight: '800', marginTop: 9, lineHeight: 19 },
  heroFooter: { borderTopWidth: 1, marginTop: 18, paddingTop: 14 },
  actionTile: { borderRadius: 22, borderWidth: 1, padding: 14, minHeight: 112 },
  actionTileInner: { alignItems: 'center', gap: 12, flex: 1 },
  actionIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '900' },
  actionSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 3, lineHeight: 16 },
  sectionHeading: { alignItems: 'center', gap: 9, marginBottom: 14 },
  sectionIcon: { width: 33, height: 33, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '900', flex: 1 },
  sectionMeta: { fontSize: 11, fontWeight: '900' },
  collapsibleHead: { alignItems: 'center', gap: 10 },
  collapsibleSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 3, lineHeight: 17 },
  collapsibleBody: { marginTop: 16 },
  field: { gap: 7, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  inputWrap: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', alignItems: 'center' },
  inputIcon: { marginHorizontal: 12 },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontWeight: '800' },
  inputSuffix: { fontSize: 12, fontWeight: '900', paddingHorizontal: 14 },
  hint: { fontSize: 10, lineHeight: 16, fontWeight: '700' },
  button: { minHeight: 56, borderRadius: 18, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonContent: { alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 16, fontWeight: '900' },
  modalCloseButton: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  segmented: { flexDirection: 'row', borderRadius: 18, padding: 4, gap: 4, borderWidth: 1 },
  segment: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 8 },
  segmentText: { fontWeight: '900', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 15, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontWeight: '900', fontSize: 12 },
  badge: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, gap: 5 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.2 },
  miniKpi: { borderRadius: 18, padding: 13, flexGrow: 1, flexShrink: 1, flexBasis: 108, minWidth: 0, borderWidth: 1 },
  miniKpiLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  miniKpiValue: { fontSize: 15, fontWeight: '900', marginTop: 6, flexShrink: 1 },
  infoRow: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, gap: 14 },
  infoLabel: { fontSize: 12, fontWeight: '800', flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '900', flex: 1 },
  stat: { borderRadius: 20, padding: 14, flexGrow: 1, minWidth: '45%', borderWidth: 1 },
  statLabel: { fontSize: 11, fontWeight: '800' },
  statValue: { fontSize: 20, fontWeight: '900', marginTop: 7, letterSpacing: -0.3 },
  metricHero: { borderRadius: 25, padding: 18, borderWidth: 1 },
  metricLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  metricValue: { fontSize: 38, fontWeight: '900', letterSpacing: -1.2, marginTop: 8 },
  metricCaption: { fontSize: 12, fontWeight: '800', marginTop: 8 },
  progressRow: { gap: 8, paddingVertical: 10 },
  progressHead: { justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  progressLabel: { flex: 1, fontSize: 13, fontWeight: '900' },
  progressValue: { fontSize: 13, fontWeight: '900' },
  progressTrack: { height: 9, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressDetail: { fontSize: 11, fontWeight: '700' },
  tradeCard: { overflow: 'hidden', paddingLeft: 18, paddingRight: 18 },
  tradeAccent: { position: 'absolute', top: 16, bottom: 16, width: 4, borderRadius: 999 },
  tradeTop: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  tradeBadges: { alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tradeSymbol: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
  tradeStrategy: { marginTop: 9, fontSize: 13, fontWeight: '800' },
  tradePnl: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  tradeDate: { marginTop: 8, fontSize: 11, fontWeight: '800' },
  tradeMeta: { marginTop: 12, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 34 },
  emptyIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emptyTitle: { marginTop: 12, fontWeight: '900', fontSize: 16, textAlign: 'center' },
  emptyText: { marginTop: 8, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
});
