import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationFocusableView, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { scarfIndex, type Viewer } from '@courtside/core';
import { DEMO_CODE, HOUSEHOLD, LEVEL_LABEL, PHONE_URL } from '../data/demo-household';
import { defaultPick, selection, togglePick } from '../data/picking';
import { phoneUrl, useLive } from '../live';
import { isDemo } from './screen';
import { theme } from '../theme/courtside';
import { safeZones } from '../theme/safeZones';
import { scaledPixels as px } from '../hooks/useScale';
import ThemedButton from '../components/ThemedButton';
import { Scarf } from '../components/Scarf';

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;
const MAX_PER_ROW = 4;
const demo = isDemo();

interface WatchingModel {
  viewers: Viewer[];
  /** The code and QR address, once the household exists. */
  pairing?: { code: string; url: string };
  notice?: string;
  /** Starts the session; resolves with a message when it was refused. */
  start: (present: string[]) => Promise<string | undefined>;
  /** Viewers picked from the start (demo only); live starts with everyone, up to 3. */
  initialPick?: string[];
}

function useDemoModel(): WatchingModel {
  return {
    viewers: HOUSEHOLD,
    pairing: { code: DEMO_CODE, url: PHONE_URL },
    initialPick: ['Leo', 'Ana'],
    start: async present => {
      selection.names = present;
      return undefined;
    },
  };
}

function useLiveModel(): WatchingModel {
  const { state, live } = useLive();
  return {
    viewers: state.viewers,
    pairing: state.ready && state.code && state.siteUrl ? { code: state.code, url: phoneUrl(state.siteUrl, state.code) } : undefined,
    notice: state.notice,
    start: async present => {
      const r = await live.startSession(present);
      return r.ok ? undefined : r.message;
    },
  };
}

const useModel = demo ? useDemoModel : useLiveModel;

const chunk = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export default function Watching() {
  const navigation = useNavigation<{ navigate: (n: string) => void }>();
  const focused = useIsFocused(); // only the screen on top listens to the D-pad: a hidden Start button must not fire again
  const model = useModel();
  const { viewers } = model;
  const [present, setPresent] = useState<string[]>(model.initialPick ?? []);
  const [touched, setTouched] = useState(!!model.initialPick);
  const [message, setMessage] = useState<string | undefined>();
  const c = theme.color;

  // Until someone picks by hand, everyone (up to 3) is watching; people removed from the household drop out.
  useEffect(() => {
    setPresent(p => {
      const names = viewers.map(v => v.name);
      const kept = p.filter(n => names.includes(n));
      return touched ? kept : defaultPick(names);
    });
  }, [viewers, touched]);

  const toggle = useCallback((name: string) => {
    setTouched(true);
    setPresent(p => {
      const r = togglePick(p, name);
      setMessage(r.message);
      return r.present;
    });
  }, []);
  const start = useCallback(async () => {
    if (present.length === 0) {
      setMessage(viewers.length ? 'Pick who is watching.' : 'Add someone from your phone first.');
      return;
    }
    const refused = await model.start(present);
    if (refused) setMessage(refused);
    else navigation.navigate('Replay');
  }, [present, viewers.length, model, navigation]);

  const compact = viewers.length > MAX_PER_ROW;
  const shown = message ?? model.notice;

  return (
    // Remount when the list goes from empty to filled: late joiners must register above the button in D-pad order.
    <SpatialNavigationRoot key={viewers.length === 0 ? "empty" : "list"} isActive={focused}>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Haze color={c.accent} />
        <View style={styles.pad}>
          <SpatialNavigationNode orientation="vertical">
            <View style={styles.main}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontFamily: theme.font.title, fontSize: px(96), color: c.text }}>Who's watching?</Text>
                <Text style={{ fontFamily: theme.font.body, fontSize: px(32), color: c.textDim, marginBottom: px(compact ? 20 : 36) }}>
                  Pick up to 3. Each person gets an explanation at their own level.
                </Text>
                {/* This node stays mounted while the list is empty: people who join later must land above the button in D-pad order. */}
                <SpatialNavigationNode orientation="vertical">
                {viewers.length === 0 ? (
                  <View style={[styles.empty, { backgroundColor: c.surface }]}>
                    <Text style={{ fontFamily: theme.font.title, fontSize: px(52), color: c.text }}>Nobody here yet</Text>
                    <Text style={{ fontFamily: theme.font.body, fontSize: px(32), color: c.textDim }}>Scan the code with your phone to add yourself.</Text>
                  </View>
                ) : (
                  <View style={{ gap: px(24) }}>
                      {chunk(viewers, MAX_PER_ROW).map((row, r) => (
                        <SpatialNavigationNode key={r} orientation="horizontal">
                          <View style={styles.cards}>
                            {row.map((v, k) => {
                              const i = r * MAX_PER_ROW + k;
                              const card = <ProfileCard viewer={v} index={scarfIndex(viewers, v.name)} compact={compact} picked={present.includes(v.name)} onSelect={() => toggle(v.name)} />;
                              return i === 0 ? <DefaultFocus key={v.name}>{card}</DefaultFocus> : <View key={v.name}>{card}</View>;
                            })}
                          </View>
                        </SpatialNavigationNode>
                      ))}
                  </View>
                )}
                </SpatialNavigationNode>
                <View style={{ minHeight: px(56), justifyContent: 'center', marginTop: px(compact ? 8 : 20) }}>
                  {shown && <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(34), color: c.accent }}>{shown}</Text>}
                </View>
                <SpatialNavigationNode orientation="horizontal">
                  <View style={{ marginTop: px(10), alignSelf: 'flex-start' }}>
                    <ThemedButton text="Start watching" onSelect={() => void start()} primary />
                  </View>
                </SpatialNavigationNode>
              </View>
              <AddSomeone pairing={model.pairing} />
            </View>
          </SpatialNavigationNode>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

/** A profile tile: the viewer's scarf, their name and level; a yellow ring and "Watching" when picked. */
function ProfileCard({ viewer, index, picked, compact, onSelect }: { viewer: Viewer; index: number; picked: boolean; compact: boolean; onSelect: () => void }) {
  const c = theme.color;
  return (
    <SpatialNavigationFocusableView onSelect={onSelect}>
      {({ isFocused }) => (
        <Pressable
          onPress={onSelect}
          style={[
            styles.card,
            compact && styles.cardCompact,
            {
              backgroundColor: c.surface,
              borderColor: isFocused ? c.text : picked ? c.accent : 'transparent',
              borderWidth: px(isFocused ? 8 : picked ? 5 : 0),
              transform: [{ scale: isFocused ? 1.05 : 1 }],
            },
          ]}
        >
          <View style={{ marginBottom: compact ? 0 : px(12) }}>
            <Scarf index={index} width={px(compact ? 56 : 110)} />
          </View>
          <View style={{ alignItems: compact ? 'flex-start' : 'center' }}>
            <Text style={{ fontFamily: theme.font.title, fontSize: px(compact ? 44 : 52), color: c.text }}>{viewer.name}</Text>
            <Text style={{ fontFamily: theme.font.body, fontSize: px(30), color: c.textDim }}>{LEVEL_LABEL[viewer.level]}</Text>
            <Text style={{ fontFamily: theme.font.bodyBold, fontSize: px(30), marginTop: px(compact ? 0 : 10), color: picked ? c.accent : 'transparent' }}>
              Watching
            </Text>
          </View>
        </Pressable>
      )}
    </SpatialNavigationFocusableView>
  );
}

function AddSomeone({ pairing }: { pairing?: { code: string; url: string } }) {
  const c = theme.color;
  return (
    <View style={[styles.add, { backgroundColor: c.surface, borderColor: c.accent }]}>
      <Text style={{ fontFamily: theme.font.title, fontSize: px(46), color: c.text }}>Add someone</Text>
      <Text style={{ fontFamily: theme.font.body, fontSize: px(30), color: c.textDim, marginBottom: px(18) }}>
        {pairing ? 'Scan with your phone, or enter the code.' : 'Connecting to Courtside...'}
      </Text>
      {pairing && (
        <>
          <View style={{ backgroundColor: '#FFFFFF', padding: px(14), alignSelf: 'flex-start' }}>
            <QRCode value={pairing.url} size={px(260)} color="#0E1A14" backgroundColor="#FFFFFF" />
          </View>
          <Text style={{ fontFamily: theme.font.title, fontSize: px(64), color: c.accent, letterSpacing: px(5), marginTop: px(16) }}>{pairing.code}</Text>
        </>
      )}
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
  cardCompact: { height: px(170), flexDirection: 'row', gap: px(20) },
  empty: { padding: px(36), borderRadius: px(12), maxWidth: px(900), gap: px(8) },
  add: { width: px(440), paddingHorizontal: px(32), paddingVertical: px(28), alignSelf: 'center', borderWidth: px(2), borderRadius: px(12) },
});
