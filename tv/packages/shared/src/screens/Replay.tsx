import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { markGotIt, scarfIndex, undoPromotion, type Moment, type Viewer } from '@courtside/core';
import { cardRowsFor, whyAnswer } from '../data/match';
import { SHOWN_DWELL_MS, scheduleDwell } from '../data/dwell';
import { CARDS, MATCH, MOMENTS } from '../data/matchData';
import { HOUSEHOLD, householdIndex } from '../data/demo-household';
import { useLive } from '../live';
import { isDemo } from './screen';
import { selection } from '../data/picking';
import { momentDetail, momentName, momentTitle } from '../data/headline';
import { teamColor, theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';
import { safeZones } from '../theme/safeZones';
import Pitch from '../components/Pitch';
import Timeline from '../components/Timeline';
import Scoreboard from '../components/Scoreboard';
import CardRows from '../components/CardRows';
import ThemedButton from '../components/ThemedButton';
import PitchKey from '../components/PitchKey';
import Toast from '../components/Toast';

const SORTED: Moment[] = [...MOMENTS].sort((a, b) => a.minute - b.minute);
const INITIAL = (SORTED.find(m => m.minute === 107 && m.effect) ?? SORTED[0]).id;

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;
const PITCH_W = 920;
/** Height of the slot under the pitch: the key normally, the level-up toast when there is one. */
const SLOT_H = 96;

const otherTeam = (m: Moment) => MATCH.teams.find(t => t !== m.team) ?? '';

export interface ReplayProps {
  /** Demo: show Leo already moved up to Fan, with the level-up toast and Undo. */
  levelUpDemo?: boolean;
}

function startViewers(levelUpDemo?: boolean): Viewer[] {
  return selection.names
    .map(n => HOUSEHOLD.find(v => v.name === n))
    .filter((v): v is Viewer => !!v)
    .map(v => (levelUpDemo && v.name === 'Leo' ? { ...v, level: 'fan' as const, promotedAutomatically: true } : { ...v }));
}

/** What the screen needs from the viewers: demo data in memory, or the live session (state comes from the server). */
interface ReplayModel {
  viewers: Viewer[];
  /** Who moved up and the message to show (the server's words, not parsed here). */
  toast: { name: string; message: string } | null;
  /** Set while a Got it or Undo is being retried. */
  problem?: string;
  indexOf: (name: string) => number;
  onShown: (m: Moment) => void;
  gotIt: (basic: string[], m: Moment) => void;
  undo: () => void;
}

function useDemoModel(levelUpDemo?: boolean): ReplayModel {
  const [viewers, setViewers] = useState<Viewer[]>(() => startViewers(levelUpDemo));
  const [toast, setToast] = useState<{ name: string; message: string } | null>(levelUpDemo ? { name: 'Leo', message: 'Leo moved up to Fan' } : null);
  const gotIt = useCallback((basic: string[], moment: Moment) => {
    let message: { name: string; message: string } | null = null;
    setViewers(vs =>
      vs.map(v => {
        if (!basic.includes(v.name)) return v;
        let acc = v;
        for (const concept of moment.concepts) {
          const r = markGotIt(acc, concept);
          acc = r.viewer;
          if (r.promotion) message = { name: v.name, message: r.promotion };
        }
        return acc;
      }),
    );
    if (message) setToast(message);
  }, []);
  const undo = useCallback(() => {
    setViewers(vs => vs.map(v => (v.name === 'Leo' ? undoPromotion(v) : v)));
    setToast(null);
  }, []);
  return { viewers, toast, indexOf: householdIndex, onShown: () => undefined, gotIt, undo };
}

function useLiveModel(): ReplayModel {
  const { state, live } = useLive();
  const viewers = useMemo(
    () => state.present.map(n => state.viewers.find(v => v.name === n)).filter((v): v is Viewer => !!v),
    [state.present, state.viewers],
  );
  const toast = state.promotions.length ? state.promotions[state.promotions.length - 1]! : null;
  return {
    viewers,
    toast,
    problem: state.problem,
    indexOf: name => scarfIndex(state.viewers, name),
    onShown: m => void live.shown(m.id, m.concepts),
    gotIt: (basic, m) => void live.gotIt(basic, m.concepts),
    undo: () => void (toast && live.undo(toast.name)),
  };
}

const useModel: (levelUpDemo?: boolean) => ReplayModel = isDemo() ? useDemoModel : () => useLiveModel();

export default function Replay({ levelUpDemo }: ReplayProps) {
  const c = theme.color;
  const focused = useIsFocused();
  const model = useModel(levelUpDemo);
  const { viewers, toast } = model;
  const [selectedId, setSelectedId] = useState(INITIAL);
  const [why, setWhy] = useState(false);

  const moment = SORTED.find(m => m.id === selectedId) ?? SORTED[0];
  const rows = useMemo(() => cardRowsFor(moment, viewers, CARDS), [moment, viewers]);
  const dense = rows.length >= 3;
  const mine = teamColor(moment.team, '#FFFFFF');
  const theirs = teamColor(otherTeam(moment), '#888888');

  const onSelectMoment = useCallback((id: string) => {
    setSelectedId(id);
    setWhy(false);
  }, []);
  const { onShown } = model;
  // R-04: a basic explanation counts as shown only after the moment stayed on screen for 3 s; leaving earlier cancels it.
  useEffect(() => scheduleDwell(SHOWN_DWELL_MS, () => onShown(moment)), [moment.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const gotIt = useCallback(() => model.gotIt(rows.find(r => r.layer === 'basic')?.viewers ?? [], moment), [rows, moment, model]);
  const undo = model.undo;

  return (
    <SpatialNavigationRoot isActive={focused}>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Haze color={c.accent} />
        <SpatialNavigationNode orientation="vertical">
          <View style={[styles.pad, { flexDirection: 'row', gap: px(48) }]}>
            <View style={{ width: px(PITCH_W) }}>
              <Scoreboard moment={moment} teams={MATCH.teams} />
              <View style={{ marginTop: px(14) }}>
                <Pitch moment={moment} width={px(PITCH_W)} mine={mine} theirs={theirs} actorName={momentName(moment, CARDS[moment.id])} />
              </View>
              <View style={styles.slot}>
                {toast ? (
                  <DefaultFocus>
                    <Toast text={toast.message} viewerIndex={model.indexOf(toast.name)} onUndo={undo} />
                  </DefaultFocus>
                ) : (
                  <PitchKey mine={mine} theirs={theirs} mineName={moment.team} theirsName={otherTeam(moment)} />
                )}
              </View>
              <Timeline moments={SORTED} selectedId={selectedId} initialId={toast ? '' : INITIAL} onSelect={onSelectMoment} width={px(PITCH_W)} />
            </View>
            <View style={[styles.board, { backgroundColor: c.surface }, dense && { paddingVertical: px(24) }]}>
              <Text style={{ fontFamily: theme.font.title, fontSize: px(dense ? 52 : 64), color: c.text, lineHeight: px(dense ? 54 : 68) }}>
                {momentTitle(moment, CARDS[moment.id])}
              </Text>
              <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(dense ? 30 : 32), color: c.accent, marginBottom: px(dense ? 14 : 22) }}>
                {momentDetail(moment)}
              </Text>
              <CardRows rows={rows} dense={dense} indexOf={model.indexOf} />
              {why && (
                <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(30), lineHeight: px(40), color: c.accent, marginTop: px(16) }}>
                  {whyAnswer(moment, rows, CARDS).text}
                </Text>
              )}
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                {model.problem ? (
                  <Text testID="error-toast" style={{ fontFamily: theme.font.bodyBold, fontSize: px(30), color: c.accent, marginBottom: px(16) }}>
                    {model.problem}
                  </Text>
                ) : null}
              </View>
              <SpatialNavigationNode orientation="horizontal">
                <View style={styles.buttons}>
                  <ThemedButton text="Why?" onSelect={() => setWhy(w => !w)} />
                  <ThemedButton text="Got it" onSelect={gotIt} primary />
                </View>
              </SpatialNavigationNode>
              <Text style={{ fontFamily: theme.font.body, fontSize: px(28), color: c.textDim, marginTop: px(dense ? 12 : 16) }}>
                Data: StatsBomb Open Data
              </Text>
            </View>
          </View>
        </SpatialNavigationNode>
      </View>
    </SpatialNavigationRoot>
  );
}

/** Warm floodlight haze: a lamp glow from each upper corner. */
function Haze({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="hazeL" cx="8%" cy="-5%" rx="75%" ry="95%" fx="8%" fy="-5%">
          <Stop offset="0" stopColor={color} stopOpacity={0.42} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.12} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="hazeR" cx="95%" cy="-5%" rx="45%" ry="70%" fx="95%" fy="-5%">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#hazeL)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#hazeR)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  pad: { flex: 1, paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V) },
  board: { flex: 1, paddingHorizontal: px(40), paddingVertical: px(36), borderRadius: px(12) },
  slot: { height: px(SLOT_H), justifyContent: 'center', marginTop: px(8) },
  buttons: { flexDirection: 'row', gap: px(28), marginBottom: px(12) },
});
