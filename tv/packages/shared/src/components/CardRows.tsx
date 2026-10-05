import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../theme/direction';
import type { CardRow } from '../data/match';
import { joinNames } from '../data/headline';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  rows: CardRow[];
  theme: Theme;
  /** viewer name -> identity colour */
  colorOf: (name: string) => string;
  /** three layers at once: tighter type and, in the band direction, side-by-side columns */
  dense?: boolean;
}

const TILT = [-1.4, 1.1, -0.8];

/** One row per layer needed, lowest first, labelled with the viewers it is for (R-08). */
export default function CardRows({ rows, theme, colorOf, dense }: Props) {
  const c = theme.color;
  const f = theme.font;

  if (theme.layout === 'whiteboard') {
    return (
      <View style={styles.notes}>
        {rows.map((r, i) => (
          <View
            key={r.layer}
            style={[
              styles.note,
              { backgroundColor: colorOf(r.viewers[0]), transform: [{ rotate: `${TILT[i % 3]}deg` }] },
            ]}
          >
            <View style={styles.tape} />
            <View style={styles.noteHead}>
              {r.viewers.map(v => (
                <View key={v} style={[styles.dot, { backgroundColor: colorOf(v) }]} />
              ))}
              <Text style={{ fontFamily: f.title, fontSize: px(36), color: c.text }}>{joinNames(r.viewers)}</Text>
              <Text style={{ fontFamily: f.body, fontSize: px(28), color: c.textDim, marginLeft: px(12) }}>
                {r.layer}
              </Text>
            </View>
            <Text style={{ fontFamily: f.body, fontSize: px(30), lineHeight: px(40), color: c.text }}>{r.text}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      style={
        dense && theme.layout === 'band'
          ? { flexDirection: 'row', gap: px(40) }
          : { gap: px(dense ? 18 : theme.layout === 'band' ? 18 : 28) }
      }
    >
      {rows.map(r => (
        <View key={r.layer} style={[styles.row, dense && theme.layout === 'band' && { flex: 1 }]}>
          {theme.layout === 'band' ? (
            <View style={styles.scarf}>
              {r.viewers.map(v => (
                <View key={v} style={[styles.stripe, { backgroundColor: colorOf(v) }]} />
              ))}
            </View>
          ) : (
            <View style={[styles.rule, { backgroundColor: c.accent }]} />
          )}
          <View style={styles.rowBody}>
            <View style={styles.rowHead}>
              <Text style={{ fontFamily: f.title, fontSize: px(dense ? 40 : theme.layout === 'band' ? 48 : 44), color: c.text }}>
                {joinNames(r.viewers)}
              </Text>
              <Text style={{ fontFamily: f.body, fontSize: px(28), color: c.textDim, marginLeft: px(16) }}>
                {r.layer}
              </Text>
            </View>
            <Text style={{ fontFamily: f.body, fontSize: px(dense ? 28 : 30), lineHeight: px(dense ? 37 : 42), color: c.text }}>
              {r.text}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rule: { width: px(6), borderRadius: px(3), marginRight: px(22) },
  scarf: { flexDirection: 'row', width: px(44), marginRight: px(26) },
  stripe: { flex: 1 },
  rowBody: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: px(4) },
  notes: { flexDirection: 'row', gap: px(36), alignItems: 'flex-start' },
  note: {
    flex: 1,
    maxWidth: px(640),
    paddingHorizontal: px(30),
    paddingTop: px(34),
    paddingBottom: px(26),
    shadowColor: '#1B1F24',
    shadowOffset: { width: 0, height: px(6) },
    shadowOpacity: 0.18,
    shadowRadius: px(10),
  },
  tape: {
    position: 'absolute',
    top: px(-12),
    alignSelf: 'center',
    width: px(120),
    height: px(26),
    backgroundColor: 'rgba(201,209,217,0.8)',
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', marginBottom: px(8) },
  dot: { width: px(18), height: px(18), borderRadius: px(18), marginRight: px(10), borderWidth: px(2), borderColor: '#1B1F24' },
});
