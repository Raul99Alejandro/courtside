import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../theme/direction';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  theme: Theme;
  mine: string;
  theirs: string;
  mineName: string;
  theirsName: string;
}

/** What the dots on the pitch mean: the two teams, and the square for a goalkeeper. */
export default function PitchKey({ theme, mine, theirs, mineName, theirsName }: Props) {
  const c = theme.color;
  const text = { fontFamily: theme.font.body, fontSize: px(28), color: c.textDim };
  const swatch = (color: string, square?: boolean) => (
    <View
      style={[
        styles.swatch,
        { backgroundColor: color, borderColor: theme.pitch.playerStroke, borderRadius: square ? px(3) : px(14) },
      ]}
    />
  );
  return (
    <View style={styles.row}>
      {swatch(mine)}
      <Text style={text}>{mineName}</Text>
      {swatch(theirs)}
      <Text style={text}>{theirsName}</Text>
      {swatch(c.textDim, true)}
      <Text style={text}>Goalkeeper</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: px(12) },
  swatch: { width: px(26), height: px(26), borderWidth: px(2), marginRight: px(2) },
});
