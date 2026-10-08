import { useMemo, useState } from 'react';
import { FlatList, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/text';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useTheme } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { Station } from "radio-browser-api";
import { StationCard } from "../components/station-card";

function StationListScreen({ route }: { route: { params: { stations: Station[]; pageTitle: string } } }) {
    const insets = useSafeAreaInsets()
    const [gridWidth, setGridWidth] = useState(0)
    const { colors } = useTheme()
    const navigation = useNavigation()

    const styles = useMemo(() => StyleSheet.create({
        container: {
            paddingTop: insets.top + 4,
            paddingLeft: 16,
            paddingRight: 16,
            height: "100%",
            flex: 1,
        },
        title: {
            fontSize: 32,
            fontWeight: '100',
            height: "auto",
            color: colors.text,
        },
        albumsGrid: {
            width: '100%',
            flex: 1,
        },
        albumsGridContent: {
            gap: 12,
            paddingBottom: insets.bottom + 200,
        },
    }), [insets, colors]);

    const GRID_COLUMNS = 2
    const GRID_GAP = 12

    const handleGridLayout = (event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width
        if (nextWidth > 0 && nextWidth !== gridWidth) {
            setGridWidth(nextWidth)
        }
    }

    const cardWidth = useMemo(() => {
        if (gridWidth <= 0) {
            return 156
        }

        return Math.floor((gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
    }, [gridWidth, GRID_COLUMNS, GRID_GAP])

  return (
        <View style={styles.container}>
            <View style={{ marginBottom: 16, alignItems: 'center', flexDirection: 'row' }}>
                <Pressable onPress={navigation.goBack} style={{ padding: 8, borderRadius: 8, marginRight: 8 }}>
                    <ChevronLeft size={24} color={colors.text} />
                </Pressable>
                <Text style={styles.title}>{route.params.pageTitle}</Text>
            </View>
            <FlatList
                scrollEnabled={true}
                onLayout={handleGridLayout}
                style={styles.albumsGrid}
                contentContainerStyle={styles.albumsGridContent}
                data={route.params.stations}
                renderItem={({ item }) => <StationCard width={cardWidth} station={item} />}
                numColumns={GRID_COLUMNS}
                columnWrapperStyle={{ gap: GRID_GAP }}
            />
        </View>
    );
}

export default StationListScreen;
