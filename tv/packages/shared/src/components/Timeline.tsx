import { StyleSheet, Text, View } from 'react-native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationNode } from 'react-tv-space-navigation';
import type { Moment } from '@courtside/core';
import type { Theme } from '../theme/direction';
import { scaledPixels as px } from '../hooks/useScale';

interface Props {
  moments: Moment[];
  selectedId: string;
  initialId: string;
  onSelect: (id: string) => void;
  theme: Theme;
  width: number;
  /** tick colour per team in the scarf direction */
  teamTick?: (team: string) => string;
}

/** One tick per moment; D-pad left/right moves between moments and the screen follows focus. */
export default function Timeline({ moments, selectedId, initialId, onSelect, theme, width, teamTick }: Props) {
  const c = theme.color;
  const slot = width / moments.length;
  const layout = theme.layout;
  return (
    <View style={{ width }}>
      <Text style={{ fontFamily: theme.font.body, fontSize: px(28), color: c.textDim, marginBottom: px(4) }}>
        Moments in this match
      </Text>
      <SpatialNavigationNode orientation="horizontal">
        <View style={[styles.row, { height: px(80) }]}>
          {layout === 'whiteboard' && <View pointerEvents="none" style={[styles.axis, { backgroundColor: c.text }]} />}
          {moments.map(m => {
            const selected = m.id === selectedId;
            const goal = m.outcome === 'Goal';
            const tick = (
              <SpatialNavigationFocusableView onFocus={() => onSelect(m.id)} onSelect={() => onSelect(m.id)}>
                {({ isFocused }) => {
                  const hot = selected || isFocused;
                  let body;
                  if (layout === 'whiteboard') {
                    const d = px(hot ? 30 : goal ? 24 : 16);
                    body = (
                      <View
                        style={{
                          width: d,
                          height: d,
                          borderRadius: d,
                          borderWidth: px(3),
                          borderColor: hot ? c.accent : c.text,
                          backgroundColor: hot ? c.accent : goal ? '#FFE58A' : c.bg,
                        }}
                      />
                    );
                  } else {
                    const stripe = layout === 'band';
                    const base = stripe && teamTick ? teamTick(m.team) : c.text;
                    body = (
                      <View
                        style={{
                          width: px(stripe ? 14 : 12),
                          height: px(hot ? 54 : goal ? 42 : 28),
                          borderRadius: px(stripe ? 2 : 4),
                          backgroundColor: hot ? c.accent : base,
                          opacity: hot ? 1 : goal ? 0.95 : 0.5,
                        }}
                      />
                    );
                  }
                  return (
                    <View style={[styles.slot, { width: slot, height: px(80) }]}>
                      {goal && layout !== 'whiteboard' && (
                        <View style={[styles.goalDot, { backgroundColor: hot ? c.accent : c.text }]} />
                      )}
                      <View
                        style={{
                          padding: px(4),
                          borderWidth: px(3),
                          borderRadius: px(10),
                          borderColor: isFocused ? (layout === 'whiteboard' ? c.text : c.focus) : 'transparent',
                        }}
                      >
                        {body}
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
  axis: { position: 'absolute', left: 0, right: 0, bottom: px(14), height: px(3) },
});
