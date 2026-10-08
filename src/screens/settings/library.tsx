import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronDown, MapPin } from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { useSubsonic } from '../../contexts/subsonic-context'
import { useAppSetup } from '../../contexts/app-setup-context'
import { Menu, List, Switch } from 'react-native-paper'
import { COUNTRIES } from '../../utils/countries'

function LibrarySettingsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { theme: { colors } } = useAppTheme()
  const { subsonicEnabled, setSubsonicEnabled } = useSubsonic()
  const { selectedCountry, setSelectedCountry } = useAppSetup()
  const [countryMenuVisible, setCountryMenuVisible] = useState(false)

  const selectedCountryName = useMemo(
    () => COUNTRIES.find(country => country.code === selectedCountry)?.name,
    [selectedCountry],
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
          alignItems: 'flex-start',
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
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 16,
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
        selectRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 16,
          paddingHorizontal: 16,
        },
        selectButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        selectButtonText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        },
      }),
    [colors, insets],
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Library</Text>
      </View>

      <Pressable onPress={() => {
          setSubsonicEnabled(!subsonicEnabled)
        }} android_ripple={{ color: colors.secondLayer }} style={styles.settingRow}
      >
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>Enable Subsonic</Text>
          <Text style={styles.settingSubtitle}>Use Subsonic as a source in your library screens</Text>
        </View>
        <Switch
          value={subsonicEnabled}
          onValueChange={setSubsonicEnabled}
        />
      </Pressable>

      <View style={styles.selectRow}>
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>Station Country</Text>
          <Text style={styles.settingSubtitle}>Country used for local station charts</Text>
        </View>
        <Menu
          visible={countryMenuVisible}
          onDismiss={() => setCountryMenuVisible(false)}
          anchor={
            <Pressable
              onPress={() => setCountryMenuVisible(true)}
              style={styles.selectButton}
            >
              <MapPin size={16} color={colors.textMuted} />
              <Text style={styles.selectButtonText}>
                {selectedCountryName ?? selectedCountry ?? 'Select'}
              </Text>
              <ChevronDown size={16} color={colors.textMuted} />
            </Pressable>
          }
        >
          {COUNTRIES.map(country => (
            <List.Item
              key={country.code}
              title={`${country.emoji} ${country.name}`}
              onPress={() => {
                setSelectedCountry(country.code)
                setCountryMenuVisible(false)
              }}
            />
          ))}
        </Menu>
      </View>
    </View>
  )
}

export default LibrarySettingsScreen
