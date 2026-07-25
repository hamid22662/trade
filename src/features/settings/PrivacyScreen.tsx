import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BackButton, Card, Screen, SectionHeading, Title } from '@/components/ui';
import { useApp } from '@/context/AppContext';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { theme, isRTL } = useApp();
  const navigation = useNavigation<any>();
  const textAlign = isRTL ? 'right' as const : 'left' as const;
  const bodyStyle = {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700' as const,
    lineHeight: 23,
    textAlign,
    writingDirection: isRTL ? 'rtl' as const : 'ltr' as const,
  };

  return (
    <Screen maxContentWidth={760}>
      <BackButton onPress={() => navigation.goBack()} label={t('common.back')} />
      <Title eyebrow="TradeLog" subtitle={t('privacy.subtitle')}>{t('privacy.title')}</Title>

      <Card elevated>
        <SectionHeading title={t('privacy.localTitle')} icon="shield" />
        <Text style={bodyStyle}>{t('privacy.localBody')}</Text>
      </Card>

      <Card>
        <SectionHeading title={t('privacy.noCollectionTitle')} icon="hard-drive" />
        <Text style={bodyStyle}>{t('privacy.noCollectionBody')}</Text>
      </Card>

      <View
        style={{
          borderWidth: 1,
          borderColor: theme.colors.info,
          backgroundColor: theme.colors.infoSoft,
          borderRadius: 24,
          padding: 18,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 9,
            marginBottom: 10,
          }}
        >
          <Feather name="info" size={18} color={theme.colors.info} />
          <Text style={{ color: theme.colors.info, fontSize: 14, fontWeight: '900', textAlign }}>
            {t('privacy.futureAdsTitle')}
          </Text>
        </View>
        <Text style={bodyStyle}>{t('privacy.futureAdsBody')}</Text>
      </View>

      <Text
        style={{
          color: theme.colors.textSubtle,
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 19,
          textAlign,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {t('privacy.backupNote')}
      </Text>
    </Screen>
  );
}
