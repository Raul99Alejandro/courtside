import { StyleSheet, Text, View } from 'react-native';
import type { Moment } from '@courtside/core';
import { theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  moment: Moment;
  teams: string[];
}

/** Stadium strip: minute, teams and score. */
export default function Scoreboard({ moment, teams }: Props) {
  const [home, away] = teams;
  const hs = moment.scoreAfter[home] ?? 0;
  const as = moment.scoreAfter[away] ?? 0;
  const c = theme.color;
  const f = theme.font;
  return (
    <View style={[styles.strip, { backgroundColor: c.strip, borderColor: c.accent }]}>
      <View style={[styles.minute, { backgroundColor: c.accent }]}>
        <Text style={{ fontFamily: f.title, fontSize: px(72), color: c.onAccent }}>{moment.minute}'</Text>
      </View>
      <Text style={[styles.team, { fontFamily: f.title, color: c.text }]}>{home}</Text>
      <Text style={[styles.digit, { fontFamily: f.title, color: c.accent }]}>{hs}</Text>
      <Text style={[styles.digit, { fontFamily: f.title, color: c.textDim }]}>:</Text>
      <Text style={[styles.digit, { fontFamily: f.title, color: c.accent }]}>{as}</Text>
      <Text style={[styles.team, { fontFamily: f.title, color: c.text }]}>{away}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: px(3),
    borderRadius: px(6),
    height: px(104),
    overflow: 'hidden',
  },
  minute: { height: '100%', paddingHorizontal: px(26), justifyContent: 'center' },
  team: { fontSize: px(56), paddingHorizontal: px(24) },
  digit: { fontSize: px(84), paddingHorizontal: px(6) },
});
