import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './welcome';
import SelectCountryScreen from './select-country';
import SelectExperienceScreen from './select-experience';
import SetupOpenSubsonicScreen from './setup-opensubsonic';
import { SetupStackParamList } from '../../types';

const WelcomeStack = createNativeStackNavigator<SetupStackParamList>();

function SetupScreen() {
  return (
    <WelcomeStack.Navigator screenOptions={{ headerShown: false }}>
      <WelcomeStack.Screen name="Welcome" component={WelcomeScreen} />
      <WelcomeStack.Screen
        name="SelectCountry"
        component={SelectCountryScreen}
      />
      <WelcomeStack.Screen
        name="SelectExperience"
        component={SelectExperienceScreen}
      />
      <WelcomeStack.Screen
        name="SetupSubsonic"
        component={SetupOpenSubsonicScreen}
      />
    </WelcomeStack.Navigator>
  );
}

export default SetupScreen;
