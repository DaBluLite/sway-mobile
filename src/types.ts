import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Library: undefined;
  Search: undefined;
};

export type SetupStackParamList = {
  Welcome: undefined;
  SelectCountry: undefined;
  SelectExperience: undefined;
  SetupSubsonic: undefined;
};

export type SettingsStackParamList = {
  Main: undefined;
  Appearance: undefined;
  Library: undefined;
  Audio: undefined;
  Storage: undefined;
  Naviload: undefined;
  MusicTransfer: undefined;
  TransferReview: undefined;
  About: undefined;
};

export type RootStackParamList = {
  Blank: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
  Login: undefined;
  NowPlaying: undefined;
  Setup: NavigatorScreenParams<SetupStackParamList>;
  CarHome: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
