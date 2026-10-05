import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { markGotIt, newViewer, type Moment, type Viewer } from '@courtside/core';
import { cardRowsFor } from '../data/match';
import { CARDS, MATCH, MOMENTS } from '../data/matchData';
import { CONCEPT_DEFINITIONS } from '../data/concept-definitions';
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
import { currentDirection } from './direction';

const SORTED: Moment[] = [...MOMENTS].sort((a, b) => a.minute - b.minute);
const INITIAL = (SORTED.find(m => m.minute === 107 && m.effect) ?? SORTED[0]).id;

const startViewers = (): Viewer[] => [
  newViewer('Leo', 'beginner'),
  { ...newViewer('Ana', 'beginner'), understood: ['goal'] },
  newViewer('Raul', 'expert'),
];

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;
const CONTENT_W = 1920 - 2 * SAFE_H;

export default function Replay() {
  const theme = useMemo(() => getTheme(currentDirection()), []);
  const [viewers, setViewers] = useState<Viewer[]>(startViewers);
  const [selectedId, setSelectedId] = useState(INITIAL);
  const [why, setWhy] = useState(false);

  const moment = SORTED.find(m => m.id === selectedId) ?? SORTED[0];
  const rows = useMemo(() => cardRowsFor(moment, viewers, CARDS), [moment, viewers]);
  const other = MATCH.teams.find(t => t !== moment.team) ?? '';
  const mine = teamColor(moment.team, '#FFFFFF');
  const theirs = teamColor(other, '#888888');
  const colorOf = useCallback(
    (name: string) => theme.viewer[Math.max(0, viewers.findIndex(v => v.name === name)) % theme.viewer.length],
    [theme, viewers],
  );

  const onSelectMoment = useCallback((id: string) => {
    setSelectedId(id);
    setWhy(false);
  }, []);
  const gotIt = useCallback(() => {
    setViewers(vs =>
      vs.map(v => {
        const basic = rows.find(r => r.layer === 'basic')?.viewers.includes(v.name);
        return basic ? moment.concepts.reduce((acc, c) => markGotIt(acc, c).viewer, v) : v;
      }),
    );
  }, [rows, moment]);

  const timeline = (width: number) => (
    <Timeline
      moments={SORTED}
      selectedId={selectedId}
      initialId={INITIAL}
      onSelect={onSelectMoment}
      theme={theme}
      width={width}
      teamTick={team => (team === MATCH.teams[0] ? teamColor(team, theme.color.text) : theme.pitch.opponent ?? teamColor(team, theme.color.text))}
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

  const title = momentTitle(moment, CARDS[moment.id]);
  const actorName = momentName(moment, CARDS[moment.id]);

  return (
    <SpatialNavigationRoot isActive>
      <View style={[styles.screen, { backgroundColor: theme.color.bg }]}>
        {theme.layout === 'board' && <Haze color={theme.color.accent} />}
        {theme.layout === 'whiteboard' && <View pointerEvents="none" style={[styles.frame, { borderColor: theme.color.surface }]} />}
        <SpatialNavigationNode orientation="vertical">
          {theme.layout === 'board' ? (
            <BoardLayout
              theme={theme}
              moment={moment}
              mine={mine}
              theirs={theirs}
              timeline={timeline}
              buttons={buttons}
              attribution={attribution}
              why={whyLine}
              title={title}
              actorName={actorName}
              cards={<CardRows rows={rows} theme={theme} colorOf={colorOf} />}
            />
          ) : theme.layout === 'whiteboard' ? (
            <WhiteboardLayout
              theme={theme}
              moment={moment}
              mine={mine}
              theirs={theirs}
              timeline={timeline}
              buttons={buttons}
              attribution={attribution}
              why={whyLine}
              title={title}
              actorName={actorName}
              cards={<CardRows rows={rows} theme={theme} colorOf={colorOf} />}
            />
          ) : (
            <BandLayout
              theme={theme}
              moment={moment}
              mine={mine}
              theirs={theirs}
              timeline={timeline}
              buttons={buttons}
              attribution={attribution}
              why={whyLine}
              title={title}
              actorName={actorName}
              cards={<CardRows rows={rows} theme={theme} colorOf={colorOf} />}
            />
          )}
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
}

const otherTeam = (m: Moment) => MATCH.teams.find(t => t !== m.team) ?? '';

/** Warm floodlight haze behind direction A. */
function Haze({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="haze" cx="22%" cy="0%" rx="70%" ry="80%" fx="22%" fy="0%">
          <Stop offset="0" stopColor={color} stopOpacity={0.16} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#haze)" />
    </Svg>
  );
}

/** A · Floodlight: pitch 62 % left, substitutes' board 38 % right. */
function BoardLayout({ theme, moment, mine, theirs, timeline, buttons, attribution, why, title, actorName, cards }: LayoutProps) {
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
      <View style={[styles.board, { backgroundColor: c.surface }]}>
        <Text style={{ fontFamily: theme.font.title, fontSize: px(64), color: c.text, lineHeight: px(68) }}>
          {title}
        </Text>
        <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(32), color: c.accent, marginBottom: px(26) }}>
          {momentDetail(moment)}
        </Text>
        {cards}
        <View style={{ marginTop: px(20) }}>{why}</View>
        <View style={{ flex: 1 }} />
        <View style={{ marginBottom: px(26) }}>
          <PitchKey theme={theme} mine={mine} theirs={theirs} mineName={moment.team} theirsName={otherTeam(moment)} />
        </View>
        <View style={{ marginBottom: px(18) }}>{buttons}</View>
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
          <Text style={{ fontFamily: theme.font.title, fontSize: px(48), color: c.text, marginBottom: px(14) }}>
            {title}
          </Text>
          <Scoreboard moment={moment} theme={theme} teams={MATCH.teams} />
        </View>
        <Pitch moment={moment} theme={theme} width={px(pitchW)} mine={mine} theirs={theirs} actorName={actorName} />
        <View style={{ width: px(430), alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <Text
            style={{
              fontFamily: theme.font.hand,
              fontSize: px(40),
              lineHeight: px(46),
              color: c.accent,
              textAlign: 'right',
              transform: [{ rotate: '-2deg' }],
              marginTop: px(24),
            }}
          >
            {momentDetail(moment)}
          </Text>
          {attribution}
        </View>
      </View>
      <View style={[styles.bStrip]}>
        {timeline(px(1260))}
        {buttons}
      </View>
      <View style={{ marginTop: px(34) }}>{cards}</View>
      {why && <View style={{ marginTop: px(14) }}>{why}</View>}
    </View>
  );
}

/** C · Terrace scarf: score and timeline on top, pitch band across the middle, scarf rows below. */
function BandLayout({ theme, moment, mine, theirs, timeline, buttons, attribution, why, title, actorName, cards }: LayoutProps) {
  const c = theme.color;
  const bandH = 390;
  const vbH = 85;
  const vbW = (1920 * vbH) / bandH;
  const bleed = (vbW - 125) / 2;
  return (
    <View style={styles.cScreen}>
      <View style={[styles.cHead, { paddingHorizontal: px(SAFE_H) }]}>
        <Scoreboard moment={moment} theme={theme} teams={MATCH.teams} />
        <View style={{ flex: 1, marginLeft: px(80) }}>{timeline(px(960))}</View>
      </View>
      <View style={{ height: px(bandH) }}>
        <Pitch moment={moment} theme={theme} width={px(1920)} mine={mine} theirs={theirs} bleed={bleed} actorName={actorName} />
      </View>
      <View style={[styles.cBody, { paddingHorizontal: px(SAFE_H) }]}>
        <View style={{ flex: 1, paddingRight: px(60), maxWidth: px(1180) }}>
          <Text style={{ fontFamily: theme.font.title, fontSize: px(48), color: c.text, marginBottom: px(10) }}>
            {title}, {momentDetail(moment)}
          </Text>
          {cards}
          {why && <View style={{ marginTop: px(14) }}>{why}</View>}
        </View>
        <View style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {buttons}
          {attribution}
        </View>
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
  bStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: px(14) },
  cScreen: { flex: 1, paddingTop: px(SAFE_V), paddingBottom: px(SAFE_V) },
  cHead: { flexDirection: 'row', alignItems: 'center', height: px(140), marginBottom: px(10) },
  cBody: { flex: 1, flexDirection: 'row', paddingTop: px(18) },
});
