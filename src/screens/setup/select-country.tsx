import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Search } from 'lucide-react-native';
import { COUNTRIES } from '../../utils/countries';
import { useAppSetup } from '../../contexts/app-setup-context';
import { ChevronLeft } from 'lucide-react-native/icons';
import { useAppTheme } from '../../contexts/theme-context';
import { SetupStackParamList } from '../../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import TouchableScale from '../../components/touchable-scale';

type Props = NativeStackScreenProps<SetupStackParamList, 'SelectCountry'>;

function SelectCountryScreen({ navigation }: Props) {
  const { theme: { colors } } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { selectedCountry, setSelectedCountry } = useAppSetup();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!selectedCountry) {
      // Try to auto-select based on IP if possible
      fetch('https://api.country.is/')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(geoData => {
          if (geoData.country && !selectedCountry) {
            setSelectedCountry(geoData.country);
          }
        })
        .catch(err => console.error('Failed to fetch geo data', err));
    }
  }, [selectedCountry, setSelectedCountry]);

  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(
      c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          gap: 16,
          width: '100%',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          paddingTop: insets.top + 16
        },
        title: {
          color: colors.text,
          fontSize: 24,
          fontWeight: '300',
          marginLeft: 16
        },
        pageContainer: {
          width: '100%',
          overflow: 'hidden',
          gap: 16,
        },
        searchContainer: {
          position: 'relative',
          marginHorizontal: 16,
          justifyContent: 'center',
        },
        searchIcon: {
          position: 'absolute',
          left: 14,
          color: '#A1A1AA',
          zIndex: 1,
        },
        searchInput: {
          width: '100%',
          paddingLeft: 40,
          paddingRight: 16,
          paddingVertical: 12,
          borderRadius: 64,
          backgroundColor: colors.secondLayerThin,
          color: colors.text,
        },
        countriesList: {
          flexGrow: 1,
          paddingHorizontal: 16,
        },
        countriesListContent: {
          gap: 4,
          paddingBottom: 8,
        },
        countryItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderRadius: 8,
          borderColor: 'transparent',
        },
        countryItemSelected: {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderColor: 'rgba(255, 255, 255, 0.18)',
        },
        countryEmoji: {
          fontSize: 24,
        },
        countryMeta: {
          flex: 1,
        },
        countryName: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '500',
        },
        noResults: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 40,
          gap: 8,
        },
        noResultsText: {
          color: '#A1A1AA',
        },
        nextButton: {
          flex: 1,
          padding: 12,
          backgroundColor: colors.primary,
          position: 'absolute',
          bottom: insets.bottom + 16,
          right: 16,
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 64,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          width: 56,
          height: 56,
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
        <ChevronLeft size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>Select your Country</Text>

      <View style={styles.pageContainer}>
        <View style={styles.searchContainer}>
          <Search style={styles.searchIcon} size={16} />
          <TextInput
            placeholder="Search countries..."
            placeholderTextColor="#A1A1AA"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <ScrollView
          style={styles.countriesList}
          contentContainerStyle={styles.countriesListContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredCountries.length > 0 ? (
            filteredCountries.map(country => {
              const isSelected = selectedCountry === country.code;
              return (
                <Pressable
                  key={country.code}
                  onPress={() => setSelectedCountry(country.code)}
                  style={[
                    styles.countryItem,
                    isSelected && styles.countryItemSelected,
                  ]}
                >
                  <Text style={styles.countryEmoji}>{country.emoji}</Text>

                  <View style={styles.countryMeta}>
                    <Text style={styles.countryName}>{country.name}</Text>
                  </View>

                  {isSelected && (
                    <Check
                      color={colors.text}
                      style={{ width: 24, height: 24 }}
                    />
                  )}
                </Pressable>
              );
            })
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                No countries found for "{searchTerm}"
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <TouchableScale
        style={styles.nextButton}
        onPress={() => {
          navigation.navigate('SelectExperience');
        }}
      >
        <ChevronRight
          size={24}
          color={"#FFFFFF"}
        />
      </TouchableScale>
    </View>
  );
}

export default SelectCountryScreen;
