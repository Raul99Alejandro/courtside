import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationNode } from 'react-tv-space-navigation';
import type { Moment } from '@courtside/core';
import { theme } from '../theme/courtside';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  moments: Moment[];
  selectedId: string;
  initialId: string;
  onSelect: (id: string) => void;
  width: number;
}

/** One tick per moment; D-pad left/right moves between moments and the screen follows focus. */
export default function Timeline({ moments, selectedId, initialId, onSelect, width }: Props) {
  const c = theme.color;
  const slot = width / moments.length;
  return (
    <View style={{ width }}>
      <Text style={{ fontFamily: theme.font.body, fontSize: px(28), color: c.textDim, marginBottom: px(4) }}>Moments in this match</Text>
      <SpatialNavigationNode orientation="horizontal">
        <View style={[styles.row, { height: px(80) }]}>
          {moments.map(m => {
            const selected = m.id === selectedId;
            const goal = m.outcome === 'Goal';
            const tick = (
              <SpatialNavigationFocusableView
                viewProps={{ accessibilityLabel: `Minute ${m.minute}${goal ? ', goal' : ''}` }}
                onFocus={() => onSelect(m.id)}
                onSelect={() => onSelect(m.id)}
              >
                {({ isFocused }) => {
                  const hot = selected || isFocused;
                  return (
                    <View style={[styles.slot, { width: slot, height: px(80) }]}>
                      {goal && <View style={[styles.goalDot, { backgroundColor: hot ? c.accent : c.text }]} />}
                      <View
                        style={{
                          padding: px(4),
                          borderWidth: px(3),
                          borderRadius: px(10),
                          borderColor: isFocused ? c.focus : 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: px(12),
                            height: px(hot ? 54 : goal ? 42 : 28),
                            borderRadius: px(4),
                            backgroundColor: hot ? c.accent : c.text,
                            opacity: hot ? 1 : goal ? 0.95 : 0.5,
                          }}
                        />
                      </View>
                    </View>
                  );
                }}
              </SpatialNavigationFocusableView>
            );
            return m.id === initialId ? <DefaultFocus key={m.id}>{tick}</DefaultFocus> : <View key={m.id}>{tick}</View>;
          })}
        </View>
      </SpatialNavigationNode>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  slot: { alignItems: 'center', justifyContent: 'flex-end' },
  goalDot: { width: px(8), height: px(8), borderRadius: px(8), marginBottom: px(4) },
});
