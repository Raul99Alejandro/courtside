import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import type { Viewer } from '@courtside/core';
import { DEMO_CODE, HOUSEHOLD, LEVEL_LABEL, PHONE_URL } from '../data/demo-household';
import { selection, togglePick } from '../data/picking';
import { getTheme } from '../theme/getTheme';
import type { Theme } from '../theme/direction';
import { safeZones } from '../theme/safeZones';
import { scaledPixels as px } from '../hooks/useScale';
import ThemedButton from '../components/ThemedButton';
import { currentDirection } from './direction';

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;

export default function Watching() {
  const theme = useMemo(() => getTheme(currentDirection()), []);
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

  const stripes = present.map(n => theme.viewer[HOUSEHOLD.findIndex(v => v.name === n)]);

  return (
    <SpatialNavigationRoot isActive>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {theme.layout === 'board' && <Haze color={c.accent} />}
        {theme.layout === 'whiteboard' && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: px(16), borderColor: c.surface }]} />
        )}
        {theme.layout === 'band' && (
          <>
            <ScarfEdge colors={stripes} top />
            <ScarfEdge colors={stripes} />
          </>
        )}
        <View style={styles.pad}>
          <SpatialNavigationNode orientation="vertical">
            <View style={styles.main}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontFamily: theme.font.title, fontSize: px(theme.layout === 'whiteboard' ? 80 : 96), color: c.text }}>
                  Who's watching?
                </Text>
                <Text style={{ fontFamily: theme.font.body, fontSize: px(32), color: c.textDim, marginBottom: px(36) }}>
                  Pick up to 3. Each person gets an explanation at their own level.
                </Text>
                <SpatialNavigationNode orientation="horizontal">
                  <View style={styles.cards}>
                    {HOUSEHOLD.map((v, i) => {
                      const card = (
                        <ProfileCard
                          viewer={v}
                          color={theme.viewer[i]}
                          picked={present.includes(v.name)}
                          theme={theme}
                          tilt={[-1.5, 1, -0.8, 1.4][i]}
                          onSelect={() => toggle(v.name)}
                        />
                      );
                      return i === 0 ? <DefaultFocus key={v.name}>{card}</DefaultFocus> : <View key={v.name}>{card}</View>;
                    })}
                  </View>
                </SpatialNavigationNode>
                <View style={{ height: px(56), justifyContent: 'center', marginTop: px(20) }}>
                  {message && (
                    <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(34), color: c.accent }}>{message}</Text>
                  )}
                </View>
                <SpatialNavigationNode orientation="horizontal">
                  <View style={{ marginTop: px(10), alignSelf: 'flex-start' }}>
                    <ThemedButton text="Start watching" theme={theme} onSelect={start} primary />
                  </View>
                </SpatialNavigationNode>
              </View>
              <AddSomeone theme={theme} />
            </View>
          </SpatialNavigationNode>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

function ProfileCard({
  viewer,
  color,
  picked,
  theme,
  tilt,
  onSelect,
}: {
  viewer: Viewer;
  color: string;
  picked: boolean;
  theme: Theme;
  tilt: number;
  onSelect: () => void;
}) {
  const c = theme.color;
  const l = theme.layout;
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          onPress={onSelect}
          style={[
            styles.card,
            {
              backgroundColor: l === 'whiteboard' ? color : l === 'band' ? c.surface : c.surface,
              borderColor: isFocused ? (l === 'board' ? c.text : c.focus) : picked ? (l === 'whiteboard' ? c.text : c.accent) : l === 'whiteboard' ? c.text : 'transparent',
              borderWidth: px(isFocused ? 8 : picked ? 5 : l === 'whiteboard' ? 2 : 0),
              borderRadius: l === 'band' ? px(2) : l === 'whiteboard' ? px(4) : px(12),
              transform: [{ scale: isFocused ? 1.05 : 1 }, { rotate: l === 'whiteboard' ? `${tilt}deg` : '0deg' }],
            },
          ]}
        >
          {l === 'band' ? (
            <View style={styles.scarfBlock}>
              {[color, c.bg, color].map((k, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: k }} />
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: l === 'whiteboard' ? '#FFFFFF' : color,
                  borderColor: l === 'whiteboard' ? c.text : 'transparent',
                  borderWidth: l === 'whiteboard' ? px(4) : 0,
                },
              ]}
            >
              <Text style={{ fontFamily: theme.font.title, fontSize: px(72), color: l === 'whiteboard' ? c.text : c.onAccent }}>
                {viewer.name[0]}
              </Text>
            </View>
          )}
          <Text style={{ fontFamily: theme.font.title, fontSize: px(52), color: l === 'whiteboard' ? c.text : c.text }}>
            {viewer.name}
          </Text>
          <Text style={{ fontFamily: theme.font.body, fontSize: px(30), color: l === 'whiteboard' ? c.textDim : c.textDim }}>
            {LEVEL_LABEL[viewer.level]}
          </Text>
          <Text
            style={{
              fontFamily: theme.font.bodyBold,
              fontSize: px(30),
              marginTop: px(10),
              color: picked ? (l === 'whiteboard' ? c.text : c.accent) : 'transparent',
            }}
          >
            Watching
          </Text>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

function AddSomeone({ theme }: { theme: Theme }) {
  const c = theme.color;
  const marker = theme.layout === 'whiteboard';
  return (
    <View
      style={[
        styles.add,
        {
          backgroundColor: marker ? '#FFFFFF' : c.surface,
          borderColor: marker ? c.text : c.accent,
          borderWidth: px(marker ? 3 : 2),
          borderRadius: marker ? px(4) : theme.layout === 'band' ? px(2) : px(12),
        },
      ]}
    >
      <Text style={{ fontFamily: theme.font.title, fontSize: px(46), color: c.text }}>Add someone</Text>
      <Text style={{ fontFamily: theme.font.body, fontSize: px(30), color: c.textDim, marginBottom: px(18) }}>
        Scan with your phone, or enter the code.
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', padding: px(14), alignSelf: 'flex-start' }}>
        <QRCode value={PHONE_URL} size={px(260)} color="#0E1A14" backgroundColor="#FFFFFF" />
      </View>
      <Text style={{ fontFamily: theme.font.title, fontSize: px(64), color: c.accent, letterSpacing: px(5), marginTop: px(16) }}>
        {DEMO_CODE}
      </Text>
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

/** C: the scarves of the people watching frame the screen. */
function ScarfEdge({ colors, top }: { colors: string[]; top?: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.edge, top ? { top: 0 } : { bottom: 0 }]}>
      {Array.from({ length: 24 }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: colors[i % Math.max(colors.length, 1)] ?? '#2B3550' }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject },
  pad: { flex: 1, paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V) },
  main: { flex: 1, flexDirection: 'row', gap: px(44), paddingTop: px(20) },
  cards: { flexDirection: 'row', gap: px(28) },
  card: { width: px(290), height: px(420), alignItems: 'center', justifyContent: 'center', gap: px(4) },
  avatar: { width: px(150), height: px(150), borderRadius: px(150), alignItems: 'center', justifyContent: 'center', marginBottom: px(10) },
  scarfBlock: { width: px(170), height: px(150), flexDirection: 'row', marginBottom: px(10) },
  add: { width: px(440), paddingHorizontal: px(32), paddingVertical: px(28), alignSelf: 'center' },
  edge: { position: 'absolute', left: 0, right: 0, height: px(26), flexDirection: 'row' },
});
