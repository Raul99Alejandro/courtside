import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import type { Viewer } from '@courtside/core';
import { DEMO_CODE, HOUSEHOLD, LEVEL_LABEL, PHONE_URL } from '../data/demo-household';
import { selection, togglePick } from '../data/picking';
import { theme } from '../theme/courtside';
import { safeZones } from '../theme/safeZones';
import { scaledPixels as px } from '../hooks/useScale';
import ThemedButton from '../components/ThemedButton';
import { Scarf } from '../components/Scarf';

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;

export default function Watching() {
  const navigation = useNavigation<{ navigate: (n: string) => void }>();
  const [present, setPresent] = useState<string[]>(['Leo', 'Ana']);
  const [message, setMessage] = useState<string | undefined>();
  const c = theme.color;

  const toggle = useCallback((name: string) => {
    setPresent(p => {
      const r = togglePick(p, name);
      setMessage(r.message);
      return r.present;
    });
  }, []);
  const start = useCallback(() => {
    selection.names = present;
    navigation.navigate('Replay');
  }, [present, navigation]);

  return (
    <SpatialNavigationRoot isActive>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Haze color={c.accent} />
        <View style={styles.pad}>
          <SpatialNavigationNode orientation="vertical">
            <View style={styles.main}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontFamily: theme.font.title, fontSize: px(96), color: c.text }}>Who's watching?</Text>
                <Text style={{ fontFamily: theme.font.body, fontSize: px(32), color: c.textDim, marginBottom: px(36) }}>
                  Pick up to 3. Each person gets an explanation at their own level.
                </Text>
                <SpatialNavigationNode orientation="horizontal">
                  <View style={styles.cards}>
                    {HOUSEHOLD.map((v, i) => {
                      const card = <ProfileCard viewer={v} index={i} picked={present.includes(v.name)} onSelect={() => toggle(v.name)} />;
                      return i === 0 ? <DefaultFocus key={v.name}>{card}</DefaultFocus> : <View key={v.name}>{card}</View>;
                    })}
                  </View>
                </SpatialNavigationNode>
                <View style={{ height: px(56), justifyContent: 'center', marginTop: px(20) }}>
                  {message && <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(34), color: c.accent }}>{message}</Text>}
                </View>
                <SpatialNavigationNode orientation="horizontal">
                  <View style={{ marginTop: px(10), alignSelf: 'flex-start' }}>
                    <ThemedButton text="Start watching" onSelect={start} primary />
                  </View>
                </SpatialNavigationNode>
              </View>
              <AddSomeone />
            </View>
          </SpatialNavigationNode>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

/** A profile tile: the viewer's scarf, their name and level; a yellow ring and "Watching" when picked. */
function ProfileCard({ viewer, index, picked, onSelect }: { viewer: Viewer; index: number; picked: boolean; onSelect: () => void }) {
  const c = theme.color;
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          onPress={onSelect}
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: isFocused ? c.text : picked ? c.accent : 'transparent',
              borderWidth: px(isFocused ? 8 : picked ? 5 : 0),
              transform: [{ scale: isFocused ? 1.05 : 1 }],
            },
          ]}
        >
          <View style={{ marginBottom: px(12) }}>
            <Scarf index={index} width={px(110)} />
          </View>
          <Text style={{ fontFamily: theme.font.title, fontSize: px(52), color: c.text }}>{viewer.name}</Text>
          <Text style={{ fontFamily: theme.font.body, fontSize: px(30), color: c.textDim }}>{LEVEL_LABEL[viewer.level]}</Text>
          <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(30), marginTop: px(10), color: picked ? c.accent : 'transparent' }}>
            Watching
          </Text>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

function AddSomeone() {
  const c = theme.color;
  return (
    <View style={[styles.add, { backgroundColor: c.surface, borderColor: c.accent }]}>
      <Text style={{ fontFamily: theme.font.title, fontSize: px(46), color: c.text }}>Add someone</Text>
      <Text style={{ fontFamily: theme.font.body, fontSize: px(30), color: c.textDim, marginBottom: px(18) }}>
        Scan with your phone, or enter the code.
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', padding: px(14), alignSelf: 'flex-start' }}>
        <QRCode value={PHONE_URL} size={px(260)} color="#0E1A14" backgroundColor="#FFFFFF" />
      </View>
      <Text style={{ fontFamily: theme.font.title, fontSize: px(64), color: c.accent, letterSpacing: px(5), marginTop: px(16) }}>{DEMO_CODE}</Text>
    </View>
  );
}

function Haze({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="hz" cx="8%" cy="-5%" rx="75%" ry="95%" fx="8%" fy="-5%">
          <Stop offset="0" stopColor={color} stopOpacity={0.42} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.12} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#hz)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  pad: { flex: 1, paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V) },
  main: { flex: 1, flexDirection: 'row', gap: px(44), paddingTop: px(20) },
  cards: { flexDirection: 'row', gap: px(28) },
  card: { width: px(290), height: px(420), alignItems: 'center', justifyContent: 'center', gap: px(4), borderRadius: px(12) },
  add: { width: px(440), paddingHorizontal: px(32), paddingVertical: px(28), alignSelf: 'center', borderWidth: px(2), borderRadius: px(12) },
});
