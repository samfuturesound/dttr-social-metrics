import { navigate } from "../lib/router";

/** The four accent colours as a hairline across the top. Co-pub has the same. */
export function TopStripe() {
  return (
    <div className="topstripe" aria-hidden>
      <i style={{ background: "var(--a1)" }} />
      <i style={{ background: "var(--a2)" }} />
      <i style={{ background: "var(--a3)" }} />
      <i style={{ background: "var(--a4)" }} />
    </div>
  );
}

/**
 * Dance to the Radio mark, top left on every page.
 *
 * Served from public/ rather than imported, so the same URL works from the
 * app bar, the share bar and the gate. The artwork is a solid black field, so
 * it occupies the same slot the .fsmark text block did and keeps the blocky
 * treatment — sized and radiused to match it rather than floated as an image.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <img
      src="/dttr-logo.png"
      alt="Dance to the Radio"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "block",
        borderRadius: "var(--r-ctl)",
        objectFit: "cover",
      }}
    />
  );
}

/**
 * Internal app bar. Never rendered on a /share route — those get ShareBar,
 * which carries no navigation at all.
 */
export function AppBar(props: {
  current: "board" | "ask" | "brand" | "label";
  onBrands?: () => void;
  onSignOut?: () => void;
  backTo?: { href: string; label: string };
}) {
  return (
    <header className="appbar">
      <div className="inner">
        <Logo />
        <span className="apptitle">Social Metrics</span>
        <nav>
          <button
            className={`tab${props.current === "board" ? " on" : ""}`}
            onClick={() => navigate("/")}
          >
            Board
          </button>
          <button
            className={`tab${props.current === "ask" ? " on" : ""}`}
            onClick={() => navigate("/ask")}
          >
            AI Summarise
          </button>
          {props.onBrands && (
            <button className="tab" onClick={props.onBrands}>
              Brands
            </button>
          )}
          {props.onSignOut && (
            <button className="tab" onClick={props.onSignOut}>
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

/**
 * Public share bar. No nav, no links back into the dashboard — the share
 * pages are a dead end by design, and that predates this restyle.
 */
export function ShareBar({ subtitle }: { subtitle?: string }) {
  return (
    <header className="appbar">
      <div className="inner">
        <Logo />
        <span className="apptitle">
          Dance to the Radio
          {subtitle && (
            <span style={{ color: "var(--muted)", fontWeight: 500 }}>
              {" "}
              · {subtitle}
            </span>
          )}
        </span>
      </div>
    </header>
  );
}
