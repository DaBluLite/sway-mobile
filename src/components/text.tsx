import { Text, Platform } from 'react-native';

const FONT_MAP: { [key: string]: string } = {
  '400': 'Inter-Regular',
  'normal': 'Inter-Regular',
  '500': 'Inter-Medium',
  '600': 'Inter-SemiBold',
  '700': 'Inter-Bold',
  'bold': 'Inter-Bold',
};

export default function AppText({ style, ...props }: React.ComponentProps<typeof Text>) {
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style || {};
  const weight = flatStyle.fontWeight || '400';
  const fontFamily = FONT_MAP[String(weight)] || 'Inter-Regular';

  return (
    <Text
      {...props}
      style={[
        style,
        { fontFamily },
        // Prevent Android from also trying to fake-bold the mapped font
        Platform.OS === 'android' ? { fontWeight: 'normal' } : null,
      ]}
    />
  );
}
