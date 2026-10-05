import { Pressable, StyleSheet, Text } from 'react-native';
import { SpatialNavigationFocusableView } from 'react-tv-space-navigation';
import type { Theme } from '../theme/direction';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  text: string;
  theme: Theme;
  onSelect: () => void;
  primary?: boolean;
}

/** D-pad button with a visible focus state in the direction's own language. */
export default function ThemedButton({ text, theme, onSelect, primary }: Props) {
  const c = theme.color;
  const marker = theme.layout === 'whiteboard';
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          onPress={onSelect}
          style={[
            styles.base,
            {
              borderRadius: marker ? px(14) : theme.layout === 'band' ? px(4) : px(10),
              borderColor: isFocused ? c.focus : marker ? c.text : c.textDim,
              backgroundColor: isFocused ? c.focus : primary ? c.accent : 'transparent',
              borderWidth: px(isFocused ? 5 : 3),
              transform: [{ scale: isFocused ? 1.06 : 1 }],
            },
          ]}
        >
          <Text
            style={{
              fontFamily: theme.font.bodyBold,
              fontSize: px(32),
              color: isFocused ? (marker ? '#FFFFFF' : c.onAccent) : primary ? c.onAccent : c.text,
            }}
          >
            {text}
          </Text>
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
  },
});
