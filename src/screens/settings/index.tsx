import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import { useAppTheme } from '../../contexts/theme-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Library, LogOut, Palette, AudioLines, Upload, HardDrive, Info } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Row from '../../components/row';
import AppearanceSettingsScreen from './appearance';
import subsonicService from '../../utils/subsonic';
import { useSubsonic } from '../../contexts/subsonic-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibrarySettingsScreen from './library';
import AudioSettingsScreen from './audio';
import MusicTransfer from './music-transfer';
import NaviloadSettingsScreen from './naviload';
import TransferReview from './transfer-review';
import StorageSettingsScreen from './storage';
import AboutSettingsScreen from './about';

function SettingsScreen() {
  const {
    theme: { colors },
  } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { loggedIn, subsonicEnabled } = useSubsonic();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        title: {
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
        },
        listContent: {
          paddingBottom: insets.bottom + 140,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          marginRight: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
      }),
    [colors, insets],
  );

  return (
    <View style={styles.container}>
      <View
        style={{
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 16,
          marginHorizontal: 16,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <Row onPress={() => navigation.navigate('Appearance' as never)}>
        <Palette size={20} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 18 }}>Appearance</Text>
      </Row>
      <Row onPress={() => navigation.navigate('Library' as never)}>
        <Library size={20} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 18 }}>Library</Text>
      </Row>
      <Row onPress={() => navigation.navigate('Audio' as never)}>
        <AudioLines size={20} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 18 }}>Playback</Text>
      </Row>
      {subsonicEnabled && (
        <>
          <Row onPress={() => navigation.navigate('Storage' as never)}>
            <HardDrive size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 18 }}>Storage</Text>
          </Row>
          <Row onPress={() => navigation.navigate('Naviload' as never)}>
            <Upload size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 18 }}>Naviload</Text>
          </Row>
        </>
      )}
      {subsonicEnabled && loggedIn && (
        <Row
          onPress={() => {
            navigation.navigate('MusicTransfer' as never);
          }
        }>
          <Library size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 18 }}>
            Transfer Your Library
          </Text>
        </Row>
      )}
      <Row onPress={() => navigation.navigate('About' as never)}>
        <Info size={20} color={colors.text} />
        <Text style={{ color: colors.text, fontSize: 18 }}>About</Text>
      </Row>
      {subsonicEnabled && (
        <Row
          onPress={() => {
            if (loggedIn) {
              subsonicService.clearCredentials();
            } else {
              navigation.getParent()?.navigate('Login' as never);
            }
          }}
        >
          <LogOut
            size={20}
            color={loggedIn ? colors.notification : colors.text}
          />
          <Text
            style={{
              color: loggedIn ? colors.notification : colors.text,
              fontSize: 18,
            }}
          >
            {loggedIn ? 'Log Out' : 'Log In'}
          </Text>
        </Row>
      )}
    </View>
  );
}

const SettingsStackNavigator = createNativeStackNavigator();

function SettingsNavigator() {
  return (
    <SettingsStackNavigator.Navigator
      screenOptions={{
        header: () => null,
      }}
    >
      <SettingsStackNavigator.Screen name="Main" component={SettingsScreen} />
      <SettingsStackNavigator.Screen
        name="Appearance"
        component={AppearanceSettingsScreen}
      />
      <SettingsStackNavigator.Screen
        name="Library"
        component={LibrarySettingsScreen}
      />
      <SettingsStackNavigator.Screen
        name="Audio"
        component={AudioSettingsScreen}
      />
      <SettingsStackNavigator.Screen
        name="Storage"
        component={StorageSettingsScreen}
      />
      <SettingsStackNavigator.Screen
        name="Naviload"
        component={NaviloadSettingsScreen}
      />
      <SettingsStackNavigator.Screen
        name="MusicTransfer"
        component={MusicTransfer}
      />
      <SettingsStackNavigator.Screen
        name="TransferReview"
        component={TransferReview}
      />
      <SettingsStackNavigator.Screen
        name="About"
        component={AboutSettingsScreen}
      />
    </SettingsStackNavigator.Navigator>
  );
}

export default SettingsNavigator;
