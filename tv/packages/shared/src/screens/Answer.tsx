import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationRoot } from 'react-tv-space-navigation';
import { answerLayerForQuestion, scarfIndex, type Layer, type Moment } from '@courtside/core';
import { CARDS, MATCH, MOMENTS } from '../data/matchData';
import { DEMO_QUESTION, HOUSEHOLD, householdIndex } from '../data/demo-household';
import { momentName, momentTitle } from '../data/headline';
import { teamColor, theme } from '../theme/courtside';
import { safeZones } from '../theme/safeZones';
import { scaledPixels as px } from '../hooks/useScale';
import { liveController, useLive } from '../live';
import { isDemo } from './screen';
import Pitch from '../components/Pitch';
import ThemedButton from '../components/ThemedButton';
import { Scarf, ScarfStripe } from '../components/Scarf';
import { popTo } from '../navigation/popTo';

const SAFE_H = safeZones.titleSafe.horizontal;
const SAFE_V = safeZones.titleSafe.vertical;
/** An answer stays up this long, then the TV returns to the replay (or shows the next one waiting). */
export const ANSWER_SECONDS = 20;

interface AnswerModel {
  /** Identifies the answer on screen, so a timer or Back for an older one cannot drop a newer one. */
  id: number;
  name: string;
  index: number;
  layer: Layer;
  question: string;
  answer: string;
  moment: Moment;
  caption: string;
  waiting: number;
  dismiss: () => void;
}

const fallbackMoment = () => MOMENTS.find(m => m.id === DEMO_QUESTION.momentId) ?? MOMENTS[0]!;

function useDemoModel(): AnswerModel | undefined {
  const q = DEMO_QUESTION;
  const viewer = HOUSEHOLD.find(v => v.name === q.viewer) ?? HOUSEHOLD[0]!;
  const moment = fallbackMoment();
  const who = momentName(moment, CARDS[moment.id]);
  return {
    id: 0,
    name: viewer.name,
    index: householdIndex(viewer.name),
    layer: answerLayerForQuestion(viewer, 'offside'),
    question: q.text,
    answer: q.answer,
    moment,
    caption: `Minute ${moment.minute}: ${who}'s pass is ruled offside`,
    waiting: 0,
    dismiss: () => undefined,
  };
}

/** The first answer in the queue, from the phone's push; undefined when there is none (the screen then leaves). */
function useLiveModel(): AnswerModel | undefined {
  const { state, live } = useLive();
  const cur = state.answers[0];
  if (!cur) return undefined;
  const moment = MOMENTS.find(m => m.id === state.momentId) ?? fallbackMoment();
  const asker = state.viewers.find(v => v.name.toLowerCase() === cur.label.toLowerCase());
  return {
    id: cur.id,
    name: cur.label,
    index: asker ? scarfIndex(state.viewers, asker.name) : 0,
    layer: cur.layer,
    question: cur.question,
    answer: cur.answer,
    moment,
    caption: `Minute ${moment.minute}: ${momentTitle(moment, CARDS[moment.id])}`,
    waiting: state.answers.length - 1,
    dismiss: () => live.dismissAnswer(cur.id),
  };
}

const useModel = isDemo() ? useDemoModel : useLiveModel;

/** A question asked from a phone, answered on the TV at that viewer's layer (R-06). */
export default function Answer() {
  const navigation = useNavigation<{ navigate: (n: string) => void; popTo?: (n: string) => void; addListener: (e: 'beforeRemove', cb: () => void) => () => void }>();
  const focused = useIsFocused(); // only the screen on top listens to the D-pad: a hidden Start button must not fire again
  const model = useModel();
  const hasSession = !!useLiveSession();
  const id = model?.id;
  const demo = isDemo();

  // 20 s on screen, then the next waiting answer or back to the replay.
  useEffect(() => {
    if (demo || id === undefined) return;
    const t = setTimeout(() => liveController().dismissAnswer(id), ANSWER_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [demo, id]);
  // Leaving by the remote's Back counts as dismissing this answer (never the next one that arrives meanwhile).
  useEffect(() => (demo ? undefined : navigation.addListener('beforeRemove', () => liveController().dismissAnswer(id))), [demo, navigation, id]);
  // Nothing left to show: back to the replay, or to Who's watching when the session is over.
  useEffect(() => {
    if (!demo && !model) popTo(navigation, hasSession ? 'Replay' : 'Watching');
  }, [demo, model, hasSession, navigation]);

  const c = theme.color;
  const font = theme.font;
  if (!model) return <View style={[styles.screen, { backgroundColor: c.bg }]} />;
  const { moment } = model;
  const qSize = model.question.length <= 40 ? 104 : model.question.length <= 100 ? 56 : 40;
  const other = MATCH.teams.find(t => t !== moment.team) ?? '';

  return (
    <SpatialNavigationRoot isActive={focused}>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <Haze color={c.accent} />
        <View style={styles.pad}>
          <View style={{ flex: 1, maxWidth: px(960) }}>
            <View style={styles.asked}>
              <Scarf index={model.index} width={px(52)} />
              <Text style={{ fontFamily: font.title, fontSize: px(52), color: c.text }}>{model.name} asked</Text>
              <Text style={{ fontFamily: font.body, fontSize: px(30), color: c.textDim }}>from their phone</Text>
            </View>
            <Text style={{ fontFamily: font.title, fontSize: px(qSize), lineHeight: px(qSize === 104 ? 104 : qSize + 6), color: c.text, marginBottom: px(40) }}>
              {model.question}
            </Text>
            <View style={[styles.answer, { backgroundColor: c.surface }]}>
              <View style={{ marginRight: px(28) }}>
                <ScarfStripe index={model.index} width={px(14)} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: px(10) }}>
                  <Text style={{ fontFamily: font.title, fontSize: px(52), color: c.text }}>{model.name}</Text>
                  <Text style={{ fontFamily: font.body, fontSize: px(30), color: c.textDim, marginLeft: px(16) }}>{model.layer}</Text>
                </View>
                <Text style={{ fontFamily: font.body, fontSize: px(38), lineHeight: px(54), color: c.text }}>{model.answer}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <SpatialNavigationNode orientation="horizontal">
              <DefaultFocus>
                <View style={styles.footer}>
                  <ThemedButton text={model.waiting ? 'Next question' : 'Back to replay'} onSelect={() => (demo ? navigation.navigate('Replay') : model.dismiss())} primary />
                  {model.waiting > 0 && (
                    <Text style={{ fontFamily: font.bodyBold, fontSize: px(32), color: c.accent }}>
                      {model.waiting === 1 ? '1 more question waiting' : `${model.waiting} more questions waiting`}
                    </Text>
                  )}
                </View>
              </DefaultFocus>
            </SpatialNavigationNode>
          </View>
          <View style={styles.right}>
            <Pitch
              moment={moment}
              width={px(760)}
              mine={teamColor(moment.team, '#fff')}
              theirs={teamColor(other, '#888')}
              actorName={momentName(moment, CARDS[moment.id])}
            />
            <Text style={{ fontFamily: font.bodyBold, fontSize: px(32), color: c.text, marginTop: px(14) }}>{model.caption}</Text>
            <Text style={{ fontFamily: font.body, fontSize: px(28), color: c.textDim, marginTop: px(6) }}>Data: StatsBomb Open Data</Text>
          </View>
        </View>
      </View>
    </SpatialNavigationRoot>
  );
}

/** Whether a live session is running (demo has none; the hook is only reached in live mode). */
function useLiveSession(): string | undefined {
  return isDemo() ? undefined : useLive().state.sessionId; // eslint-disable-line react-hooks/rules-of-hooks
}

/** Warm floodlight haze: a lamp glow from the upper left corner. */
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
  pad: { flex: 1, flexDirection: 'row', paddingHorizontal: px(SAFE_H), paddingVertical: px(SAFE_V), gap: px(60) },
  asked: { flexDirection: 'row', alignItems: 'center', gap: px(18), marginBottom: px(14) },
  answer: { flexDirection: 'row', borderRadius: px(12), padding: px(36) },
  footer: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: px(28) },
  right: { flex: 1, justifyContent: 'center' },
});
