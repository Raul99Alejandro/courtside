import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '../theme/direction';
import { scaledPixels as px } from '../hooks/useScale';
import ThemedButton from './ThemedButton';

interface Props {
  text: string;
  theme: Theme;
  onUndo: () => void;
}

/** "Leo moved up to Fan" with an Undo the D-pad can reach (R-07). */
export default function Toast({ text, theme, onUndo }: Props) {
  const c = theme.color;
  const marker = theme.layout === 'whiteboard';
  const band = theme.layout === 'band';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, ANCHOR[theme.layout]]}>
      <View
        style={[
          styles.box,
          {
            backgroundColor: marker ? '#FFE58A' : band ? c.surface : '#08110C',
            borderColor: marker ? c.text : c.accent,
            borderWidth: px(marker ? 4 : 3),
            borderRadius: marker ? px(6) : px(band ? 2 : 10),
            transform: [{ rotate: marker ? '-1deg' : '0deg' }],
          },
        ]}
      >
        {band && (
          <View style={styles.scarf}>
            {['#F2C230', '#7FB8E6', '#FF6B57'].map(k => (
              <View key={k} style={{ flex: 1, backgroundColor: k }} />
            ))}
          </View>
        )}
        <Text
          style={{
            fontFamily: theme.font.title,
            fontSize: px(46),
            color: marker ? c.text : c.text,
            marginRight: px(32),
          }}
        >
          {text}
        </Text>
        <ThemedButton text="Undo" theme={theme} onSelect={onUndo} primary />
      </View>
    </View>
  );
}

/** Where the toast sits so it covers the timeline, the least important part, in each layout. */
const ANCHOR = {
  board: { left: px(96), bottom: px(40) },
  whiteboard: { left: px(96), top: px(585) },
  band: { left: px(640), top: px(40) },
} as const;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'flex-start' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: px(18),
    paddingLeft: px(44),
    paddingRight: px(22),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: px(24),
    shadowOffset: { width: 0, height: px(8) },
  },
  scarf: { position: 'absolute', left: 0, top: 0, bottom: 0, width: px(24), flexDirection: 'row' },
});
