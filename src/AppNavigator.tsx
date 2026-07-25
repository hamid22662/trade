import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import DashboardScreen from '@/features/dashboard/DashboardScreen';
import NewTradeScreen from '@/features/trades/NewTradeScreen';
import TradeListScreen from '@/features/trades/TradeListScreen';
import TradeDetailScreen from '@/features/trades/TradeDetailScreen';
import CloseTradeScreen from '@/features/trades/CloseTradeScreen';
import EditTradeScreen from '@/features/trades/EditTradeScreen';
import AnalyticsScreen from '@/features/analytics/AnalyticsScreen';
import CalculatorScreen from '@/features/calculator/CalculatorScreen';
import SettingsScreen from '@/features/settings/SettingsScreen';
import OnboardingScreen from '@/features/settings/OnboardingScreen';
import PrivacyScreen from '@/features/settings/PrivacyScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
  Dashboard: 'grid',
  NewTrade: 'plus-circle',
  Trades: 'list',
  Analytics: 'bar-chart-2',
  Calculator: 'sliders',
  Settings: 'settings',
};

function Tabs() {
  const { t } = useTranslation();
  const { theme, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const { isDesktop, width, sidebarWidth } = useResponsiveLayout();
  const compactPhone = width < 390;
  const screens = [
    ['Dashboard', DashboardScreen, t('tabs.dashboard')],
    ['NewTrade', NewTradeScreen, t('tabs.newTrade')],
    ['Trades', TradeListScreen, t('tabs.trades')],
    ['Analytics', AnalyticsScreen, t('tabs.analytics')],
    ['Calculator', CalculatorScreen, t('tabs.calculator')],
    ['Settings', SettingsScreen, t('tabs.settings')],
  ] as const;

  const nativeShadow = Platform.OS === 'web'
    ? ({ boxShadow: isDesktop ? `${isRTL ? '-8px' : '8px'} 0 30px rgba(0,0,0,0.16)` : '0 -8px 28px rgba(0,0,0,0.22)' } as any)
    : {
        elevation: 26,
        shadowColor: '#000',
        shadowOpacity: 0.24,
        shadowRadius: 22,
        shadowOffset: { width: isDesktop ? (isRTL ? -8 : 8) : 0, height: isDesktop ? 0 : 10 },
      };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        // The navigator row already follows document direction. Its first child is
        // physically right in RTL and physically left in LTR, so do not mirror it twice.
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarLabelPosition: isDesktop ? 'beside-icon' : 'below-icon',
        tabBarStyle: isDesktop ? {
          position: 'relative',
          width: sidebarWidth,
          height: '100%',
          paddingTop: 28,
          paddingBottom: 28,
          paddingHorizontal: 12,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          borderRightWidth: isRTL ? 0 : 1,
          borderLeftWidth: isRTL ? 1 : 0,
          borderColor: theme.colors.border,
          ...nativeShadow,
        } : {
          position: 'absolute',
          left: compactPhone ? 6 : 12,
          right: compactPhone ? 6 : 12,
          bottom: 8,
          height: 66 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 9,
          paddingHorizontal: compactPhone ? 2 : 8,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderWidth: 1,
          borderTopColor: theme.colors.border,
          borderColor: theme.colors.border,
          borderRadius: compactPhone ? 24 : 30,
          ...nativeShadow,
        },
        tabBarItemStyle: isDesktop
          ? { minHeight: 58, maxHeight: 58, borderRadius: 18, marginVertical: 3, paddingHorizontal: 8 }
          : { borderRadius: 18, paddingVertical: 2, minWidth: 0 },
        tabBarActiveBackgroundColor: isDesktop ? theme.colors.primarySoft : 'transparent',
        tabBarActiveTintColor: isDesktop ? theme.colors.primaryGlow : '#FFFFFF',
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarLabelStyle: isDesktop
          ? { fontSize: 13, fontWeight: '900', marginHorizontal: 8, textAlign: isRTL ? 'right' : 'left' }
          : { fontSize: compactPhone ? 8 : 10, fontWeight: '900', marginTop: 2 },
        tabBarIconStyle: isDesktop ? { marginHorizontal: 2 } : undefined,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarIcon: ({ color, focused }) => (
          <View
            style={{
              width: isDesktop ? 38 : focused ? 36 : 28,
              height: isDesktop ? 38 : 30,
              borderRadius: isDesktop ? 13 : 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? theme.colors.primary : 'transparent',
              borderWidth: focused ? 1 : 0,
              borderColor: focused ? theme.colors.primaryGlow : 'transparent',
            }}
          >
            <Feather name={iconMap[route.name] ?? 'circle'} color={focused ? '#FFFFFF' : color} size={focused ? 18 : 20} />
          </View>
        ),
      })}
    >
      {screens.map(([name, component, title]) => <Tab.Screen key={name} name={name} component={component} options={{ tabBarLabel: title, title }} />)}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { theme, ready, onboarded, isRTL } = useApp();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
      notification: theme.colors.primary,
    },
  };
  return (
    <NavigationContainer theme={navigationTheme} direction={isRTL ? 'rtl' : 'ltr'}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: isRTL ? 'slide_from_left' : 'slide_from_right' }}>
        {!onboarded ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="TradeDetail" component={TradeDetailScreen} />
          <Stack.Screen name="CloseTrade" component={CloseTradeScreen} />
          <Stack.Screen name="EditTrade" component={EditTradeScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
        </>}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
