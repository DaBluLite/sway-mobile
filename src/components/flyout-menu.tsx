import {
  createContext,
  ForwardRefExoticComponent,
  RefAttributes,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { EllipsisVertical, LucideProps } from 'lucide-react-native';
import { useAppTheme } from '../contexts/theme-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import Text from './text';

export interface FlyoutAction {
  id: string;
  label: string;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>
}

interface FlyoutOptions {
  title?: string;
  subtitle?: string;
  coverUrl?: string;
  actions: FlyoutAction[];
}

interface FlyoutContextValue {
  openFlyout: (options: FlyoutOptions) => void;
  closeFlyout: () => void;
}

const FlyoutContext = createContext<FlyoutContextValue | undefined>(undefined);

export const FlyoutProvider = ({ children }: { children: ReactNode }) => {
  const {
    theme: { colors, shadows },
  } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<FlyoutOptions | null>(null);
  const [renderFlyout, setRenderFlyout] = useState(false);
  const insets = useSafeAreaInsets();
  const [sheetHeight, setSheetHeight] = useState(0);

  // Start off-screen so the first frame doesn't flash at y=0 before
  // onLayout measures. Avoiding the 0 -> sheetHeight reset that caused
  // the split-second pop-in.
  const translateY = useSharedValue(9999);
  const backdropOpacity = useSharedValue(0);
  const sheetOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Track whether the sheet is logically open so height changes while
  // swapping content (open album A -> open album B) don't re-trigger the
  // enter animation. Previously `sheetHeight` in deps caused
  // `translateY = sheetHeight -> withTiming(0)` on every height change,
  // flashing the sheet off-screen between swaps.
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      if (!renderFlyout) return;
      if (sheetHeight === 0) return;
      if (!wasOpenRef.current) {
        // Closed -> open: animate in with ease-out and opacity fade.
        // If we interrupt a close animation, translateY is mid-flight
        // (~0..sheetHeight) and backdrop is ~1. Jumping to sheetHeight/0
        // would flash, so only force a reset on cold start (9999) or when
        // fully closed.
        const isColdStart = translateY.value === 9999 || Math.abs(translateY.value - sheetHeight) < 2;
        if (isColdStart) {
          translateY.value = sheetHeight;
          backdropOpacity.value = 0;
          sheetOpacity.value = 0;
        }
        translateY.value = withTiming(0, {
          duration: 320,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, {
          duration: 260,
          easing: Easing.out(Easing.quad),
        });
        sheetOpacity.value = withTiming(1, {
          duration: 260,
          easing: Easing.out(Easing.quad),
        });
        wasOpenRef.current = true;
      }
      // else: already open and sheetHeight changed due to new options
      // (e.g. switching albums) -> keep translateY at 0 and opacity at 1,
      // no flash. Height grows via layout, not translation.
    } else if (renderFlyout) {
      if (!wasOpenRef.current) return;
      wasOpenRef.current = false;
      if (sheetHeight === 0) {
        // No height yet (quick close before layout) -> just unmount
        setRenderFlyout(false);
        return;
      }
      backdropOpacity.value = withTiming(0, {
        duration: 180,
        easing: Easing.in(Easing.quad),
      });
      sheetOpacity.value = withTiming(0, {
        duration: 160,
        easing: Easing.in(Easing.quad),
      });
      translateY.value = withTiming(sheetHeight, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      }, finished => {
        if (finished) scheduleOnRN(setRenderFlyout, false);
      });
    } else {
      wasOpenRef.current = false;
    }
  }, [open, renderFlyout, sheetHeight, backdropOpacity, sheetOpacity, translateY]);

  const closeFlyout = useCallback(() => {
    setOpen(false);
  }, []);

  const openFlyout = useCallback((nextOptions: FlyoutOptions) => {
    setOptions(nextOptions);
    // Mount the Modal synchronously before flipping `open` so the sheet
    // has a height to animate from. Previously `setRenderFlyout(true)`
    // was inside effects watching `open`, adding a one-frame delay where
    // `translateY` was reset to 0 then jumped to sheetHeight.
    setRenderFlyout(true);
    setOpen(true);
  }, []);

  const handlePressAction = useCallback(
    (action: FlyoutAction) => {
      if (action.disabled) {
        return;
      }

      closeFlyout();
      setTimeout(() => {
        Promise.resolve(action.onPress()).catch(error => {
          console.warn('Flyout action failed', error);
        });
      }, 100);
    },
    [closeFlyout],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalRoot: {
          flex: 1,
          justifyContent: 'flex-end',
          paddingBottom: insets.bottom + 4,
          paddingHorizontal: 8
        },
        backdrop: {
          ...StyleSheet.absoluteFill,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        },
        sheet: {
          paddingTop: 4,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.subtle,
          boxShadow: shadows.floating,
        },
        header: {
          padding: 16,
          borderBottomWidth: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomColor: colors.secondLayerThin,
        },
        title: {
          color: colors.text,
          fontSize: 16,
          minWidth: 0,
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 4,
        },
        action: {
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        },
        actionLast: {
          borderBottomWidth: 0,
        },
        actionLabel: {
          color: colors.text,
          fontSize: 15,
        },
        actionLabelDestructive: {
          color: colors.notification,
        },
        actionDisabled: {
          opacity: 0.45,
        },
      }),
    [
      colors,
      insets,
      shadows
    ],
  );

  const contextValue = useMemo(
    () => ({ openFlyout, closeFlyout }),
    [openFlyout, closeFlyout],
  );

  return (
    <FlyoutContext.Provider value={contextValue}>
      {children}
      <Modal
        transparent
        visible={renderFlyout && Boolean(options)}
        animationType="none"
        onRequestClose={closeFlyout}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeFlyout} />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              // Keep the sheet hidden until we have a real measurement;
              // otherwise translateY=9999 is already off-screen so this
              // only avoids a 1-frame 0-height flash on mount.
              sheetHeight === 0 && { opacity: 0 },
            ]}
            onLayout={e => {
              const h = e.nativeEvent.layout.height;
              if (h && h !== sheetHeight) setSheetHeight(h);
            }}
          >
            {options?.title || options?.subtitle || options?.coverUrl ? (
              <View style={styles.header}>
                {options?.coverUrl ? (
                  <Image
                    source={{ uri: options.coverUrl }}
                    style={{ width: 48, height: 48, borderRadius: 4 }}
                  />
                ) : null}
                <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  {options?.title ? (
                    <Text numberOfLines={1} style={styles.title}>
                      {options.title}
                    </Text>
                  ) : null}
                  {options?.subtitle ? (
                    <Text numberOfLines={2} style={styles.subtitle}>
                      {options.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {options?.actions.map((action, index) => (
              <Pressable
                key={action.id}
                onPress={() => handlePressAction(action)}
                android_ripple={{ color: colors.secondLayerThin }}
                disabled={action.disabled}
                style={[
                  styles.action,
                  index === options.actions.length - 1 && styles.actionLast,
                  action.disabled && styles.actionDisabled,
                ]}
              >
                {action.icon && (
                  <action.icon opacity={0.8} color={colors.text} size={24}/>
                )}
                <Text
                  style={[
                    styles.actionLabel,
                    action.destructive && styles.actionLabelDestructive,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </Modal>
    </FlyoutContext.Provider>
  );
};

export const useFlyout = (): FlyoutContextValue => {
  const context = useContext(FlyoutContext);
  if (!context) {
    throw new Error('useFlyout must be used within FlyoutProvider');
  }

  return context;
};

export const FlyoutTrigger = ({
  onPress,
  hitSlop = 10,
}: {
  onPress: () => void;
  hitSlop?: number;
}) => {
  const {
    theme: { colors },
  } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [],
  );

  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onPress();
  };

  return (
    <View style={{ marginLeft: 8, borderRadius: 18, overflow: 'hidden' }}>
      <Pressable
        android_ripple={{ color: colors.secondLayerThin }}
        hitSlop={hitSlop}
        onPress={handlePress}
        style={styles.button}
      >
        <EllipsisVertical size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
};
