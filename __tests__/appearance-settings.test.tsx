import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useWindowDimensions } from 'react-native';
import { useAppTheme, type ThemeOption } from '../src/contexts/theme-context';
import AppearanceSettingsScreen from '../src/screens/settings/appearance';

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
  useWindowDimensions: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16 }),
}));
jest.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronLeft: 'ChevronLeft',
  Disc3: 'Disc3',
  Moon: 'Moon',
  Smartphone: 'Smartphone',
  Sun: 'Sun',
}));
jest.mock('../src/components/text', () => ({
  __esModule: true,
  default: 'AppText',
}));
jest.mock('../src/contexts/theme-context', () => ({ useAppTheme: jest.fn() }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mockGoBack = jest.fn();
const setThemeOption = jest.fn();
let renderer: ReactTestRenderer;

function provideTheme(
  themeChoice: ThemeOption,
  resolvedTheme: 'light' | 'dark' = 'dark',
) {
  jest.mocked(useAppTheme).mockReturnValue({
    theme: {
      colors: {
        background: '#000000',
        text: '#FFFFFF',
        textMuted: '#b3b3b3',
        primary: '#16a34a',
        secondLayerThin: '#9898A21F',
        secondLayerThinActive: '#4D4D5A4D',
        faint: '#9898A20A',
        subtle: '#9898A21F',
      },
    },
    themeOption: themeChoice,
    resolvedTheme,
    setThemeOption,
  } as unknown as ReturnType<typeof useAppTheme>);
}

async function mount() {
  await act(() => {
    renderer = create(<AppearanceSettingsScreen />);
  });
}

function option(label: string) {
  return renderer.root
    .findAllByType('Pressable' as React.ElementType)
    .find(node => node.props.accessibilityLabel === label)!;
}

function texts() {
  return renderer.root
    .findAllByType('AppText' as React.ElementType)
    .flatMap(node =>
      [node.props.children].flat().filter(value => typeof value === 'string'),
    );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useWindowDimensions)
    .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  provideTheme('system');
});

afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
});

it.each([
  ['Light theme', 'light'],
  ['Dark theme', 'dark'],
  ['System default theme', 'system'],
] as const)(
  'selects %s through the existing theme setter',
  async (label, value) => {
    await mount();
    await act(() => option(label).props.onPress());
    expect(setThemeOption).toHaveBeenCalledWith(value);
    expect(setThemeOption).toHaveBeenCalledTimes(1);
  },
);

it.each(['light', 'dark', 'system'] as const)(
  'marks only %s as the selected radio option',
  async value => {
    provideTheme(value);
    await mount();
    const labels = ['Light theme', 'Dark theme', 'System default theme'];
    const values = ['light', 'dark', 'system'];
    labels.forEach((label, index) => {
      expect(option(label).props.accessibilityRole).toBe('radio');
      expect(option(label).props.accessibilityState.checked).toBe(
        values[index] === value,
      );
    });
    expect(
      renderer.root.findAllByType('Check' as React.ElementType),
    ).toHaveLength(1);
  },
);

it('updates selection and the active mode when theme context changes', async () => {
  await mount();
  expect(texts()).toContain('Following your device. ');
  expect(texts()).toContain('Dark mode is currently active.');

  provideTheme('light', 'light');
  await act(() => renderer.update(<AppearanceSettingsScreen />));
  expect(option('Light theme').props.accessibilityState.checked).toBe(true);
  expect(option('System default theme').props.accessibilityState.checked).toBe(
    false,
  );
  expect(texts()).toContain('Light mode is currently active.');
  expect(texts()).not.toContain('Following your device. ');
});

it.each([
  [320, 1, 'column'],
  [390, 1.5, 'column'],
  [390, 1, 'row'],
])(
  'uses a %s-wide layout at font scale %s',
  async (width, fontScale, direction) => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({
        width: Number(width),
        height: 844,
        scale: 3,
        fontScale: Number(fontScale),
      });
    await mount();
    expect(option('Light theme').parent!.props.style.flexDirection).toBe(
      direction,
    );
  },
);

it('keeps decorative previews out of the accessibility tree and content scrollable', async () => {
  await mount();
  expect(
    renderer.root.findAllByType('ScrollView' as React.ElementType),
  ).toHaveLength(1);
  const previews = renderer.root
    .findAllByType('View' as React.ElementType)
    .filter(
      node => node.props.importantForAccessibility === 'no-hide-descendants',
    );
  expect(previews).toHaveLength(2);
  previews.forEach(node =>
    expect(node.props.accessibilityElementsHidden).toBe(true),
  );
});

it('provides an accessible back button', async () => {
  await mount();
  expect(option('Back').props.accessibilityRole).toBe('button');
  await act(() => option('Back').props.onPress());
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});
