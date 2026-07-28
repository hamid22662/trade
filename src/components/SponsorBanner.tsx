import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { getRuntimeAppConfig, type RuntimeAppConfig } from '@/services/appConfig';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

type SponsorBannerConfig = RuntimeAppConfig['sponsorBanner'];

function isPublicHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isRenderableSponsorBanner(
  banner: SponsorBannerConfig | null | undefined,
): banner is SponsorBannerConfig {
  return Boolean(
    banner?.enabled
    && banner.imageUrl
    && banner.targetUrl
    && isPublicHttpUrl(banner.imageUrl)
    && isPublicHttpUrl(banner.targetUrl),
  );
}

export default function SponsorBanner() {
  const { t } = useTranslation();
  const { theme, isRTL } = useApp();
  const { isPhone } = useResponsiveLayout();
  const [banner, setBanner] = useState<SponsorBannerConfig | null>(null);

  useEffect(() => {
    let active = true;

    getRuntimeAppConfig()
      .then((config) => {
        if (!active) return;
        if (!isRenderableSponsorBanner(config.sponsorBanner)) return;
        // Render the banner directly and let the <Image> element's own onLoad/onError
        // below decide whether it stays visible. A separate Image.prefetch() pre-check
        // was tried here before, but on web it can silently hang or reject even when the
        // same URL loads fine as a normal <img>, which hid a perfectly valid banner.
        setBanner(config.sponsorBanner);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const openSponsor = useCallback(() => {
    if (!banner) return;
    if (Platform.OS === 'web') {
      window.open(banner.targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    void Linking.openURL(banner.targetUrl);
  }, [banner]);

  if (!isRenderableSponsorBanner(banner)) return null;

  const labelBackground = theme.mode === 'dark'
    ? 'rgba(5,5,5,0.78)'
    : 'rgba(255,255,255,0.90)';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('sponsor.open')}
      onPress={openSponsor}
      style={({ pressed }) => ({
        width: '100%',
        height: isPhone ? 104 : 138,
        borderRadius: isPhone ? 18 : 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.86 : 1,
        shadowColor: theme.shadow.color,
        shadowOpacity: theme.mode === 'dark' ? 0.26 : 0.10,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      })}
    >
      <Image
        source={{ uri: banner.imageUrl }}
        resizeMode="cover"
        accessibilityLabel={t('sponsor.label')}
        onError={() => setBanner(null)}
        style={{ width: '100%', height: '100%' }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 9,
          ...(isRTL ? { right: 9 } : { left: 9 }),
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: labelBackground,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 10,
            fontWeight: '900',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {t('sponsor.label')}
        </Text>
        <Feather name="external-link" size={12} color={theme.colors.primaryGlow} />
      </View>
    </Pressable>
  );
}
