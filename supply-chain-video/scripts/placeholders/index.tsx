import { AbsoluteFill, Composition, registerRoot } from "remotion";

/*
 * Compositions utilitaires pour générer des visuels de substitution
 * (logo + photos) quand on n'a pas encore les vrais fichiers :
 *   npx remotion still scripts/placeholders/index.tsx logo   public/logo.png
 *   npx remotion still scripts/placeholders/index.tsx farm   public/farm.jpg
 *   npx remotion still scripts/placeholders/index.tsx roaster public/roaster.jpg
 * Le texte et la couleur sont passés en props (--props='{"label":"…"}').
 */

type Props = { label: string; color: string; from: string; to: string; transparent: boolean };

const Placeholder = ({ label, color, from, to, transparent }: Props) => (
  <AbsoluteFill
    style={{
      background: transparent ? "transparent" : `linear-gradient(160deg, ${from}, ${to})`,
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, Helvetica, Arial, sans-serif",
      color: "white",
    }}
  >
    {transparent ? (
      <div
        style={{
          width: "84%",
          height: "84%",
          borderRadius: "50%",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 260,
          fontWeight: 800,
          boxShadow: `inset 0 0 0 28px rgba(255,255,255,0.25)`,
        }}
      >
        {label}
      </div>
    ) : (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, fontWeight: 700, textShadow: "0 4px 24px rgba(0,0,0,.5)" }}>
          {label}
        </div>
        <div style={{ fontSize: 28, opacity: 0.75, marginTop: 12 }}>photo de substitution</div>
      </div>
    )}
  </AbsoluteFill>
);

const defaults: Props = {
  label: "",
  color: "#D9822B",
  from: "#4a3222",
  to: "#1c130d",
  transparent: false,
};

registerRoot(() => (
  <>
    <Composition id="logo" component={Placeholder} width={600} height={600} fps={1}
      durationInFrames={1} defaultProps={{ ...defaults, label: "TL", transparent: true }} />
    <Composition id="farm" component={Placeholder} width={900} height={900} fps={1}
      durationInFrames={1} defaultProps={{ ...defaults, label: "Ferme", from: "#3b6b3a", to: "#14260f" }} />
    <Composition id="roaster" component={Placeholder} width={900} height={900} fps={1}
      durationInFrames={1} defaultProps={{ ...defaults, label: "Atelier", from: "#6b4a2b", to: "#2a1a0e" }} />
  </>
));
