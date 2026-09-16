import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  x: number;
  y: number;
  color: string;
  /** 1 = étape courante (pulse), 0 = déjà visitée. */
  active: number;
  appearFrame: number;
  scale?: number;
};

/** Point pulsant couleur de marque, positionné en pixels écran. */
export const Pulse = ({ x, y, color, active, appearFrame, scale = 1 }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = interpolate(frame - appearFrame, [0, fps * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const period = fps * 1.6;
  const phase = ((((frame - appearFrame) % period) + period) % period) / period;
  const ringScale = 1 + phase * 2.4;
  const ringOpacity = (1 - phase) * 0.7 * active;
  const core = 14 * scale;

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
          border: `${3 * scale}px solid ${color}`,
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
          boxShadow: `0 0 ${(12 + 10 * active) * scale}px ${color}`,
          border: `${2 * scale}px solid rgba(255,255,255,0.9)`,
          transform: `scale(${0.7 + 0.3 * active + 0.08 * active * Math.sin(phase * Math.PI * 2)})`,
        }}
      />
    </div>
  );
};
