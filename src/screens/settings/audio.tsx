import * as React from 'react'
import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { Switch } from 'react-native-paper'
import { useAudioPlayer } from '../../contexts/audio-player-context'

function AudioSettingsScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { theme: { colors } } = useAppTheme()
  const { updateSettings, gaplessEnabled, autoplayEnabled, exclusiveEnabled, bitPerfectEnabled, audioDevice, getAudioDevices } = useAudioPlayer()
  const [usbDevices, setUsbDevices] = React.useState<{id:string,name:string}[]>([])
  React.useEffect(()=>{ getAudioDevices().then(setUsbDevices).catch(()=>undefined) }, [getAudioDevices])

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
      }),
    [colors, insets],
  )

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Playback</Text>
      </View>

      <Pressable onPress={() => {
        updateSettings({ gaplessEnabled: !gaplessEnabled })
      }} android_ripple={{ color: colors.secondLayer }} style={styles.settingRow}>
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>Gapless Playback</Text>
          <Text style={styles.settingSubtitle}>Remove silence between tracks</Text>
        </View>
        <Switch
          value={gaplessEnabled}
          onValueChange={e => updateSettings({ gaplessEnabled: e })}
        />
      </Pressable>

      <Pressable onPress={() => {
        updateSettings({ autoplayEnabled: !autoplayEnabled })
      }} android_ripple={{ color: colors.secondLayer }} style={styles.settingRow}>
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>Autoplay</Text>
          <Text style={styles.settingSubtitle}>Fill the queue with similar songs when playback ends</Text>
        </View>
        <Switch
          value={autoplayEnabled}
          onValueChange={e => updateSettings({ autoplayEnabled: e })}
        />
      </Pressable>

      <Pressable onPress={() => updateSettings({ exclusiveEnabled: !exclusiveEnabled })} android_ripple={{ color: colors.secondLayer }} style={styles.settingRow}>
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>USB Exclusive Mode</Text>
          <Text style={styles.settingSubtitle}>Request exclusive access to USB DAC (bypass Android mixer/EQ)</Text>
        </View>
        <Switch value={exclusiveEnabled} onValueChange={e => updateSettings({ exclusiveEnabled: e })} />
      </Pressable>

      <Pressable onPress={() => updateSettings({ bitPerfectEnabled: !bitPerfectEnabled })} android_ripple={{ color: colors.secondLayer }} style={[styles.settingRow, !exclusiveEnabled && {opacity:0.5}]} disabled={!exclusiveEnabled}>
        <View style={styles.textWrap}>
          <Text style={styles.settingTitle}>Bit-Perfect Playback</Text>
          <Text style={styles.settingSubtitle}>Match sample rate & bit depth to current track (best effort)</Text>
        </View>
        <Switch value={bitPerfectEnabled} onValueChange={e => updateSettings({ bitPerfectEnabled: e })} disabled={!exclusiveEnabled} />
      </Pressable>

      {exclusiveEnabled && usbDevices.length > 0 && (
        <View style={{padding:16}}>
          <Text style={styles.settingTitle}>USB Device</Text>
          {usbDevices.map(d=> (
            <Pressable key={d.id} onPress={()=> updateSettings({ audioDevice: d.id })} style={{paddingVertical:8, flexDirection:'row', justifyContent:'space-between'}}>
              <Text style={{color: audioDevice===d.id ? colors.primary : colors.text}}>{d.name}</Text>
              {audioDevice===d.id && <Text style={{color:colors.primary}}>●</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

export default AudioSettingsScreen
