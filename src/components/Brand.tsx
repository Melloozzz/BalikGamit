import { Link } from "react-router";
import logo from "../assets/logo.png";

type Tone = "onDark" | "onLight";

/** "Balik" + "Gamit". On dark backgrounds Balik is white; on light ones it uses the logo's dark teal. */
export function Wordmark({ tone = "onDark", size = 28 }: { tone?: Tone; size?: number }) {
  return (
    <span className={`wordmark wordmark--${tone}`} style={{ fontSize: size }}>
      <span className="wordmark__balik">Balik</span>
      <span className="wordmark__gamit">Gamit</span>
    </span>
  );
}

export function LogoMark({ height = 40 }: { height?: number }) {
  return <img src={logo} alt="" width={Math.round((height * 118) / 156)} height={height} className="logo-mark" />;
}

/** The logo on a white rounded tile, used on navy backgrounds. */
export function LogoTile({ size = 48 }: { size?: number }) {
  return (
    <span className="logo-tile" style={{ width: size, height: size, borderRadius: size * 0.21 }}>
      <LogoMark height={Math.round(size * 0.76)} />
    </span>
  );
}

/** Logo tile + wordmark + campus lines, as on the landing and login screens. */
export function BrandLockup({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand-lockup" aria-label="BalikGamit home">
      <LogoTile size={88} />
      <span className="brand-lockup__text">
        <Wordmark size={45} />
        <span className="brand-lockup__sub">RIZAL TECHNOLOGICAL UNIVERSITY — PASIG CAMPUS</span>
        <span className="brand-lockup__sub">LOST &amp; FOUND SYSTEM</span>
      </span>
    </Link>
  );
}
