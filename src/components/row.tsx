import { View, Pressable } from 'react-native';
import { useAppTheme } from '../contexts/theme-context';

function Row({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  }) {
  const { theme: { colors } } = useAppTheme();
  return (
    <View style={{ overflow: 'hidden' }}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 18,
          gap: 16,
        }}
      >
        {children}
      </Pressable>
    </View>
  );
}

export default Row;
