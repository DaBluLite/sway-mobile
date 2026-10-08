import { useEffect, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../components/text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search
} from 'lucide-react-native'
import { useAppTheme } from '../../contexts/theme-context'
import { AppThemeColors } from '../../contexts/theme-context'
import {
  CandidateMatch,
  MatchStatus,
  TransferGroup,
  TransferItem,
  TransferProgress,
  TransferResult,
} from '../../types/transfer'
import {
  buildTransferGroups,
  executeTransfer,
} from '../../services/transfer-service'
import {
  hasSpotifyTokens,
} from '../../services/spotify-auth'
import subsonicService from '../../utils/subsonic'
import TouchableScale from '../../components/touchable-scale'
import Blank from '../../components/icons/blank'

const STAGE_LABELS: Record<TransferProgress['stage'], string> = {
  fetch: 'Fetching from Spotify',
  match: 'Matching to your library',
  transfer: 'Transferring',
}

function statusColor(status: MatchStatus, colors: AppThemeColors): string {
  switch (status) {
    case 'matched':
      return colors.primary
    case 'needs-review':
      return '#f59e0b'
    case 'unmatched':
      return colors.textMuted
  }
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'matched':
      return 'Matched'
    case 'needs-review':
      return 'Needs review'
    case 'unmatched':
      return 'No match'
  }
}

function ProgressBar({ progress }: { progress: TransferProgress | null }) {
  const { theme: { colors } } = useAppTheme()
  if (!progress || progress.total <= 0) return null
  const ratio = Math.min(1, progress.current / progress.total)
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {STAGE_LABELS[progress.stage]}
          {progress.currentItem ? ` · ${progress.currentItem}` : ''}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {progress.current}/{progress.total}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.secondLayerThin,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${ratio * 100}%`,
            backgroundColor: colors.primary,
          }}
        />
      </View>
    </View>
  )
}

function CandidateRow({
  candidate,
  active,
  onSelect,
}: {
  candidate: CandidateMatch
  active: boolean
  onSelect: () => void
}) {
  const { theme: { colors } } = useAppTheme()
  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
      }}
    >
      <View style={{ padding: 4, borderRadius: 64, backgroundColor: active ? colors.primary : colors.secondLayerThin }}>
        {active ? (
          <Check size={16} color={colors.text} />
        ) : (
          <Blank size={16} color={colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>
          {candidate.name}
        </Text>
        {candidate.artist ? (
          <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
            {candidate.artist}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
        {Math.round(candidate.score)}%
      </Text>
    </Pressable>
  )
}

function ExpandedItem({ item, onPickCandidate }: {
  item: TransferItem
  onPickCandidate: (itemKey: string, candidate: CandidateMatch) => void
}) {
  const { theme: { colors } } = useAppTheme()
  const [query, setQuery] = useState('')
  const [manualResults, setManualResults] = useState<CandidateMatch[] | null>(null)
  const [searching, setSearching] = useState(false)

  const runManualSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const result = await subsonicService.search({ query: query.trim(), size: 10 })
      const data = result.data as
        | { song?: { id: string; title: string; artist?: string }[] }
        | undefined
      const candidates: CandidateMatch[] = (data?.song ?? []).map(s => ({
        id: s.id,
        name: s.title,
        artist: s.artist ?? '',
        score: 100,
        kind: 'song',
      }))
      setManualResults(candidates)
    } finally {
      setSearching(false)
    }
  }

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: colors.secondLayerThin,
      }}
    >
      {item.candidates.length > 0 && (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, marginBottom: 4 }}>
          Suggested matches
        </Text>
      )}
      {item.candidates.map(candidate => (
        <CandidateRow
          key={candidate.id}
          candidate={candidate}
          active={item.targetId === candidate.id}
          onSelect={() => onPickCandidate(item.key, candidate)}
        />
      ))}

      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 12, marginBottom: 4 }}>
        Search manually
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: colors.faint,
          borderRadius: 8,
          paddingHorizontal: 8,
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search Subsonic library"
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, color: colors.text, fontSize: 13, paddingVertical: 8 }}
          autoCorrect={false}
        />
        <Pressable onPress={runManualSearch}>
          {searching ? (
            <Loader2 size={18} color={colors.textMuted} />
          ) : (
            <Search size={18} color={colors.textMuted} />
          )}
        </Pressable>
      </View>
      {manualResults && (
        <View style={{ marginTop: 8 }}>
          {manualResults.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>No results</Text>
          ) : (
            manualResults.slice(0, 5).map(candidate => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                active={item.targetId === candidate.id}
                onSelect={() => onPickCandidate(item.key, candidate)}
              />
            ))
          )}
        </View>
      )}
    </View>
  )
}

function ItemRow({
  item,
  expanded,
  onToggleSelected,
  onToggleExpanded,
  onPickCandidate,
}: {
  item: TransferItem
  expanded: boolean
  onToggleSelected: () => void
  onToggleExpanded: () => void
  onPickCandidate: (itemKey: string, candidate: CandidateMatch) => void
}) {
  const { theme: { colors } } = useAppTheme()
  const reviewable = item.status !== 'matched'

  return (
    <View>
      <Pressable
        onPress={onToggleSelected}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.secondLayerThin,
          backgroundColor: colors.background,
        }}
      >
        <View style={{ padding: 4, borderRadius: 64, backgroundColor: item.selected ? colors.primary : colors.secondLayerThin }}>
          {item.selected ? (
            <Check size={16} color={colors.text} />
          ) : (
            <Blank size={16} color={colors.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              backgroundColor: statusColor(item.status, colors) + '22',
            }}
          >
            <Text style={{ color: statusColor(item.status, colors), fontSize: 11 }}>
              {statusLabel(item.status)}
            </Text>
          </View>
          {reviewable && (
            <Pressable onPress={onToggleExpanded} hitSlop={8}>
              {expanded ? (
                <ChevronDown size={18} color={colors.textMuted} />
              ) : (
                <ChevronRight size={18} color={colors.textMuted} />
              )}
            </Pressable>
          )}
        </View>
      </Pressable>
      {reviewable && expanded && (
        <ExpandedItem item={item} onPickCandidate={onPickCandidate} />
      )}
    </View>
  )
}

function useTransferReview() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { theme: { colors } } = useAppTheme()

  const [groups, setGroups] = useState<TransferGroup[] | null>(null)
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [result, setResult] = useState<TransferResult | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const connected = hasSpotifyTokens()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: insets.top + 4,
          backgroundColor: colors.background,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          marginHorizontal: 16,
        },
        backButton: {
          padding: 8,
          borderRadius: 64,
          marginRight: 8,
          backgroundColor: colors.secondLayerThin,
          borderColor: colors.faint,
          borderWidth: 1,
        },
        title: {
          fontSize: 32,
          fontWeight: '100',
          color: colors.text,
        },
        groupHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          marginHorizontal: 8,
          marginBottom: 4,
          borderRadius: 12,
          borderColor: colors.faint,
          borderWidth: 1,
          backgroundColor: colors.secondLayerThin,
        },
        groupTitle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '600',
        },
        primaryButton: {
          marginHorizontal: 16,
          marginTop: 16,
          paddingVertical: 14,
          borderRadius: 64,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        secondaryButton: {
          marginHorizontal: 16,
          marginTop: 8,
          paddingVertical: 14,
          borderRadius: 64,
          borderWidth: 1,
          borderColor: colors.faint,
          alignItems: 'center',
        },
        buttonText: {
          color: "#FFFFFF",
          fontSize: 16,
        },
        buttonTextMuted: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '600',
        },
        emptyText: {
          color: colors.textMuted,
          fontSize: 15,
          textAlign: 'center',
          marginTop: 32,
          marginHorizontal: 24,
        },
      }),
    [colors, insets],
  )

  const toggleGroup = (group: TransferGroup) => {
    const allSelected = group.items.every(item => item.selected)
    setGroups(prev =>
      prev?.map(g =>
        g === group
          ? {
              ...g,
              items: g.items.map(item => ({ ...item, selected: !allSelected })),
            }
          : g,
      ) ?? null,
    )
  }

  const toggleItem = useCallback((group: TransferGroup, item: TransferItem) => {
    setGroups(prev =>
      prev?.map(g =>
        g === group
          ? {
              ...g,
              items: g.items.map(i =>
                i.key === item.key ? { ...i, selected: !i.selected } : i,
              ),
            }
          : g,
      ) ?? null,
    )
  }, [])

  const pickCandidate = useCallback((group: TransferGroup, itemKey: string, candidate: CandidateMatch) => {
    setGroups(prev =>
      prev?.map(g =>
        g === group
          ? {
              ...g,
              items: g.items.map(i =>
                i.key === itemKey
                  ? {
                      ...i,
                      targetId: candidate.id,
                      status: 'matched' as MatchStatus,
                      selected: true,
                    }
                  : i,
              ),
            }
          : g,
      ) ?? null,
    )
  }, [])

  const runMatch = async () => {
    setBusy(true)
    setResult(null)
    setProgress({ stage: 'fetch', current: 0, total: 1 })
    try {
      const built = await buildTransferGroups(subsonicService, setProgress)
      setGroups(built)
    } catch (error) {
      console.warn('Transfer match failed', error)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const runTransfer = async () => {
    if (!groups) return
    setTransferring(true)
    setResult(null)
    setProgress({ stage: 'transfer', current: 0, total: 1 })
    try {
      const outcome = await executeTransfer(groups, setProgress)
      setResult(outcome)
    } finally {
      setTransferring(false)
      setProgress(null)
    }
  }

  // "Needs review" (multiple good matches) must surface first within each
  // section, then unmatched (searchable for bad metadata), then matched.
  const STATUS_ORDER: Record<MatchStatus, number> = { 'needs-review': 0, unmatched: 1, matched: 2 }

  useEffect(() => {
    if (!groups) return
    const autoExpand: Record<string, boolean> = {}
    for (const g of groups) {
      for (const item of g.items) {
        if (item.status === 'needs-review') autoExpand[item.key] = true
      }
    }
    if (Object.keys(autoExpand).length) {
      setExpanded(prev => {
        const merged = { ...prev }
        for (const k of Object.keys(autoExpand)) {
          if (!(k in merged)) merged[k] = true
        }
        return merged
      })
    }
  }, [groups])

  const sections = useMemo(
    () =>
      (groups ?? []).map(g => ({
        title: g.title,
        kind: g.kind,
        group: g,
        // Show reviewable items first so user resolves ambiguity before search
        data: [...g.items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups],
  )

  const renderItem = useCallback(({ item, section }: { item: TransferItem; section: any }) => (
              <ItemRow
                item={item}
                expanded={!!expanded[item.key]}
                onToggleSelected={() => toggleItem(section.group, item)}
                onToggleExpanded={() =>
                  setExpanded(prev => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                onPickCandidate={(key, candidate) => pickCandidate(section.group, key, candidate)}
              />
            ), [expanded, toggleItem, pickCandidate]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Review</Text>
      </View>

      {!connected ? (
        <View>
          <Text style={styles.emptyText}>
            Connect your Spotify account from the Transfer screen to get started.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonTextMuted}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ProgressBar progress={progress} />
          <SectionList
            sections={sections}
            keyExtractor={item => item.key}
            renderItem={renderItem}
            renderSectionHeader={({ section }: { section: any }) => {
              const g: TransferGroup = section.group
              const allSelected = g.items.every(i => i.selected)
              const anySelected = g.items.some(i => i.selected)
              return (
                <Pressable style={styles.groupHeader} onPress={() => toggleGroup(g)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ padding: 4, borderRadius: 64, backgroundColor: allSelected ? colors.primary : colors.secondLayerThin, alignItems: 'center', justifyContent: 'center' }}>
                      {allSelected ? (
                        <Check size={20} color={colors.text} />
                      ) : anySelected ? (
                        <Check size={20} color={colors.textMuted} />
                      ) : (
                        <Blank size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <Text style={styles.groupTitle}>
                      {section.title}
                      <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
                        {' '}
                        ({g.items.length})
                      </Text>
                    </Text>
                  </View>
                </Pressable>
              )
            }}
            ListHeaderComponent={
              <>
                {!groups && !busy ? (
                  <Text style={styles.emptyText}>
                    Fetch and match your Spotify library against your Subsonic server.
                    High-confidence matches are auto-selected; unmatched items are left
                    unticked for review.
                  </Text>
                ) : null}
                {busy ? (
                  <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <ActivityIndicator color={colors.text} size="large" />
                  </View>
                ) : null}
              </>
            }
            stickySectionHeadersEnabled={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews
            contentContainerStyle={{ paddingBottom: 0 }}
            />
            <View style={{ paddingBottom: insets.bottom + 24, position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.background }}>
              {groups && !busy && !transferring ? (
                <TouchableScale style={styles.primaryButton} onPress={runTransfer}>
                  <Text style={styles.buttonText}>Start Transfer</Text>
                </TouchableScale>
              ) : null}
              {groups && transferring ? (
                <View style={{ alignItems: 'center', marginTop: 24 }}>
                  <ActivityIndicator color={colors.text} size="large" />
                </View>
              ) : null}
              {!groups && !busy ? (
                <TouchableScale style={styles.primaryButton} onPress={runMatch}>
                  <Text style={styles.buttonText}>Fetch &amp; Match Library</Text>
                </TouchableScale>
              ) : null}
              {result ? (
                <View
                  style={{
                    marginHorizontal: 16,
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: colors.secondLayerThin,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                    {result.success ? 'Transfer complete' : 'Transfer finished with issues'}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>
                    {result.transferred} transferred · {result.skipped} skipped
                  </Text>
                  {result.errors.length > 0 ? (
                    <View style={{ marginTop: 8 }}>
                      {result.errors.slice(0, 5).map((error) => (
                        <Text
                          key={error}
                          style={{ color: colors.notification, fontSize: 12, marginTop: 2 }}
                        >
                          {error}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
        </>
      )}
    </View>
  )
}

export default useTransferReview
