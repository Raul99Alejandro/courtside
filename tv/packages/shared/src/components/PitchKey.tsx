import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  mine: string;
  theirs: string;
  mineName: string;
  theirsName: string;
}

/** What the dots on the pitch mean: the two teams, and the square for a goalkeeper. */
export default function PitchKey({ mine, theirs, mineName, theirsName }: Props) {
  const c = theme.color;
  const text = { fontFamily: theme.font.body, fontSize: px(28), color: c.textDim };
  const swatch = (color: string, square?: boolean) => (
    <View style={[styles.swatch, { backgroundColor: color, borderColor: theme.pitch.playerStroke, borderRadius: square ? px(3) : px(14) }]} />
  );
  const item = (sw: React.ReactElement, label: string) => (
    <View style={styles.item}>
      {sw}
      <Text style={text}>{label}</Text>
    </View>
  );
  return (
    <View style={styles.row}>
      {item(swatch(mine), mineName)}
      {item(swatch(theirs), theirsName)}
      {item(swatch(c.textDim, true), 'Goalkeeper')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: px(28), rowGap: px(8) },
  item: { flexDirection: 'row', alignItems: 'center', gap: px(10) },
  swatch: { width: px(26), height: px(26), borderWidth: px(2), marginRight: px(2) },
});
