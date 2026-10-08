import { StyleSheet, View } from 'react-native';
import Text from '../../components/text';
import Wordmark from '../../components/wordmark';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/theme-context';
import BlurredSpotsBackground from '../../components/blurred-spots-background';
import TouchableScale from '../../components/touchable-scale';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SetupStackParamList } from '../../types';
import { getItem, STORES } from '../../utils/storage';

type Props = NativeStackScreenProps<SetupStackParamList, 'Welcome'>;

function WelcomeScreen({ navigation }: Props) {
  const {
    theme: { colors },
  } = useAppTheme();
  const { bottom } = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 64,
          position: 'static',
        },
        nextButtonContainer: {
          boxShadow: 'inset 0 1px 0 #97979F0A',
          borderColor: '#97979F0A',
          borderWidth: 1,
        },
        nextButton: {
          position: 'absolute',
          bottom: bottom + 32,
          borderRadius: 64,
          left: 32,
          right: 32,
          overflow: 'hidden',
          backgroundColor: colors.primary,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        nextButtonText: {
          color: '#FFFFFF',
          fontSize: 16,
          textAlign: 'center',
          width: '100%',
        },
      }),
    [bottom, colors],
  );

  return (
    <View style={styles.container}>
      <BlurredSpotsBackground/>
      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '100' }}>
        Welcome to
      </Text>
      <Wordmark style={{ fill: colors.text }} height={50} width={'100%'} />
      <TouchableScale
        style={styles.nextButton}
        onPress={() => {
          navigation.navigate({ name: 'SelectCountry' } as never);
          console.log(getItem(STORES.SETTINGS, 'app-setup-completed'))
        }}
      >
        <Text style={styles.nextButtonText}>Let's Start</Text>
      </TouchableScale>
    </View>
  );
}

export default WelcomeScreen;
