import { useMemo, useState, useCallback } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../components/text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../contexts/theme-context'
import { useNavigation } from '@react-navigation/native'
import { FlyoutTrigger, useFlyout } from '../../components/flyout-menu'
import TextPromptModal from '../../components/text-prompt-modal'
import { CuratedCollection, useCurations } from '../../contexts/curations-context'
import { Plus } from 'lucide-react-native'
import TailwindGradientView from '../../components/tailwind-gradient-view'

function CurationsScreen() {
	const insets = useSafeAreaInsets()
	const { theme: { colors } } = useAppTheme()
    const { openFlyout } = useFlyout()
    const navigation = useNavigation()
	const { collections, isLoading, deleteCollection, updateCollection } = useCurations()
    const [editingCollection, setEditingCollection] = useState<CuratedCollection | null>(null)
    const [draftCollectionName, setDraftCollectionName] = useState('')

	const openCollectionMenu = useCallback((collection: CuratedCollection) => {
		openFlyout({
			title: collection.name,
			subtitle: `${collection.stations.length} stations`,
			actions: [
				{
					id: `open-${collection.id}`,
					label: 'Open curation',
					onPress: () => navigation.navigate(...['Curation', { collection }] as never),
				},
				{
					id: `edit-${collection.id}`,
					label: 'Edit curation',
					onPress: () => {
						setEditingCollection(collection)
						setDraftCollectionName(collection.name)
					},
				},
				{
					id: `delete-${collection.id}`,
					label: 'Delete curation',
					destructive: true,
					onPress: () => {
						Alert.alert(
							'Delete curation?',
							`This will permanently delete ${collection.name}.`,
							[
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Delete',
									style: 'destructive',
									onPress: async () => {
										try {
											await deleteCollection(collection.id)
										} catch (error) {
											Alert.alert('Unable to delete curation', error instanceof Error ? error.message : 'Please try again.')
										}
									},
								},
							],
						)
					},
				},
			],
		})
	}, [deleteCollection, navigation, openFlyout])

	const closeRenameModal = () => {
		setEditingCollection(null)
		setDraftCollectionName('')
	}

	const saveRename = async () => {
		if (!editingCollection) return
		const nextName = draftCollectionName.trim()
		if (!nextName) {
			Alert.alert('Curation name required', 'Please enter a curation name.')
			return
		}

		try {
			await updateCollection(editingCollection.id, {
				name: nextName,
			})
			closeRenameModal()
		} catch (error) {
			Alert.alert('Unable to update curation', error instanceof Error ? error.message : 'Please try again.')
		}
	}

	const styles = useMemo(
		() =>
			StyleSheet.create({
				container: {
					flex: 1,
					paddingTop: insets.top + 4,
					paddingHorizontal: 16,
					backgroundColor: colors.background,
				},
				title: {
					fontSize: 32,
					fontWeight: '300',
					color: colors.text,
				},
				headerRow: {
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginBottom: 16,
					gap: 12,
				},
				createButton: {
					padding: 8,
					borderRadius: 64,
					backgroundColor: colors.secondLayerThin,
					borderColor: colors.faint,
					borderWidth: 1,
				},
				listContent: {
					paddingBottom: insets.bottom + 140,
				},
				row: {
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					paddingVertical: 12,
					borderBottomWidth: 1,
					borderBottomColor: colors.secondLayerThin,
				},
				coverWrap: {
					width: 56,
					height: 56,
					borderRadius: 8,
					overflow: 'hidden',
					backgroundColor: colors.secondLayerThin,
					alignItems: 'center',
					justifyContent: 'center',
				},
				coverImage: {
					width: '100%',
					height: '100%',
				},
				coverFallback: {
					color: '#ffffff',
					fontSize: 24,
					textShadowColor: 'rgba(0,0,0,0.35)',
					textShadowOffset: { width: 0, height: 1 },
					textShadowRadius: 2,
					position: 'absolute',
				},
				textWrap: {
					flex: 1,
					minWidth: 0,
				},
				albumTitle: {
					color: colors.text,
					fontSize: 15,
					fontWeight: '600',
				},
				subtitle: {
					color: colors.textMuted,
					fontSize: 12,
					marginTop: 3,
				},
				duration: {
					color: colors.textMuted,
					fontSize: 12,
					marginLeft: 8,
				},
				helperText: {
					color: colors.textMuted,
					fontSize: 14,
					textAlign: 'center',
					marginTop: 16,
				},
				errorText: {
					color: colors.notification,
					fontSize: 14,
					textAlign: 'center',
					marginTop: 16,
				},
			}),
		[colors, insets],
	)

	  const renderItem = useCallback(({item}: { item: CuratedCollection, index: number }) => {
					return (
						<Pressable onPress={() => navigation.navigate(...["Curation", { curation: item }] as never)} style={styles.row}>
							<TailwindGradientView gradientClass={item.color} style={styles.coverWrap}>
								<Text style={styles.coverFallback}>{item.icon || '🎵'}</Text>
							</TailwindGradientView>
							<View style={styles.textWrap}>
								<Text numberOfLines={1} style={styles.albumTitle}>
									{item.name}
								</Text>
								<Text numberOfLines={1} style={styles.subtitle}>
									{item.stations.length} stations
								</Text>
							</View>
							<FlyoutTrigger onPress={() => openCollectionMenu(item)} />
						</Pressable>
					)
				}, [navigation, openCollectionMenu, styles.albumTitle, styles.coverFallback, styles.coverWrap, styles.row, styles.subtitle, styles.textWrap]);
return (
		<View style={styles.container}>
			<View style={styles.headerRow}>
				<Text style={styles.title}>Collections</Text>
				<Pressable style={styles.createButton} onPress={() => navigation.navigate('CreateCuration' as never)}>
					<Plus size={20} color={colors.text} />
				</Pressable>
			</View>
			<TextPromptModal
				visible={Boolean(editingCollection)}
				title="Edit curation"
				value={draftCollectionName}
				onChangeValue={setDraftCollectionName}
				onCancel={closeRenameModal}
				onConfirm={saveRename}
				confirmLabel="Save"
				placeholder="Curation name"
			/>
			<FlatList
				data={collections}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.listContent}
				refreshing={isLoading}
				renderItem={renderItem}
				ListEmptyComponent={
					<Text style={styles.helperText}>
						{isLoading ? 'Loading collections...' : 'No collections yet.'}
					</Text>
				}
			/>
		</View>
	)
}

export default CurationsScreen
