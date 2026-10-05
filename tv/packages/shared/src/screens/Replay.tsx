import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { markGotIt, undoPromotion, type Moment, type Viewer } from '@courtside/core';
import { cardRowsFor } from '../data/match';
import { CARDS, MATCH, MOMENTS } from '../data/matchData';
import { CONCEPT_DEFINITIONS } from '../data/concept-definitions';
import { HOUSEHOLD, householdIndex } from '../data/demo-household';
import { selection } from '../data/picking';
import { momentDetail, momentName, momentTitle } from '../data/headline';
import { teamColor, type Theme } from '../theme/direction';
import { getTheme } from '../theme/getTheme';
import { scaledPixels as px } from '../hooks/useScale';
import { safeZones } from '../theme/safeZones';
import Pitch from '../components/Pitch';
import Timeline from '../components/Timeline';
import Scoreboard from '../components/Scoreboard';
import CardRows from '../components/CardRows';
import ThemedButton from '../components/ThemedButton';
import PitchKey from '../components/PitchKey';
import Toast from '../components/Toast';
import { currentDirection } from './direction';

const SORTED: Moment[] = [...MOMENTS].sort((a, b) => a.minute - b.minute);
const INITIAL = (SORTED.find(m => m.minute === 107 && m.effect) ?? SORTED[0]).id;

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;
const CONTENT_W = 1920 - 2 * SAFE_H;

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

export default function Replay({ levelUpDemo }: ReplayProps) {
  const theme = useMemo(() => getTheme(currentDirection()), []);
  const [viewers, setViewers] = useState<Viewer[]>(() => startViewers(levelUpDemo));
  const [selectedId, setSelectedId] = useState(INITIAL);
  const [why, setWhy] = useState(false);
  const [toast, setToast] = useState<string | null>(levelUpDemo ? 'Leo moved up to Fan' : null);

  const moment = SORTED.find(m => m.id === selectedId) ?? SORTED[0];
  const rows = useMemo(() => cardRowsFor(moment, viewers, CARDS), [moment, viewers]);
  const mine = teamColor(moment.team, '#FFFFFF');
  const theirs = teamColor(otherTeam(moment), '#888888');
  const colorOf = useCallback((name: string) => theme.viewer[householdIndex(name) % theme.viewer.length], [theme]);

  const onSelectMoment = useCallback((id: string) => {
    setSelectedId(id);
    setWhy(false);
  }, []);
  const gotIt = useCallback(() => {
    const basic = rows.find(r => r.layer === 'basic')?.viewers ?? [];
    let message: string | null = null;
    setViewers(vs =>
      vs.map(v => {
        if (!basic.includes(v.name)) return v;
        let acc = v;
        for (const c of moment.concepts) {
          const r = markGotIt(acc, c);
          acc = r.viewer;
          if (r.promotion) message = r.promotion;
        }
        return acc;
      }),
    );
    if (message) setToast(message);
  }, [rows, moment]);
  const undo = useCallback(() => {
    setViewers(vs => vs.map(v => (v.name === 'Leo' ? undoPromotion(v) : v)));
    setToast(null);
  }, []);

  const timeline = (width: number) => (
    <Timeline
      moments={SORTED}
      selectedId={selectedId}
      initialId={toast ? '' : INITIAL}
      onSelect={onSelectMoment}
      theme={theme}
      width={width}
      teamTick={team =>
        team === MATCH.teams[0]
          ? teamColor(team, theme.color.text)
          : theme.pitch.opponent ?? teamColor(team, theme.color.text)
      }
    />
  );
  const buttons = (
    <SpatialNavigationNode orientation="horizontal">
      <View style={styles.buttons}>
        <ThemedButton text="Why?" theme={theme} onSelect={() => setWhy(w => !w)} />
        <ThemedButton text="Got it" theme={theme} onSelect={gotIt} primary />
      </View>
    </SpatialNavigationNode>
  );
  const whyLine = why ? (
    <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(30), lineHeight: px(40), color: theme.color.accent }}>
      {moment.concepts.map(c => CONCEPT_DEFINITIONS[c]).join(' ')}
    </Text>
  ) : null;
  const attribution = (
    <Text style={{ fontFamily: theme.font.body, fontSize: px(28), color: theme.color.textDim }}>
      Data: StatsBomb Open Data
    </Text>
  );
  const common: LayoutProps = {
    theme,
    moment,
    mine,
    theirs,
    timeline,
    buttons,
    attribution,
    why: whyLine,
    title: momentTitle(moment, CARDS[moment.id]),
    actorName: momentName(moment, CARDS[moment.id]),
    cards: <CardRows rows={rows} theme={theme} colorOf={colorOf} dense={rows.length >= 3} />,
    dense: rows.length >= 3,
    viewers,
    colorOf,
  };

  return (
    <SpatialNavigationRoot isActive>
      <View style={[styles.screen, { backgroundColor: theme.color.bg }]}>
        {theme.layout === 'board' && <Haze color={theme.color.accent} />}
        {theme.layout === 'whiteboard' && (
          <View pointerEvents="none" style={[styles.frame, { borderColor: theme.color.surface }]} />
        )}
        <SpatialNavigationNode orientation="vertical">
          <View style={{ flex: 1 }}>
          {theme.layout === 'board' ? (
            <BoardLayout {...common} />
          ) : theme.layout === 'whiteboard' ? (
            <WhiteboardLayout {...common} />
          ) : (
            <BandLayout {...common} />
          )}
          {toast && (
            <DefaultFocus>
              <Toast text={toast} theme={theme} onUndo={undo} />
            </DefaultFocus>
          )}
          </View>
        </SpatialNavigationNode>
      </View>
    </SpatialNavigationRoot>
  );
}

interface LayoutProps {
  theme: Theme;
  moment: Moment;
  mine: string;
  theirs: string;
  timeline: (width: number) => React.ReactElement;
  buttons: React.ReactElement;
  attribution: React.ReactElement;
  why: React.ReactElement | null;
  title: string;
  actorName: string;
  cards: React.ReactElement;
  dense: boolean;
  viewers: Viewer[];
  colorOf: (name: string) => string;
}

/** Warm floodlight haze behind direction A: a lamp glow from each upper corner. */
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

/** A · Floodlight: pitch 62 % left, substitutes' board 38 % right. */
function BoardLayout({ theme, moment, mine, theirs, timeline, buttons, attribution, why, title, actorName, cards, dense }: LayoutProps) {
  const c = theme.color;
  const pitchW = Math.round(CONTENT_W * 0.6);
  return (
    <View style={[styles.pad, { flexDirection: 'row', gap: px(48) }]}>
      <View style={{ width: px(pitchW) }}>
        <Scoreboard moment={moment} theme={theme} teams={MATCH.teams} />
        <View style={{ marginTop: px(18) }}>
          <Pitch moment={moment} theme={theme} width={px(pitchW)} mine={mine} theirs={theirs} actorName={actorName} />
        </View>
        <View style={{ marginTop: px(10) }}>{timeline(px(pitchW))}</View>
      </View>
      <View style={[styles.board, { backgroundColor: c.surface }, dense && { paddingVertical: px(24) }]}>
        <Text style={{ fontFamily: theme.font.title, fontSize: px(dense ? 52 : 64), color: c.text, lineHeight: px(dense ? 54 : 68) }}>{title}</Text>
        <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(dense ? 30 : 32), color: c.accent, marginBottom: px(dense ? 14 : 22) }}>
          {momentDetail(moment)}
        </Text>
        {cards}
        <View style={{ marginTop: px(16) }}>{why}</View>
        <View style={{ flex: 1 }} />
        {!dense && (
          <View style={{ marginBottom: px(20) }}>
            <PitchKey theme={theme} mine={mine} theirs={theirs} mineName={moment.team} theirsName={otherTeam(moment)} />
          </View>
        )}
        <View style={{ marginBottom: px(dense ? 10 : 16), marginTop: px(dense ? 12 : 0) }}>{buttons}</View>
        {attribution}
      </View>
    </View>
  );
}

/** B · Tactics board: pitch diagram centred on top, sticky notes underneath. */
function WhiteboardLayout({ theme, moment, mine, theirs, timeline, buttons, attribution, why, title, actorName, cards }: LayoutProps) {
  const c = theme.color;
  const pitchW = 780;
  return (
    <View style={styles.pad}>
      <View style={styles.bTop}>
        <View style={{ width: px(430) }}>
          <Text style={{ fontFamily: theme.font.title, fontSize: px(48), color: c.text, marginBottom: px(10) }}>{title}</Text>
          <Scoreboard moment={moment} theme={theme} teams={MATCH.teams} />
          <Text
            style={{
              fontFamily: theme.font.hand,
              fontSize: px(44),
              lineHeight: px(50),
              color: c.accent,
              marginTop: px(14),
              transform: [{ rotate: '-2deg' }],
            }}
          >
            {momentDetail(moment)}
          </Text>
        </View>
        <Pitch moment={moment} theme={theme} width={px(pitchW)} mine={mine} theirs={theirs} actorName={actorName} />
        <View style={styles.bRight}>
          <PitchKey stacked theme={theme} mine={mine} theirs={theirs} mineName={moment.team} theirsName={otherTeam(moment)} />
          {attribution}
        </View>
      </View>
      <View style={styles.bStrip}>
        {timeline(px(1260))}
        {buttons}
      </View>
      <View style={{ marginTop: px(18) }}>{cards}</View>
      {why && <View style={{ marginTop: px(14) }}>{why}</View>}
    </View>
  );
}

/** C · Terrace scarf: score and timeline on top, a tall pitch band across the middle, scarf rows below. */
function BandLayout({ theme, moment, mine, theirs, timeline, buttons, attribution, why, title, actorName, cards, viewers, colorOf, dense }: LayoutProps) {
  const c = theme.color;
  const bandH = 486; // 45 % of 1080 = 486
  const vbH = 85;
  const vbW = (1920 * vbH) / bandH;
  const bleed = (vbW - 125) / 2;
  const side = { width: px(480), position: 'absolute' as const, top: 0, bottom: 0, justifyContent: 'center' as const };
  return (
    <View style={styles.cScreen}>
      <View style={[styles.cHead, { paddingHorizontal: px(SAFE_H) }]}>
        <Scoreboard moment={moment} theme={theme} teams={MATCH.teams} />
        <View style={{ flex: 1, marginLeft: px(80) }}>{timeline(px(960))}</View>
      </View>
      <View style={{ height: px(bandH) }}>
        <Pitch moment={moment} theme={theme} width={px(1920)} mine={mine} theirs={theirs} bleed={bleed} actorName={actorName} />
        <View style={[side, { left: px(SAFE_H) }]}>
          <Text style={{ fontFamily: theme.font.title, fontSize: px(56), lineHeight: px(58), color: c.text }}>{title},</Text>
          <Text style={{ fontFamily: theme.font.title, fontSize: px(56), lineHeight: px(58), color: c.accent }}>
            {momentDetail(moment)}
          </Text>
        </View>
        <View style={[side, { right: px(SAFE_H), justifyContent: 'space-between', paddingVertical: px(26) }]}>
          <View style={{ gap: px(12) }}>
            {viewers.map(v => (
              <View key={v.name} style={styles.scarfKey}>
                <View style={[styles.scarfSwatch, { backgroundColor: colorOf(v.name) }]} />
                <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(32), color: c.text }}>{v.name}</Text>
              </View>
            ))}
          </View>
          {attribution}
        </View>
      </View>
      <View style={[styles.cBody, { paddingHorizontal: px(SAFE_H) }, dense && { flexDirection: 'column' }]}>
        <View style={dense ? undefined : { flex: 1, paddingRight: px(60), maxWidth: px(1180) }}>
          {cards}
          {why && <View style={{ marginTop: px(14) }}>{why}</View>}
        </View>
        <View style={{ alignItems: 'flex-start', marginTop: dense ? px(14) : 0 }}>{buttons}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  pad: { flex: 1, paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V) },
  frame: { ...StyleSheet.absoluteFillObject, borderWidth: px(16) },
  board: { flex: 1, paddingHorizontal: px(40), paddingVertical: px(36), borderRadius: px(12) },
  buttons: { flexDirection: 'row', gap: px(28) },
  bTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bRight: { width: px(430), alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: px(20) },
  bStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: px(14) },
  cScreen: { flex: 1, paddingTop: px(SAFE_V), paddingBottom: px(SAFE_V) },
  cHead: { flexDirection: 'row', alignItems: 'center', height: px(132), marginBottom: px(0) },
  cBody: { flex: 1, flexDirection: 'row', paddingTop: px(14) },
  scarfKey: { flexDirection: 'row', alignItems: 'center', gap: px(14) },
  scarfSwatch: { width: px(60), height: px(30) },
});
