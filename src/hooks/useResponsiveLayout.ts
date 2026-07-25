import { Platform, useWindowDimensions } from 'react-native';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isTinyPhone = width < 360;
  const isPhone = width < 600;
  const isTablet = width >= 600 && (!isWeb || width < 900);
  const isDesktop = isWeb && width >= 900;
  const isLargeDesktop = isWeb && width >= 1440;
  const sidebarWidth = isDesktop ? (width < 1100 ? 212 : 236) : 0;
  const contentViewportWidth = Math.max(280, width - sidebarWidth);
  const horizontalPadding = isTinyPhone ? 10 : isPhone ? 14 : isTablet ? 20 : contentViewportWidth < 900 ? 20 : contentViewportWidth < 1180 ? 24 : 30;
  const contentMaxWidth = isLargeDesktop ? 1280 : isDesktop ? 1160 : isTablet ? 860 : undefined;

  return {
    width,
    height,
    isWeb,
    isTinyPhone,
    isPhone,
    isTablet,
    isDesktop,
    isLargeDesktop,
    sidebarWidth,
    contentViewportWidth,
    horizontalPadding,
    contentMaxWidth,
  };
}
