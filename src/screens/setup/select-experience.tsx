import { Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSetup } from '../../contexts/app-setup-context';
import { useAppTheme } from '../../contexts/theme-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import BlurredSpotsBackground from '../../components/blurred-spots-background';
import { ChevronLeft } from 'lucide-react-native';
import { SetupStackParamList } from '../../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import TouchableScale from '../../components/touchable-scale';
import { useSubsonic } from '../../contexts/subsonic-context';
const SwayOpensub = require('../../../assets/sway-mobile-opensub.png');

type Props = NativeStackScreenProps<SetupStackParamList, 'SelectExperience'>;

function SelectExperienceScreen({ navigation }: Props) {
  const { theme: { colors } } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { setSubsonicEnabled } = useSubsonic();
  const { completeSetup } = useAppSetup();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          gap: 16,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        },
        title: {
          color: colors.text,
          fontSize: 30,
          fontWeight: '100',
        },
        pageContainer: {
          maxHeight: 480,
          width: '100%',
          overflow: 'hidden',
          gap: 16,
        },
        navigationContainer: {
          position: 'absolute',
          right: 32,
          left: 32,
          bottom: insets.bottom + 32,
          overflow: 'visible',
          gap: 8,
        },
        nextButton: {
          gap: 4,
          flex: 1,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 64,
          borderColor: colors.faint,
          borderWidth: 1,
          backgroundColor: colors.primary,
          justifyContent: 'center',
        },
        previousButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          flex: 1,
          padding: 16,
          borderRadius: 64,
          borderColor: '#97979F0A',
          borderWidth: 1,
          backgroundColor: colors.secondLayer,
        },
        nextButtonText: {
          color: '#FFFFFF',
          fontSize: 15,
        },
        prevButtonText: {
          color: colors.text,
          fontSize: 15,
        },
        experienceOptionWrapper: {
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        },
        experienceOption: {
          width: 280,
          height: 200,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          borderWidth: 2,
          borderColor: '#97979F1F',
        },
        experienceOptionSelected: {
          borderColor: '#22c55e',
        },
        backgroundImage: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: "-62.5%",
          width: "100%",
          aspectRatio: 9/16
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          marginRight: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
          minWidth: 0,
          zIndex: 1000,
          left: 16,
          top: insets.top + 16,
          position: "absolute"
        },
      }),
    [insets, colors],
  );

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <ChevronLeft size={24} color={"#FFF"} />
      </Pressable>
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={SwayOpensub}
          style={styles.backgroundImage}
          resizeMode='contain'
        />
      </View>
      <Svg
        height={120}
        width="100%"
        style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
      >
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={"#000000"} stopOpacity="0" />
            <Stop
              offset="100%"
              stopColor={"#000000"}
              stopOpacity="1"
            />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grad)" />
      </Svg>
      <View style={styles.navigationContainer}>
        <TouchableScale
          style={styles.previousButton}
          onPress={() => {
            setSubsonicEnabled(false);
            completeSetup();

            const parent = navigation.getParent();
            if (parent) {
              parent.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            }
          }}
        >
          <Text style={styles.prevButtonText}>Skip for now</Text>
        </TouchableScale>
        <TouchableScale
          style={styles.nextButton}
          onPress={() => {
            navigation.navigate('SetupSubsonic');
          }}
        >
          <Text style={styles.nextButtonText}>Enable Subsonic</Text>
        </TouchableScale>
      </View>
    </View>
  );
}

export default SelectExperienceScreen;
