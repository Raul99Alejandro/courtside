import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { answerLayerForQuestion } from '@courtside/core';
import { CARDS, MATCH, MOMENTS } from '../data/matchData';
import { DEMO_QUESTION, HOUSEHOLD, householdIndex } from '../data/demo-household';
import { momentName } from '../data/headline';
import { teamColor } from '../theme/direction';
import { getTheme } from '../theme/getTheme';
import { safeZones } from '../theme/safeZones';
import { scaledPixels as px } from '../hooks/useScale';
import Pitch from '../components/Pitch';
import ThemedButton from '../components/ThemedButton';
import { currentDirection } from './direction';

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;

/** A question asked from Leo's phone, answered on the TV at Leo's layer (R-06). */
export default function Answer() {
  const theme = useMemo(() => getTheme(currentDirection()), []);
  const navigation = useNavigation<{ navigate: (n: string) => void }>();
  const c = theme.color;
  const q = DEMO_QUESTION;
  const viewer = HOUSEHOLD.find(v => v.name === q.viewer) ?? HOUSEHOLD[0];
  const layer = answerLayerForQuestion(viewer, 'offside');
  const color = theme.viewer[householdIndex(viewer.name)];
  const moment = MOMENTS.find(m => m.id === q.momentId) ?? MOMENTS[0];
  const other = MATCH.teams.find(t => t !== moment.team) ?? '';
  const who = momentName(moment, CARDS[moment.id]);
  const l = theme.layout;
  const font = theme.font;

  const answerBlock = (
    <View
      style={[
        styles.answer,
        l === 'whiteboard' && { backgroundColor: color, transform: [{ rotate: '-1deg' }], padding: px(36) },
        l === 'board' && { backgroundColor: c.surface, borderRadius: px(12), padding: px(36) },
        l === 'band' && { paddingLeft: 0 },
      ]}
    >
      <View style={{ flexDirection: 'row' }}>
        {l === 'band' && <View style={{ width: px(40), backgroundColor: color, marginRight: px(30) }} />}
        {l === 'board' && <View style={{ width: px(6), backgroundColor: c.accent, marginRight: px(28), borderRadius: px(3) }} />}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: px(10) }}>
            <Text style={{ fontFamily: font.title, fontSize: px(52), color: c.text }}>{viewer.name}</Text>
            <Text style={{ fontFamily: font.body, fontSize: px(30), color: c.textDim, marginLeft: px(16) }}>{layer}</Text>
          </View>
          <Text style={{ fontFamily: font.body, fontSize: px(38), lineHeight: px(54), color: c.text }}>{q.answer}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SpatialNavigationRoot isActive>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {l === 'whiteboard' && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: px(16), borderColor: c.surface }]} />
        )}
        {l === 'band' && <View style={[styles.edge, { backgroundColor: color }]} />}
        <View style={styles.pad}>
          <View style={{ flex: 1, maxWidth: px(960) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(18), marginBottom: px(14) }}>
              <View style={[styles.chip, { backgroundColor: color, borderColor: l === 'whiteboard' ? c.text : 'transparent' }]}>
                <Text style={{ fontFamily: font.title, fontSize: px(44), color: l === 'band' || l === 'board' ? c.onAccent : c.text }}>
                  {viewer.name} asked
                </Text>
              </View>
              <Text style={{ fontFamily: font.body, fontSize: px(30), color: c.textDim }}>from their phone</Text>
            </View>
            <Text style={{ fontFamily: font.title, fontSize: px(l === 'whiteboard' ? 84 : 104), lineHeight: px(l === 'whiteboard' ? 92 : 104), color: c.text, marginBottom: px(40) }}>
              {q.text}
            </Text>
            {answerBlock}
            <View style={{ flex: 1 }} />
            <SpatialNavigationNode orientation="horizontal">
              <DefaultFocus>
                <View style={{ alignSelf: 'flex-start' }}>
                  <ThemedButton text="Back to replay" theme={theme} onSelect={() => navigation.navigate('Replay')} primary />
                </View>
              </DefaultFocus>
            </SpatialNavigationNode>
          </View>
          <View style={styles.right}>
            <Pitch
              moment={moment}
              theme={theme}
              width={px(760)}
              mine={teamColor(moment.team, '#fff')}
              theirs={theirs(other)}
              actorName={who}
            />
            <Text style={{ fontFamily: font.bodyBold, fontSize: px(32), color: c.text, marginTop: px(14) }}>
              Minute {moment.minute}: {who}'s pass is ruled offside
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: px(28), color: c.textDim, marginTop: px(6) }}>
              Data: StatsBomb Open Data
            </Text>
          </View>
        </View>
      </View>
    </SpatialNavigationRoot>
  );

  function theirs(team: string) {
    return theme.pitch.opponent ?? teamColor(team, '#888');
  }
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  pad: { flex: 1, flexDirection: 'row', paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V), gap: px(60) },
  answer: {},
  chip: { paddingHorizontal: px(24), paddingVertical: px(6), borderWidth: px(3) },
  right: { flex: 1, justifyContent: 'center' },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: px(26) },
});
