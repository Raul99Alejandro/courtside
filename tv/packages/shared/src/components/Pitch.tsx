import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Moment } from '@courtside/core';
import type { Theme } from '../theme/direction';

interface PitchProps {
  moment: Moment;
  theme: Theme;
  width: number;
  /** colour of the moment team's players and of the other team's players */
  mine: string;
  theirs: string;
  /** extra grass drawn left and right of the 120x80 pitch, in pitch units (direction C band) */
  bleed?: number;
  /** short name of the actor, written on the board in direction B */
  actorName?: string;
}

const GOAL_Y1 = 36.34;
const GOAL_Y2 = 43.66;
const PAD = 2.5;

/** The 120x80 StatsBomb pitch, attacking left to right, scaled to `width`. */
export default function Pitch({ moment, theme, width, mine, theirs, bleed = 0, actorName = '' }: PitchProps) {
  const p = theme.pitch;
  const vbW = 120 + PAD * 2 + bleed * 2;
  const vbH = 80 + PAD * 2;
  const height = (width * vbH) / vbW;
  const lw = p.lineWidth;
  const stripes = Array.from({ length: 12 + Math.ceil(bleed / 10) * 2 }, (_, i) => i);
  const x0 = -PAD - bleed;
  const ball = moment.ball;
  const actor = moment.players?.find(q => q.actor);
  const isShot = moment.what === 'Shot' && !!ball;
  const name = actorName;
  const r = p.magnets ? 2.2 : 1.8;
  const opp = p.opponent ?? theirs;
  const hand = theme.font.hand;

  return (
    <Svg width={width} height={height} viewBox={`${x0} ${-PAD} ${vbW} ${vbH}`}>
      {p.grass !== 'transparent' && (
        <G>
          <Rect x={x0} y={-PAD} width={vbW} height={vbH} fill={p.grass} />
          {stripes.map(i => {
            const sx = -10 * Math.ceil((bleed + PAD) / 10) + i * 10;
            return i % 2 ? <Rect key={i} x={sx} y={-PAD} width={10} height={vbH} fill={p.stripe} /> : null;
          })}
        </G>
      )}
      <G stroke={p.line} strokeWidth={lw} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Rect x={0} y={0} width={120} height={80} />
        <Line x1={60} y1={0} x2={60} y2={80} />
        <Circle cx={60} cy={40} r={10} />
        <Rect x={0} y={18} width={18} height={44} />
        <Rect x={102} y={18} width={18} height={44} />
        <Rect x={0} y={30} width={6} height={20} />
        <Rect x={114} y={30} width={6} height={20} />
        <Path d="M18 32.7 A10 10 0 0 1 18 47.3" />
        <Path d="M102 47.3 A10 10 0 0 1 102 32.7" />
        <Rect x={-2} y={GOAL_Y1} width={2} height={GOAL_Y2 - GOAL_Y1} />
        <Rect x={120} y={GOAL_Y1} width={2} height={GOAL_Y2 - GOAL_Y1} />
      </G>
      <G fill={p.line}>
        <Circle cx={60} cy={40} r={0.7} />
        <Circle cx={12} cy={40} r={0.6} />
        <Circle cx={108} cy={40} r={0.6} />
      </G>

      {isShot && ball && (
        <Line
          x1={ball[0]}
          y1={ball[1]}
          x2={120}
          y2={40}
          stroke={p.shot}
          strokeWidth={theme.pitch.magnets ? 0.9 : 0.7}
          strokeDasharray="2 1.6"
          strokeLinecap="round"
        />
      )}

      {moment.players?.filter(q => !q.actor).map((q, i) => {
        const fill = q.teammate ? mine : opp;
        const sw = p.magnets ? 0.55 : 0.4;
        return (
          <G key={i}>
            {q.keeper ? (
              <Rect x={q.x - r} y={q.y - r} width={r * 2} height={r * 2} rx={0.5} fill={fill} stroke={p.playerStroke} strokeWidth={sw} />
            ) : (
              <Circle cx={q.x} cy={q.y} r={r} fill={fill} stroke={p.playerStroke} strokeWidth={sw} />
            )}
            {p.magnets && <Circle cx={q.x - 0.7} cy={q.y - 0.7} r={0.55} fill="#FFFFFF" opacity={0.55} />}
          </G>
        );
      })}

      {actor && (
        <G>
          <Circle cx={actor.x} cy={actor.y} r={4.6} fill={p.actorRing} opacity={0.22} />
          <Circle cx={actor.x} cy={actor.y} r={3.5} fill="none" stroke={p.actorRing} strokeWidth={0.8} />
          <Circle cx={actor.x} cy={actor.y} r={r + 0.4} fill={mine} stroke={p.playerStroke} strokeWidth={p.magnets ? 0.6 : 0.5} />
        </G>
      )}

      {ball && (
        <G>
          <Circle cx={ball[0]} cy={ball[1]} r={1.3} fill={p.ball} stroke={p.ballStroke} strokeWidth={0.45} />
        </G>
      )}

      {hand && ball && name !== '' && (
        <G>
          <SvgText x={Math.min(ball[0], 112) - 38} y={Math.max(ball[1] - 17, 6)} fontFamily={hand} fontSize={5} fill={p.shot}>
            {name}
          </SvgText>
          <Path
            d={`M${Math.min(ball[0], 112) - 20} ${Math.max(ball[1] - 17, 6) + 1.5} Q ${Math.min(ball[0], 112) - 8} ${Math.max(ball[1] - 17, 6) + 1} ${ball[0] - 3.2} ${ball[1] - 3.4}`}
            stroke={p.shot}
            strokeWidth={0.8}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={`M${ball[0] - 5.4} ${ball[1] - 3.1} L${ball[0] - 3.2} ${ball[1] - 3.4} L${ball[0] - 4.2} ${ball[1] - 5.4}`}
            stroke={p.shot}
            strokeWidth={0.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      )}
    </Svg>
  );
}
