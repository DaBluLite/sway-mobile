import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useColorScheme } from 'react-native'
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationDefaultTheme,
    type Theme as NavigationTheme,
} from '@react-navigation/native'
import { getItem, setItem, STORES } from '../utils/storage'

export type ThemeOption = 'light' | 'dark' | 'system'
export type ResolvedThemeOption = 'light' | 'dark'

export interface AppThemeColors {
    background: string
    card: string
    text: string
    textMuted: string
    border: string
    primary: string
    notification: string
    secondLayer: string
    secondLayerThin: string
    secondLayerThinActive: string
    faint: string
    subtle: string
}

export interface AppThemeShadows {
    main: string
    glass: string
    floating: string
}

export interface AppTheme {
    colors: AppThemeColors
    shadows: AppThemeShadows
}

interface ThemeContextValue {
    theme: AppTheme
    navigationTheme: NavigationTheme
    themeOption: ThemeOption
    setThemeOption: (option: ThemeOption) => void
    resolvedTheme: ResolvedThemeOption
}

interface CommonColors {
    faint: string
    subtle: string
}

const commonColors: CommonColors = {
    faint: "#9898A20A",
    subtle: "#9898A21F",
}

const lightColors: AppThemeColors = {
    background: '#FFFFFF',
    card: '#f6f7fb',
    text: '#0f172a',
    textMuted: '#b3b3b3',
    border: '#d8e0ea',
    primary: '#16a34a',
    notification: '#ef4444',
    secondLayer: "#e8e8e8",
    secondLayerThin: "#9898A21F",
    secondLayerThinActive: "#4D4D5A4D",
    ...commonColors
}

const darkColors: AppThemeColors = {
    background: '#000000',
    card: '#0f172a',
    text: '#f8fafc',
    textMuted: '#b3b3b3',
    border: '#1e293b',
    primary: '#16a34a',
    notification: '#f87171',
    secondLayer: "#181818",
    secondLayerThin: "#9898A21F",
    secondLayerThinActive: "#4D4D5A4D",
    ...commonColors
}

const lightShadows: AppThemeShadows = {
    main: '0 4px 10px 0 rgb(0 0 0 / 40%), inset 0 1px 0 #9898A20A',
    glass: 'inset 0 1px 0 #9898A20A',
    floating: '0 8px 20px rgb(11 18 32 / 18%)',
}

const darkShadows: AppThemeShadows = {
    main: '0 4px 10px 0 rgb(0 0 0 / 40%), inset 0 1px 0 #9898A20A',
    glass: 'inset 0 1px 0 #9898A20A',
    floating: '0 10px 24px rgb(0 0 0 / 45%)',
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const THEME_OPTION_STORAGE_KEY = 'theme-option'

const isThemeOption = (value: unknown): value is ThemeOption =>
    value === 'light' || value === 'dark' || value === 'system'

export const ThemeProvider = ({ children }: PropsWithChildren) => {
    const systemScheme = useColorScheme()
    const [themeOption, setThemeOption] = useState<ThemeOption>(() => {
        try {
            const storedValue = getItem<unknown>(STORES.SETTINGS, THEME_OPTION_STORAGE_KEY)
            return isThemeOption(storedValue) ? storedValue : 'system'
        } catch {
            return 'system'
        }
    })

    useEffect(() => {
        try {
            setItem(STORES.SETTINGS, THEME_OPTION_STORAGE_KEY, themeOption)
        } catch {
            // Storage failures should not break theme switching.
        }
    }, [themeOption])

    const resolvedTheme: ResolvedThemeOption =
        themeOption === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeOption

    const value = useMemo<ThemeContextValue>(() => {
        const isDark = resolvedTheme === 'dark'
        const colors = isDark ? darkColors : lightColors
        const shadows = isDark ? darkShadows : lightShadows

        const baseTheme = isDark ? NavigationDarkTheme : NavigationDefaultTheme
        const navigationTheme: NavigationTheme = {
            ...baseTheme,
            colors: {
                ...baseTheme.colors,
                primary: colors.primary,
                background: colors.background,
                card: colors.card,
                text: colors.text,
                border: colors.border,
                notification: colors.notification,
            },
        }

        return {
            theme: { colors, shadows },
            navigationTheme,
            themeOption,
            setThemeOption,
            resolvedTheme,
        }
    }, [resolvedTheme, themeOption])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useAppTheme = (): ThemeContextValue => {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useAppTheme must be used within ThemeProvider')
    }

    return context
}
