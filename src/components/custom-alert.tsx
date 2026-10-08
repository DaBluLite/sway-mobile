/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from './text'
import { useAppTheme } from '../contexts/theme-context'
import {
  Alert,
  getSnapshot,
  setAlertInputValue,
  subscribe,
  type AlertButton,
  type AlertButtonStyle,
  type AlertOptions,
  type AlertPromptType,
  type AlertPromptKeyboardType,
} from './custom-alert-api'
export type { AlertButton, AlertButtonStyle, AlertOptions, AlertPromptType, AlertPromptKeyboardType } from './custom-alert-api'

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const {
    theme: { colors, shadows },
  } = useAppTheme()
  const alert = useSyncExternalStore(subscribe, getSnapshot)

  const dismiss = useCallback(() => {
    Alert.dismiss()
    alert.options?.onDismiss?.()
  }, [alert.options])

  const handleBackdropPress = useCallback(() => {
    if (alert.options?.cancelable !== false) {
      dismiss()
    }
  }, [alert.options, dismiss])

  const handleButtonPress = useCallback(
    (button: AlertButton) => {
      Alert.dismiss()
      button.onPress?.(alert.inputValue)
    },
    [alert.inputValue],
  )

  const handleChangeInput = useCallback((text: string) => {
    setAlertInputValue(text)
  }, [])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        modalRoot: {
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        },
        panel: {
          alignSelf: 'center',
          width: '100%',
          maxWidth: 320,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.subtle,
          backgroundColor: colors.background,
          padding: 16,
          boxShadow: shadows.floating,
        },
        title: {
          color: colors.text,
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
        },
        message: {
          color: colors.textMuted,
          fontSize: 15,
          marginTop: 6,
          textAlign: 'center',
          lineHeight: 20,
        },
        input: {
          marginTop: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          backgroundColor: colors.background,
          fontSize: 15,
        },
        actions: {
          marginTop: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.subtle,
          backgroundColor: colors.secondLayerThin,
          overflow: 'hidden',
        },
        action: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
        },
        actionDivider: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.secondLayerThin,
        },
        actionLabel: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        actionLabelDestructive: {
          color: colors.notification,
        },
        actionLabelCancel: {
          fontWeight: '700',
        },
      }),
    [colors, shadows.floating],
  )

  return (
    <>
      {children}
      <Modal
        transparent
        visible={alert.visible}
        animationType="fade"
        onRequestClose={handleBackdropPress}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          <View style={styles.panel}>
            <Text style={styles.title}>{alert.title}</Text>
            {alert.message ? (
              <Text style={styles.message}>{alert.message}</Text>
            ) : null}
            {alert.showInput ? (
              <TextInput
                autoFocus
                value={alert.inputValue}
                onChangeText={handleChangeInput}
                secureTextEntry={
                  alert.promptType === 'secure-text' ||
                  alert.promptType === 'login-password'
                }
                placeholderTextColor={colors.textMuted}
                keyboardType={alert.keyboardType}
                style={styles.input}
              />
            ) : null}
            <View style={styles.actions}>
              {alert.buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive'
                const isCancel = button.style === 'cancel'
                const isLast = index === alert.buttons.length - 1
                return (
                  <Pressable
                    key={button.text ?? `alert-btn-${alert.buttons.indexOf(button)}`}
                    onPress={() => handleButtonPress(button)}
                    android_ripple={{ color: colors.secondLayerThin }}
                    style={[styles.action, !isLast && styles.actionDivider]}
                  >
                    <Text
                      style={[
                        styles.actionLabel,
                        isDestructive && styles.actionLabelDestructive,
                        isCancel && styles.actionLabelCancel,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}
