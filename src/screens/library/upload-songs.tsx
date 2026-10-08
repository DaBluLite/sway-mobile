import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text'
import { pick } from '@react-native-documents/picker'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronLeft,
  CloudUpload,
  FileAudio,
  FolderInput,
  Trash2,
  Upload,
} from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { getItem, STORES } from '../../utils/storage'
import { uploadFiles, PickedFile } from '../../utils/naviload'

function UploadSongsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { theme: { colors } } = useAppTheme()

  const [files, setFiles] = useState<PickedFile[]>([])
  const [subdir, setSubdir] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const haveCredentials = useMemo(
    () =>
      !!getItem<string>(STORES.NAVILOAD_CREDENTIALS, 'url') &&
      !!getItem<string>(STORES.NAVILOAD_CREDENTIALS, 'password'),
    [],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          marginHorizontal: 16,
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          marginRight: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        title: {
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
        },
        content: {
          paddingHorizontal: 16,
        },
        label: {
          color: colors.textMuted,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 6,
          marginTop: 16,
        },
        inputWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 12,
          backgroundColor: colors.secondLayerThin,
        },
        input: {
          flex: 1,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 12,
        },
        hint: {
          color: colors.notification,
          fontSize: 13,
          marginTop: 8,
        },
        pickerButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
          marginTop: 16,
        },
        pickerButtonText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        fileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
        },
        fileIcon: {
          padding: 6,
          borderRadius: 8,
          backgroundColor: colors.secondLayerThin,
        },
        fileTextWrap: {
          flex: 1,
          minWidth: 0,
        },
        fileTitle: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '500',
        },
        fileSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 2,
        },
        fileRemove: {
          padding: 6,
        },
        uploadButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          marginTop: 20,
          marginBottom: 8,
        },
        uploadButtonDisabled: {
          opacity: 0.4,
        },
        uploadButtonText: {
          color: '#ffffff',
          fontSize: 15,
          fontWeight: '700',
        },
        message: {
          fontSize: 13,
          marginTop: 8,
          textAlign: 'center',
        },
        messageError: {
          color: colors.notification,
        },
        messageSuccess: {
          color: colors.primary,
        },
      }),
    [colors, insets],
  )

  const handlePick = async () => {
    if (!haveCredentials) {
      setError(
        'Naviload credentials are not configured. Add your URL and password in Settings → Naviload first.',
      )
      setResult(null)
      return
    }

    try {
      const picked = await pick({
        allowMultiSelection: true,
        copyTo: 'cachesDirectory',
      })
      const mapped = picked
        .filter(f => f.uri)
        .map(f => ({
          uri: f.uri,
          name: f.name || 'file',
          type: f.type || 'audio/mpeg',
        }))
      if (mapped.length > 0) {
        setFiles(prev => [...prev, ...mapped])
        setError(null)
        setResult(null)
      }
    } catch (e) {
      if ((e as { code?: string })?.code === 'DOCUMENT_PICKER_CANCELED') return
      setError('Failed to pick files.')
      setResult(null)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const res = await uploadFiles(files, subdir.trim())
      setResult(
        `Upload complete: ${res.files.length} file(s) uploaded successfully.`,
      )
      setFiles([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Upload Songs</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!haveCredentials ? (
          <Text style={styles.hint}>
            Naviload credentials are not configured. Add your URL and password
            in Settings → Naviload before uploading.
          </Text>
        ) : null}

        <Pressable
          onPress={handlePick}
          android_ripple={{ color: colors.secondLayer }}
          style={styles.pickerButton}
        >
          <FileAudio size={20} color={colors.text} />
          <Text style={styles.pickerButtonText}>Choose audio files</Text>
        </Pressable>

        <Text style={styles.label}>Subdirectory (optional)</Text>
        <View style={styles.inputWrap}>
          <FolderInput size={18} color={colors.textMuted} />
          <TextInput
            value={subdir}
            onChangeText={setSubdir}
            placeholder="e.g. albums/MyAlbum"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        {files.map((file, index) => (
          <View key={`${file.name}-${file.uri}`} style={styles.fileRow}>
            <View style={styles.fileIcon}>
              <FileAudio size={18} color={colors.text} />
            </View>
            <View style={styles.fileTextWrap}>
              <Text numberOfLines={1} style={styles.fileTitle}>
                {file.name}
              </Text>
            </View>
            <Pressable
              onPress={() => removeFile(index)}
              hitSlop={8}
              style={styles.fileRemove}
            >
              <Trash2 size={18} color={colors.notification} />
            </Pressable>
          </View>
        ))}

        {files.length > 0 ? (
          <Pressable
            onPress={handleUpload}
            disabled={uploading}
            android_ripple={{ color: colors.secondLayer }}
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          >
            {uploading ? (
              <ActivityIndicator color={'#ffffff'} />
            ) : (
              <Upload size={20} color={'#ffffff'} />
            )}
            <Text style={styles.uploadButtonText}>
              {uploading
                ? 'Uploading…'
                : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              alignItems: 'center',
              marginTop: 40,
              paddingHorizontal: 16,
            }}
          >
            <CloudUpload size={24} color={colors.textMuted} />
            <Text
              style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}
            >
              No files selected yet.
            </Text>
          </View>
        )}

        {error ? (
          <Text style={[styles.message, styles.messageError]}>{error}</Text>
        ) : null}
        {result ? (
          <Text style={[styles.message, styles.messageSuccess]}>{result}</Text>
        ) : null}
      </ScrollView>
    </View>
  )
}

export default UploadSongsScreen
