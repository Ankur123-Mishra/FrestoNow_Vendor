import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export function getWindow() {
  return Dimensions.get('window');
}

export function scale(size: number) {
  const { width } = getWindow();
  return PixelRatio.roundToNearestPixel((width / BASE_WIDTH) * size);
}

export function verticalScale(size: number) {
  const { height } = getWindow();
  return PixelRatio.roundToNearestPixel((height / BASE_HEIGHT) * size);
}

export function moderateScale(size: number, factor = 0.4) {
  return size + (scale(size) - size) * factor;
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isSmall = width < 360;
  const contentMaxWidth = isTablet ? 720 : width;
  const horizontalPad = isTablet ? 32 : 16;
  const columns = isTablet ? 3 : 2;

  return {
    width,
    height,
    isTablet,
    isSmall,
    contentMaxWidth,
    horizontalPad,
    columns,
    font: (size: number) => moderateScale(size),
    space: (size: number) => moderateScale(size, 0.3),
  };
}
