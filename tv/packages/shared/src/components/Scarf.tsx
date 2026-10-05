import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { scarfFor } from '@courtside/core';
import { theme } from '../theme/courtside';

type ScarfProps = { index: number };

/** A scarf hanging from the neck: the viewer's identity, drawn once and reused. width:height is 2:3. */
export function Scarf({ index, width }: ScarfProps & { width: number }) {
  const { color, striped } = scarfFor(index);
  const night = theme.color.bg;
  const bands = striped ? [5, 14, 23, 32, 41] : [32, 40];
  const bandH = striped ? 4.5 : 4;
  return (
    <Svg width={width} height={(width * 3) / 2} viewBox="0 0 40 60">
      <Rect x={4} y={0} width={32} height={48} rx={1.5} fill={color} />
      {bands.map(y => (
        <Rect key={y} x={4} y={y} width={32} height={bandH} fill={night} />
      ))}
      {[8.5, 14.25, 20, 25.75, 31.5].map((x, i) => (
        <Line key={x} x1={x} y1={48} x2={x} y2={i % 2 ? 56 : 58.5} stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

/** The flat stripe at the start of a card row; two viewers on one row give two stripes side by side. */
export function ScarfStripe({ index, width }: ScarfProps & { width: number }) {
  const { color, striped } = scarfFor(index);
  if (!striped) return <View style={{ width, backgroundColor: color }} />;
  return (
    <View style={[styles.col, { width }]}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? theme.color.bg : color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ col: { flexDirection: 'column' } });
