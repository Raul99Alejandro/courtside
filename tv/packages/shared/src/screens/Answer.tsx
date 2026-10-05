import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { answerLayerForQuestion } from '@courtside/core';
import { CARDS, MATCH, MOMENTS } from '../data/matchData';
import { DEMO_QUESTION, HOUSEHOLD, householdIndex } from '../data/demo-household';
import { momentName } from '../data/headline';
import { teamColor, theme } from '../theme/courtside';
import { safeZones } from '../theme/safeZones';
import { scaledPixels as px } from '../hooks/useScale';
import Pitch from '../components/Pitch';
import ThemedButton from '../components/ThemedButton';
import { Scarf, ScarfStripe } from '../components/Scarf';

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;

/** A question asked from Leo's phone, answered on the TV at Leo's layer (R-06). */
export default function Answer() {
  const navigation = useNavigation<{ navigate: (n: string) => void }>();
  const c = theme.color;
  const font = theme.font;
  const q = DEMO_QUESTION;
  const viewer = HOUSEHOLD.find(v => v.name === q.viewer) ?? HOUSEHOLD[0];
  const index = householdIndex(viewer.name);
  const layer = answerLayerForQuestion(viewer, 'offside');
  const moment = MOMENTS.find(m => m.id === q.momentId) ?? MOMENTS[0];
  const other = MATCH.teams.find(t => t !== moment.team) ?? '';
  const who = momentName(moment, CARDS[moment.id]);

  return (
    <SpatialNavigationRoot isActive>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Haze color={c.accent} />
        <View style={styles.pad}>
          <View style={{ flex: 1, maxWidth: px(960) }}>
            <View style={styles.asked}>
              <Scarf index={index} width={px(52)} />
              <Text style={{ fontFamily: font.title, fontSize: px(52), color: c.text }}>{viewer.name} asked</Text>
              <Text style={{ fontFamily: font.body, fontSize: px(30), color: c.textDim }}>from their phone</Text>
            </View>
            <Text style={{ fontFamily: font.title, fontSize: px(104), lineHeight: px(104), color: c.text, marginBottom: px(40) }}>{q.text}</Text>
            <View style={[styles.answer, { backgroundColor: c.surface }]}>
              <View style={{ marginRight: px(28) }}>
                <ScarfStripe index={index} width={px(14)} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: px(10) }}>
                  <Text style={{ fontFamily: font.title, fontSize: px(52), color: c.text }}>{viewer.name}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: px(30), color: c.textDim, marginLeft: px(16) }}>{layer}</Text>
                </View>
                <Text style={{ fontFamily: font.body, fontSize: px(38), lineHeight: px(54), color: c.text }}>{q.answer}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <SpatialNavigationNode orientation="horizontal">
              <DefaultFocus>
                <View style={{ alignSelf: 'flex-start' }}>
                  <ThemedButton text="Back to replay" onSelect={() => navigation.navigate('Replay')} primary />
                </View>
              </DefaultFocus>
            </SpatialNavigationNode>
          </View>
          <View style={styles.right}>
            <Pitch moment={moment} width={px(760)} mine={teamColor(moment.team, '#fff')} theirs={teamColor(other, '#888')} actorName={who} />
            <Text style={{ fontFamily: font.bodyBold, fontSize: px(32), color: c.text, marginTop: px(14) }}>
              Minute {moment.minute}: {who}'s pass is ruled offside
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: px(28), color: c.textDim, marginTop: px(6) }}>Data: StatsBomb Open Data</Text>
          </View>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

/** Warm floodlight haze: a lamp glow from the upper left corner. */
function Haze({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="hz" cx="8%" cy="-5%" rx="75%" ry="95%" fx="8%" fy="-5%">
          <Stop offset="0" stopColor={color} stopOpacity={0.42} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.12} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#hz)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  pad: { flex: 1, flexDirection: 'row', paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V), gap: px(60) },
  asked: { flexDirection: 'row', alignItems: 'center', gap: px(18), marginBottom: px(14) },
  answer: { flexDirection: 'row', borderRadius: px(12), padding: px(36) },
  right: { flex: 1, justifyContent: 'center' },
});
