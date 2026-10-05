import { StyleSheet, Text, View } from 'react-native';
import type { CardRow } from '../data/match';
import { joinNames } from '../data/headline';
import { householdIndex } from '../data/demo-household';
import { theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';
import { ScarfStripe } from './Scarf';

interface Props {
  rows: CardRow[];
  /** three layers at once: tighter type */
  dense?: boolean;
}

/** One row per layer needed, lowest first, starting with the scarf stripe of each viewer it is for (R-08). */
export default function CardRows({ rows, dense }: Props) {
  const c = theme.color;
  const f = theme.font;
  return (
    <View style={{ gap: px(dense ? 18 : 28) }}>
      {rows.map(r => (
        <View key={r.layer} style={styles.row}>
          <View style={styles.stripes}>
            {r.viewers.map(v => (
              <ScarfStripe key={v} index={householdIndex(v)} width={px(14)} />
            ))}
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowHead}>
              <Text style={{ fontFamily: f.title, fontSize: px(dense ? 40 : 44), color: c.text }}>{joinNames(r.viewers)}</Text>
              <Text style={{ fontFamily: f.body, fontSize: px(28), color: c.textDim, marginLeft: px(16) }}>{r.layer}</Text>
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
  stripes: { flexDirection: 'row', gap: px(4), marginRight: px(22) },
  rowBody: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: px(4) },
});
