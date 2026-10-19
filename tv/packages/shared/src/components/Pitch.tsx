import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Moment } from '@courtside/core';
import { theme } from '../theme/courtside';
import { offsideLineX, placeNote, type Box, type Point } from '../data/annotations';

interface PitchProps {
  moment: Moment;
  width: number;
  /** colour of the moment team's players and of the other team's players */
  mine: string;
  theirs: string;
  /** short name of the actor, written on the pitch in marker handwriting */
  actorName?: string;
}

const GOAL_Y1 = 36.34;
const GOAL_Y2 = 43.66;
const PAD = 2.5;
const BOUNDS = { minX: -PAD + 0.5, maxX: 120 + PAD - 0.5, minY: -PAD + 0.5, maxY: 80 + PAD - 0.5 };
/** Kalam bold: an average glyph is about this fraction of the font size wide. */
const GLYPH = 0.5;

interface Note {
  text: string;
  box: Box;
  /** the thing the arrow points at; none for a label that sits on what it names */
  to?: Point;
  /** how far short of `to` the arrowhead stops (the actor's ring needs room) */
  stop?: number;
}

/** An arrow from the note towards `to`, ending just short of it. Returns the curve and the arrowhead. */
function arrow(box: Box, to: Point, stop: number) {
  const from = { x: Math.min(Math.max(to.x, box.x), box.x + box.w), y: Math.min(Math.max(to.y, box.y), box.y + box.h) };
  // start from the middle of the nearest side, so the arrow leaves the writing and not the corner
  const inside = from.x === to.x && from.y === to.y;
  const sx = Math.abs(to.x - (box.x + box.w / 2)) > box.w / 2 ? from.x : box.x + box.w / 2;
  const sy = Math.abs(to.y - (box.y + box.h / 2)) > box.h / 2 ? from.y : box.y + box.h / 2;
  const dx = to.x - sx;
  const dy = to.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ex = to.x - ux * stop;
  const ey = to.y - uy * stop;
  const bend = Math.min(len * 0.18, 4);
  const cx = (sx + ex) / 2 - uy * bend;
  const cy = (sy + ey) / 2 + ux * bend;
  const head = 2.4;
  const ang = Math.atan2(ey - cy, ex - cx);
  const h1 = { x: ex - Math.cos(ang - 0.5) * head, y: ey - Math.sin(ang - 0.5) * head };
  const h2 = { x: ex - Math.cos(ang + 0.5) * head, y: ey - Math.sin(ang + 0.5) * head };
  return {
    show: !inside && len > stop + 1,
    d: `M${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,
    head: `M${h1.x} ${h1.y} L${ex} ${ey} L${h2.x} ${h2.y}`,
  };
}

/** The 120x80 StatsBomb pitch, attacking left to right, scaled to `width`, with marker notes on top. */
export default function Pitch({ moment, width, mine, theirs, actorName = '' }: PitchProps) {
  const p = theme.pitch;
  const vbW = 120 + PAD * 2;
  const vbH = 80 + PAD * 2;
  const height = (width * vbH) / vbW;
  const lw = p.lineWidth;
  const ball = moment.ball;
  const actor = moment.players?.find(q => q.actor);
  const isShot = moment.what === 'Shot' && !!ball;
  const r = 1.8;
  const noteColor = theme.color.note;
  const halo = theme.color.bg;

  // marker notes: about 32 screen pixels tall, whatever the pitch size
  const fs = Math.max(5, 32 / (width / vbW));
  const noteW = (text: string) => text.length * fs * GLYPH + 1.5;
  const noteH = fs * 1.1;
  const players: Point[] = (moment.players ?? []).map(q => ({ x: q.x, y: q.y }));
  const notes: Note[] = [];
  const lineX = offsideLineX(moment);
  const taken: Box[] = [];
  if (lineX !== undefined) {
    // the offside note sits at the top of the line, on the side with more room
    const w = noteW('offside line');
    const left = lineX - w - 1.5 >= BOUNDS.minX;
    const box = { x: left ? lineX - w - 1.5 : lineX + 1.5, y: 1.2, w, h: noteH };
    taken.push(box, { x: lineX - 0.8, y: 0, w: 1.6, h: 80 });
    notes.push({ text: 'offside line', box });
  }
  const target = actor ?? (ball ? { x: ball[0], y: ball[1] } : undefined);
  if (target && actorName) {
    const w = noteW(actorName);
    notes.push({ text: actorName, box: placeNote(target, w, noteH, players, BOUNDS, taken), to: target, stop: 4.9 });
  }
  if (moment.outcome === 'Goal' && ball) {
    const w = noteW('goal');
    const goalMouth = { x: 120, y: 40 };
    const other = notes.map(n => n.box);
    const box = placeNote(goalMouth, w, noteH, players, BOUNDS, [...taken, ...other], 2.5);
    // in a crowded box there is no clean place for a second note: the name and the ring already say it
    if (box.clear) notes.push({ text: 'goal', box });
  }

  return (
    // keyed by moment: the Vega react-native-svg port leaves removed children (old names, arrows) on screen,
    // so each moment gets a fresh drawing instead of an in-place update
    <Svg key={moment.id} width={width} height={height} viewBox={`${-PAD} ${-PAD} ${vbW} ${vbH}`}>
      <G>
        <Rect x={-PAD} y={-PAD} width={vbW} height={vbH} fill={p.grass} />
        {Array.from({ length: 12 }, (_, i) =>
          i % 2 ? <Rect key={i} x={-10 + i * 10} y={-PAD} width={10} height={vbH} fill={p.stripe} /> : null,
        )}
      </G>
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

      {lineX !== undefined && (
        <Line x1={lineX} y1={0} x2={lineX} y2={80} stroke={noteColor} strokeWidth={0.6} strokeDasharray="2.2 1.6" strokeLinecap="round" />
      )}

      {isShot && ball && (
        <Line x1={ball[0]} y1={ball[1]} x2={120} y2={40} stroke={p.shot} strokeWidth={0.7} strokeDasharray="2 1.6" strokeLinecap="round" />
      )}

      {moment.players
        ?.filter(q => !q.actor)
        .map((q, i) => {
          const fill = q.teammate ? mine : theirs;
          return q.keeper ? (
            <Rect key={i} x={q.x - r} y={q.y - r} width={r * 2} height={r * 2} rx={0.5} fill={fill} stroke={p.playerStroke} strokeWidth={0.4} />
          ) : (
            <Circle key={i} cx={q.x} cy={q.y} r={r} fill={fill} stroke={p.playerStroke} strokeWidth={0.4} />
          );
        })}

      {actor && (
        <G>
          <Circle cx={actor.x} cy={actor.y} r={4.6} fill={p.actorRing} opacity={0.22} />
          <Circle cx={actor.x} cy={actor.y} r={3.5} fill="none" stroke={p.actorRing} strokeWidth={0.8} />
          <Circle cx={actor.x} cy={actor.y} r={r + 0.4} fill={mine} stroke={p.playerStroke} strokeWidth={0.5} />
        </G>
      )}

      {ball && <Circle cx={ball[0]} cy={ball[1]} r={1.3} fill={p.ball} stroke={p.ballStroke} strokeWidth={0.45} />}

      {notes.map(n => {
        const a = n.to && arrow(n.box, n.to, n.stop ?? 0);
        const baseline = n.box.y + n.box.h * 0.78;
        const common = { x: n.box.x, y: baseline, fontFamily: theme.font.note, fontSize: fs };
        return (
          <G key={n.text}>
            {/* a dark halo under the writing keeps it readable on the stripes */}
            <SvgText {...common} fill={halo} stroke={halo} strokeWidth={fs * 0.28} strokeLinejoin="round">
              {n.text}
            </SvgText>
            <SvgText {...common} fill={noteColor}>
              {n.text}
            </SvgText>
            {a?.show && (
              <G fill="none" strokeLinecap="round" strokeLinejoin="round">
                <Path d={a.d} stroke={halo} strokeWidth={1.7} />
                <Path d={a.head} stroke={halo} strokeWidth={1.7} />
                <Path d={a.d} stroke={noteColor} strokeWidth={0.8} />
                <Path d={a.head} stroke={noteColor} strokeWidth={0.8} />
              </G>
            )}
          </G>
        );
      })}
    </Svg>
  );
}
