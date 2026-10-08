import { useMemo } from 'react'
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Text from './text'
import { useAppTheme } from '../contexts/theme-context'

interface TextPromptModalProps {
  visible: boolean
  title: string
  value: string
  onChangeValue: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  placeholder?: string
}

function TextPromptModal({
  visible,
  title,
  value,
  onChangeValue,
  onCancel,
  onConfirm,
  confirmLabel = 'Save',
  placeholder,
}: TextPromptModalProps) {
  const { theme: { colors, shadows } } = useAppTheme()

  const styles = useMemo(() => StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    panel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.faint,
      backgroundColor: colors.card,
      padding: 16,
      boxShadow: shadows.floating,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    input: {
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
      marginTop: 14,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    actionButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.faint,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.secondLayerThin,
    },
    actionLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    confirmButton: {
      backgroundColor: colors.text,
    },
    confirmLabel: {
      color: colors.background,
    },
  }), [colors, shadows.floating])

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <View style={styles.panel}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={onChangeValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.actionButton}>
              <Text style={styles.actionLabel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.actionButton, styles.confirmButton]}>
              <Text style={[styles.actionLabel, styles.confirmLabel]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default TextPromptModal
