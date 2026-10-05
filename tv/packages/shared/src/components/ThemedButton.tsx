import { Pressable, StyleSheet, Text } from 'react-native';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import { theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  text: string;
  onSelect: () => void;
  primary?: boolean;
}

/** D-pad button: floodlight yellow when primary, a chalk outline otherwise; a thick white ring and a lift on focus. */
export default function ThemedButton({ text, onSelect, primary }: Props) {
  const c = theme.color;
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          onPress={onSelect}
          style={[
            styles.base,
            {
              borderColor: isFocused ? '#FFFFFF' : c.textDim,
              backgroundColor: isFocused ? (primary ? c.accent : c.text) : primary ? c.accent : 'transparent',
              borderWidth: px(isFocused ? 6 : 3),
              transform: [{ scale: isFocused ? 1.06 : 1 }],
            },
          ]}
        >
          <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(32), color: isFocused || primary ? c.onAccent : c.text }}>{text}</Text>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: px(180),
    minHeight: px(76),
    paddingHorizontal: px(36),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: px(10),
  },
});
