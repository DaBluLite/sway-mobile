import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking } from 'react-native';
import { useSubsonic } from '../src/contexts/subsonic-context';
import { Alert } from '../src/components/custom-alert-api';
import SettingsNavigator from '../src/screens/settings';
import AboutSettingsScreen from '../src/screens/settings/about';
import { version } from '../package.json';

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
  Linking: { openURL: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({
      name,
      component: Component,
    }: {
      name: string;
      component: React.ComponentType;
    }) => (name === 'Main' ? <Component /> : null),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Library: 'Library',
  LogOut: 'LogOut',
  Palette: 'Palette',
  AudioLines: 'AudioLines',
  Upload: 'Upload',
  HardDrive: 'HardDrive',
  Info: 'Info',
  ExternalLink: 'ExternalLink',
}));
jest.mock('../src/components/text', () => ({
  __esModule: true,
  default: 'AppText',
}));
jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));
jest.mock('../src/contexts/theme-context', () => ({
  useAppTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    theme: {
      colors: {
        background: '#000',
        text: '#fff',
        textMuted: '#aaa',
        secondLayerThin: '#222',
        faint: '#333',
      },
    },
  }),
}));
jest.mock('../src/contexts/subsonic-context', () => ({
  useSubsonic: jest.fn(),
}));
jest.mock('../src/utils/subsonic', () => ({
  __esModule: true,
  default: { clearCredentials: jest.fn() },
}));
jest.mock('../src/components/custom-alert-api', () => ({
  Alert: { alert: jest.fn() },
}));
jest.mock('../src/screens/settings/appearance', () => () => null);
jest.mock('../src/screens/settings/library', () => () => null);
jest.mock('../src/screens/settings/audio', () => () => null);
jest.mock('../src/screens/settings/music-transfer', () => () => null);
jest.mock('../src/screens/settings/naviload', () => () => null);
jest.mock('../src/screens/settings/transfer-review', () => () => null);
jest.mock('../src/screens/settings/storage', () => () => null);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockResolvedTheme: 'light' | 'dark' = 'dark';
let renderer: ReactTestRenderer;

function provideSubsonic(subsonicEnabled: boolean, loggedIn: boolean) {
  jest.mocked(useSubsonic).mockReturnValue({
    subsonicEnabled,
    loggedIn,
    isInitialized: true,
    setSubsonicEnabled: jest.fn(),
  });
}

async function mount(element: React.ReactElement) {
  await act(() => {
    renderer = create(element);
  });
}

function texts() {
  return renderer.root
    .findAllByType('AppText' as React.ElementType)
    .map(node => node.props.children);
}

function pressable(label: string) {
  return renderer.root
    .findAllByType('Pressable' as React.ElementType)
    .find(node => node.props.accessibilityLabel === label)!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvedTheme = 'dark';
  jest.mocked(Linking.openURL).mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
});

it.each([false, true])(
  'hides Subsonic-only settings when disabled (logged in: %s)',
  async loggedIn => {
    provideSubsonic(false, loggedIn);
    await mount(<SettingsNavigator />);
    expect(texts()).not.toContain('Storage');
    expect(texts()).not.toContain('Naviload');
    expect(texts()).not.toContain('Transfer Your Library');
    expect(texts()).toContain('About');
  },
);

it.each([false, true])(
  'shows storage and Naviload when enabled (logged in: %s)',
  async loggedIn => {
    provideSubsonic(true, loggedIn);
    await mount(<SettingsNavigator />);
    expect(texts()).toContain('Storage');
    expect(texts()).toContain('Naviload');
    expect(texts().includes('Transfer Your Library')).toBe(loggedIn);
  },
);

it('updates visibility when Subsonic is disabled', async () => {
  provideSubsonic(true, true);
  await mount(<SettingsNavigator />);
  const Screen = renderer.root.find(
    node =>
      typeof node.type === 'function' && node.type.name === 'SettingsScreen',
  ).type as React.ComponentType;
  await act(() => renderer.update(<Screen />));
  provideSubsonic(false, true);
  await act(() => renderer.update(<Screen />));
  expect(texts()).not.toContain('Storage');
  expect(texts()).not.toContain('Naviload');
  expect(texts()).not.toContain('Transfer Your Library');
});

it('shows the package version as the third About item', async () => {
  await mount(<AboutSettingsScreen />);
  const labels = texts();
  expect(labels.slice(labels.indexOf('Terms of Service'))).toEqual([
    'Terms of Service',
    'Privacy Policy',
    'Version',
    version,
  ]);
  const row = renderer.root
    .findAllByType('View' as React.ElementType)
    .find(node => node.props.accessibilityLabel === `Version ${version}`)!;
  expect(row.props.accessible).toBe(true);
  expect(row.props.onPress).toBeUndefined();
});

it('opens About from settings', async () => {
  provideSubsonic(false, false);
  await mount(<SettingsNavigator />);
  const aboutText = renderer.root
    .findAllByType('AppText' as React.ElementType)
    .find(node => node.props.children === 'About')!;
  await act(() => aboutText.parent!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('About');
});

it.each([
  ['dark', 'white'],
  ['light', 'black'],
] as const)(
  'uses the %s theme wordmark with %s lettering',
  async (theme, fill) => {
    mockResolvedTheme = theme;
    await mount(<AboutSettingsScreen />);
    const svg = renderer.root.findByType('SvgXml' as React.ElementType);
    expect(svg.props.xml).toContain(`fill="${fill}"`);
    expect(svg.props.xml).toContain('viewBox="0 0 1513 334"');
    expect(svg.props.width).toBe('100%');
    expect(svg.props.height).toBe('100%');
    const logo = renderer.root
      .findAllByType('View' as React.ElementType)
      .find(node => node.props.accessibilityLabel === 'Sway Music')!;
    expect(logo.props.accessibilityRole).toBe('image');
    expect(logo.props.style.aspectRatio).toBe(1513 / 334);
  },
);

it.each([
  ['Terms of Service', 'https://sway.dablulite.dev/tos'],
  ['Privacy Policy', 'https://sway.dablulite.dev/privacy'],
])('opens %s in the browser', async (label, url) => {
  await mount(<AboutSettingsScreen />);
  expect(pressable(label).props.accessibilityRole).toBe('link');
  await act(() => pressable(label).props.onPress());
  expect(Linking.openURL).toHaveBeenCalledWith(url);
});

it('reports link-opening failures', async () => {
  jest.mocked(Linking.openURL).mockRejectedValue(new Error('No browser'));
  await mount(<AboutSettingsScreen />);
  await act(() => pressable('Privacy Policy').props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith(
    'Unable to open link',
    expect.stringContaining('https://sway.dablulite.dev/privacy'),
  );
});

it('provides back navigation and scrollable About content', async () => {
  await mount(<AboutSettingsScreen />);
  await act(() => pressable('Back').props.onPress());
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(
    renderer.root.findAllByType('ScrollView' as React.ElementType),
  ).toHaveLength(1);
});
