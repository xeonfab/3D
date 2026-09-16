import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  x: number;
  y: number;
  color: string;
  /** 1 = point actif (pulse), 0 = point déjà visité (statique). */
  active: number;
  /** Frame à laquelle le point apparaît (animation d'entrée). */
  appearFrame: number;
};

/** Point pulsant positionné en pixels écran sur la carte. */
export const Pulse = ({ x, y, color, active, appearFrame }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = interpolate(frame - appearFrame, [0, fps * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Pulsation lente et régulière (période 1,6 s) : fonction pure de la frame.
  const period = fps * 1.6;
  const phase = ((frame - appearFrame) % period) / period;
  const ringScale = 1 + phase * 2.4;
  const ringOpacity = (1 - phase) * 0.7 * active;

  const core = 14;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        opacity: appear,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -core * 2,
          top: -core * 2,
          width: core * 4,
          height: core * 4,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          opacity: ringOpacity,
          transform: `scale(${ringScale / 2})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -core / 2,
          top: -core / 2,
          width: core,
          height: core,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${12 + 10 * active}px ${color}`,
          border: "2px solid rgba(255,255,255,0.9)",
          transform: `scale(${0.7 + 0.3 * active + 0.1 * active * Math.sin(phase * Math.PI * 2)})`,
        }}
      />
    </div>
  );
};
