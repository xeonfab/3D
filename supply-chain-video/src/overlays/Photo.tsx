import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_TIMING } from "../defaults";
import { fadeInOut } from "./fade";
import { useLayout } from "./layout";

type Props = {
  file: string;
  /** Héros : bas plein cadre en 9:16, tiers droit en 16:9. Sinon vignette bas droite. */
  large: boolean;
  start: number;
  end: number;
  fadeSeconds?: number;
};

export const Photo = ({ file, large, start, end, fadeSeconds = DEFAULT_TIMING.cardFadeSeconds }: Props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = useLayout();
  const fade = Math.round(fadeSeconds * fps);
  const opacity = fadeInOut(frame, start, end, fade);
  const scale = interpolate(frame, [start, start + fade], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (large) {
    const style = L.portrait
      ? {
          left: 0,
          bottom: 0,
          width,
          height: L.largePhotoHeight,
          // Fondu vers la carte sur le haut de la photo.
          maskImage: "linear-gradient(to top, black 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 78%, transparent 100%)",
        }
      : {
          right: 0,
          top: 0,
          width: L.largePhotoWidth,
          height,
          maskImage: "linear-gradient(to right, transparent 0%, black 18%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 18%)",
        };
    return (
      <div style={{ position: "absolute", ...style, opacity, overflow: "hidden" }}>
        <Img
          src={staticFile(file)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transform: `scale(${scale})`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        right: L.margin,
        bottom: L.margin,
        width: L.photoSize,
        height: L.photoSize,
        borderRadius: L.radius,
        overflow: "hidden",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "bottom right",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        border: "3px solid rgba(255,255,255,0.85)",
      }}
    >
      <Img
        src={staticFile(file)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
};
