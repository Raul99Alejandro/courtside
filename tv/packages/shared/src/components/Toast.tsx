import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';
import ThemedButton from './ThemedButton';
import { Scarf } from './Scarf';

interface Props {
  text: string;
  /** profile position of the viewer the toast is about: their scarf leads the message */
  viewerIndex: number;
  onUndo: () => void;
}

/**
 * "Leo moved up to Fan" with an Undo the D-pad can reach (R-07).
 * It sits in its own slot under the pitch, in the flow, so it can never cover other text.
 */
export default function Toast({ text, viewerIndex, onUndo }: Props) {
  const c = theme.color;
  return (
    <View testID="toast" style={[styles.box, { backgroundColor: c.strip, borderColor: c.accent }]}>
      <View style={styles.scarf}>
        <Scarf index={viewerIndex} width={px(40)} />
      </View>
      <Text style={{ fontFamily: theme.font.title, fontSize: px(44), color: c.text, flex: 1 }}>{text}</Text>
      <ThemedButton text="Undo" onSelect={onUndo} primary />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(20),
    height: px(88),
    paddingLeft: px(20),
    paddingRight: px(14),
    borderWidth: px(3),
    borderRadius: px(10),
  },
  scarf: { height: px(60), justifyContent: 'flex-start', overflow: 'visible' },
});
