import { StyleSheet, Text, View } from 'react-native';
import type { Moment } from '@courtside/core';
import type { Theme } from '../theme/direction';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  moment: Moment;
  theme: Theme;
  teams: string[];
}

/** Score and minute. A: stadium strip. B: marker lines. C: big scarf numerals. */
export default function Scoreboard({ moment, theme, teams }: Props) {
  const [home, away] = teams;
  const hs = moment.scoreAfter[home] ?? 0;
  const as = moment.scoreAfter[away] ?? 0;
  const c = theme.color;
  const f = theme.font;

  if (theme.layout === 'board') {
    return (
      <View style={[styles.strip, { backgroundColor: '#08110C', borderColor: c.accent }]}>
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

  if (theme.layout === 'whiteboard') {
    return (
      <View>
        <Text style={{ fontFamily: f.title, fontSize: px(64), color: c.text, lineHeight: px(70) }}>
          {home} {hs}
        </Text>
        <Text style={{ fontFamily: f.title, fontSize: px(64), color: c.text, lineHeight: px(70) }}>
          {away} {as}
        </Text>
        <Text style={{ fontFamily: f.bodyBold, fontSize: px(32), color: c.textDim, marginTop: px(12) }}>
          Minute {moment.minute}, {moment.phase}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.cRow}>
      <Text style={{ fontFamily: f.title, fontSize: px(120), color: c.accent, lineHeight: px(120) }}>
        {moment.minute}'
      </Text>
      <View style={{ marginLeft: px(36) }}>
        <Text style={{ fontFamily: f.title, fontSize: px(64), color: c.text, lineHeight: px(66) }}>
          {home} {hs}
        </Text>
        <Text style={{ fontFamily: f.title, fontSize: px(64), color: c.text, lineHeight: px(66) }}>
          {away} {as}
        </Text>
      </View>
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
  cRow: { flexDirection: 'row', alignItems: 'center' },
});
