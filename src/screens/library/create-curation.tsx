import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { useCurations } from '../../contexts/curations-context'
import { useFavourites } from '../../contexts/favourites-context'
import TailwindGradientView from '../../components/tailwind-gradient-view'
import { Switch } from 'react-native-paper'

const COLOR_PRESETS = [
  { name: 'Blue', class: 'from-blue-500 to-cyan-500' },
  { name: 'Yellow', class: 'from-yellow-500 to-orange-500' },
  { name: 'Purple', class: 'from-purple-500 to-indigo-500' },
  { name: 'Pink', class: 'from-pink-500 to-red-500' },
  { name: 'Amber', class: 'from-amber-600 to-yellow-600' },
  { name: 'Green', class: 'from-green-500 to-teal-500' },
  { name: 'Slate', class: 'from-slate-600 to-gray-800' },
  { name: 'Red', class: 'from-red-500 to-orange-500' }
]

const EMOJI_PRESETS = ['🌊', '☀️', '📚', '🎉', '🎷', '🌍', '🌙', '💪', '🎸', '🎹', '☕', '🏢']

function CreateCurationScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { theme: { colors } } = useAppTheme()
  const { collections, createCollection } = useCurations()
  const { favourites } = useFavourites()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🎵')
  const [color, setColor] = useState('from-blue-500 to-cyan-500')
  const [featured, setFeatured] = useState(false)
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 4,
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
          paddingBottom: insets.bottom + 200,
        },
        fieldLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8,
          marginTop: 12,
          marginHorizontal: 16,
        },
        input: {
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          backgroundColor: colors.secondLayerThin,
        },
        multilineInput: {
          minHeight: 90,
          textAlignVertical: 'top',
        },
        helperText: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 6,
          lineHeight: 18,
          paddingHorizontal: 16,
        },
        presetGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginHorizontal: 16,
        },
        iconPresetButton: {
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondLayerThin,
          borderWidth: 1,
          borderColor: colors.faint,
        },
        iconPresetButtonActive: {
          borderColor: colors.primary,
          backgroundColor: `${colors.primary}22`,
        },
        iconPresetText: {
          fontSize: 21,
        },
        colorPresetButton: {
          width: '48%',
          minHeight: 56,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.faint,
          overflow: 'hidden',
        },
        colorPresetButtonActive: {
          borderColor: colors.primary,
          borderWidth: 2,
        },
        colorPresetLabel: {
          color: '#ffffff',
          fontSize: 12,
          fontWeight: '700',
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        colorPresetLabelWrap: {
          flex: 1,
          paddingHorizontal: 10,
          paddingVertical: 8,
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
        },
        selectedPreview: {
          marginTop: 12,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.faint,
          minHeight: 86,
        },
        selectedPreviewInner: {
          paddingHorizontal: 12,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        selectedPreviewIcon: {
          fontSize: 26,
        },
        selectedPreviewTitle: {
          color: '#ffffff',
          fontSize: 14,
          fontWeight: '700',
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        selectedPreviewSubtitle: {
          color: '#ffffff',
          opacity: 0.9,
          fontSize: 12,
          marginTop: 2,
          textShadowColor: 'rgba(0,0,0,0.25)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        toggleRow: {
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.secondLayerThin,
        },
        toggleLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        },
        stationsHeader: {
          marginTop: 16,
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          paddingHorizontal: 16,
        },
        stationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
          paddingHorizontal: 16,
        },
        stationName: {
          color: colors.text,
          fontSize: 14,
          flex: 1,
        },
        stationTag: {
          color: colors.textMuted,
          fontSize: 12,
        },
        selectedBadge: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '700',
        },
        createButton: {
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 64,
          borderColor: '#97979F0A',
          borderWidth: 1,
          backgroundColor: 'rgba(34, 197, 94, 0.24)',
        },
        createButtonText: {
          color: '#ffffff',
          fontSize: 15,
          fontWeight: '700',
        },
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
          paddingHorizontal: 16,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        settingTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        settingSubtitle: {
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 3,
        },
      }),
    [colors, insets],
  )

  const toggleStation = (stationId: string) => {
    setSelectedStationIds((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId],
    )
  }

  const handleCreate = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      Alert.alert('Curation name required', 'Please enter a curation name.')
      return
    }

    const selectedStations = favourites.filter((station) => selectedStationIds.includes(station.id))

    createCollection({
      name: trimmedName,
      description: description.trim(),
      icon: icon.trim() || '🎵',
      color: color.trim() || 'from-blue-500 to-cyan-500',
      stations: selectedStations,
      featured,
      order: collections.length,
    })

    navigation.goBack()
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Create Curation</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="My Curation"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What this curation is about"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.multilineInput]}
          multiline
        />

        <Text style={styles.fieldLabel}>Icon</Text>
        <View style={styles.presetGrid}>
          {EMOJI_PRESETS.map((presetIcon) => {
            const selected = icon === presetIcon
            return (
              <Pressable
                key={presetIcon}
                style={[styles.iconPresetButton, selected && styles.iconPresetButtonActive]}
                onPress={() => setIcon(presetIcon)}
              >
                <Text style={styles.iconPresetText}>{presetIcon}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.fieldLabel}>Color</Text>
        <View style={styles.presetGrid}>
          {COLOR_PRESETS.map((preset) => {
            const selected = color === preset.class
            return (
              <Pressable
                key={preset.class}
                style={[styles.colorPresetButton, selected && styles.colorPresetButtonActive]}
                onPress={() => setColor(preset.class)}
              >
                <TailwindGradientView gradientClass={preset.class} style={{ flex: 1 }}>
                  <View style={styles.colorPresetLabelWrap}>
                    <Text style={styles.colorPresetLabel}>{preset.name}</Text>
                  </View>
                </TailwindGradientView>
              </Pressable>
            )
          })}
        </View>

        <Pressable onPress={() => {
          setFeatured(!featured)
        }} android_ripple={{ color: colors.secondLayer }} style={styles.settingRow}>
          <View style={styles.textWrap}>
            <Text style={styles.settingTitle}>Featured</Text>
          </View>
          <Switch
            value={featured}
            onValueChange={setFeatured}
          />
        </Pressable>

        <Text style={styles.stationsHeader}>Initial Stations</Text>
        <Text style={styles.helperText}>Select from favourites to include stations at creation.</Text>
        {favourites.map((station) => {
          const selected = selectedStationIds.includes(station.id)
          return (
            <Pressable key={station.id} style={styles.stationRow} onPress={() => toggleStation(station.id)}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.stationName}>{station.name}</Text>
                <Text numberOfLines={1} style={styles.stationTag}>{station.tags.join(', ')}</Text>
              </View>
              {selected ? <Text style={styles.selectedBadge}>SELECTED</Text> : null}
            </Pressable>
          )
        })}

        <View style={{ overflow: 'hidden', borderRadius: 64, marginHorizontal: 16, marginTop: 24 }}>
          <Pressable android_ripple={{ color: 'rgba(34, 197, 94, 0.4)' }} onPress={handleCreate} style={styles.createButton}>
            <Text style={styles.createButtonText}>Create Curation</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

export default CreateCurationScreen
