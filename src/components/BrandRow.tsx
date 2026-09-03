import { useState, type ReactNode } from "react";
import { shortDate } from "../lib/format";
import type { RowPost } from "../lib/types";

export const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

export function platformLabel(network: string, contentType: string): string {
  const net = NETWORK_LABEL[network] ?? network;
  return network === "tiktok" ? net : `${net} ${contentType}`;
}

/**
 * Platform identity pill. The theme's accent triples are bg + text + border
 * together — a tint without its border reads as a mistake in this system, so
 * .pill always carries a .plat-* class rather than a bare colour.
 */
export function PlatformPill({
  network,
  contentType,
}: {
  network: string;
  contentType?: string;
}) {
  const known = ["tiktok", "instagram", "youtube", "spotify"].includes(network);
  return (
    <span className={`pill${known ? ` plat-${network}` : ""}`}>
      {contentType ? platformLabel(network, contentType) : NETWORK_LABEL[network] ?? network}
    </span>
  );
}

/**
 * Post image. Instagram CDN URLs carry expiry tokens and start 404ing after a
 * while, so a failed load swaps to a neutral tile of the same size — never a
 * broken-image glyph, never a layout shift.
 */
export function Thumb({ url }: { url: string | null }) {
  // The URL that failed, not a boolean: a component instance outlives the row
  // it started with, and a sticky `failed` flag would keep showing the tile
  // after the post's thumbnail_url changed to one that works. That is not
  // hypothetical if thumbnails are ever cached into storage — the same post
  // would come back with a new URL.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <span aria-hidden className="thumb" />;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
      className="thumb"
    />
  );
}

export function OpenPost({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open post"
      className="btn x"
      style={{ flexShrink: 0, alignSelf: "center", lineHeight: 0 }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

/**
 * One row on a brand or share page. Every row is the same brand, so the
 * caption is the primary line. Design constraint: figures are only ever shown
 * next to the account's OWN median — never a fixed threshold or a
 * roster-wide scale.
 *
 * `is_assisted` is optional because the public share view never receives it.
 */
export function BrandRow(props: {
  post: RowPost;
  headline?: string;
  right?: string;
  meta: string;
  /**
   * Internal-only row affordance, injected as content rather than switched on
   * by a flag. BrandPage and LabelPage pass the paid-marking control here;
   * SharePage and LabelSharePage pass nothing, so a share route cannot render
   * it even by accident. Keep it that way — this is the one seam where an
   * internal control could reach a public page.
   */
  assist?: ReactNode;
}) {
  const { post } = props;
  const title =
    post.caption?.trim() ||
    `${NETWORK_LABEL[post.network] ?? post.network} ${post.content_type}`;
  return (
    <div className={`post${post.is_assisted ? " assisted" : ""}`}>
      <Thumb url={post.thumbnail_url} />
      <div className="meta">
        <div
          className="brand"
          style={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={title}
        >
          {title}
        </div>
        <div className="when" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <PlatformPill network={post.network} />
          {/* Suppressed when an assist control is injected — AssistMark carries
              the marker itself there, and would otherwise say the same thing
              twice. Label pages pass no control, so they keep this line. */}
          {!props.assist && post.is_assisted && post.assisted_from && (
            <span>assisted from {shortDate(post.assisted_from)}</span>
          )}
        </div>
        <div className="when">{props.meta}</div>
        {props.assist && <div style={{ marginTop: 6 }}>{props.assist}</div>}
      </div>
      {props.headline !== undefined && (
        <div className="mult" style={{ flexShrink: 0, textAlign: "right" }}>
          {props.headline}
        </div>
      )}
      {props.right !== undefined && (
        <div className="num" style={{ flexShrink: 0, alignSelf: "center", color: "var(--muted)", fontWeight: 700 }}>
          {props.right}
        </div>
      )}
      <OpenPost href={post.permalink} />
    </div>
  );
}

/** KPI tile. */
export function Stat(props: { value: string; label: string; meta?: string }) {
  return (
    <div className="kpi">
      <div className="k">{props.label}</div>
      <div className="v">{props.value}</div>
      {props.meta && <div className="m">{props.meta}</div>}
    </div>
  );
}

/** Per-platform median table — the comparison a single pooled number destroys. */
export function PlatformTable(props: {
  rows: {
    network: string;
    content_type: string;
    posts: number;
    median_views: number | null;
    median_engagement_rate: number | null;
    median_completion_pct: number | null;
  }[];
  compact: (n: number | null) => string;
}) {
  if (props.rows.length === 0) return null;
  return (
    <div className="scroll">
      <table className="t">
        <thead>
          <tr>
            <th></th>
            <th>Posts</th>
            <th>Median views</th>
            <th>Median engagement</th>
            <th>Median completion</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((pl) => (
            <tr key={`${pl.network}-${pl.content_type}`}>
              <td>{platformLabel(pl.network, pl.content_type)}</td>
              <td>{pl.posts}</td>
              <td>
                {pl.median_views !== null ? props.compact(pl.median_views) : ""}
              </td>
              <td>
                {pl.median_engagement_rate !== null
                  ? pl.median_engagement_rate.toFixed(1)
                  : ""}
              </td>
              <td>
                {pl.median_completion_pct !== null
                  ? `${Math.round(pl.median_completion_pct)}%`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Label tags. A brand with two labels shows two. */
export function LabelTags({
  labels,
  onNavigate,
}: {
  labels: string[] | null | undefined;
  onNavigate?: (name: string) => void;
}) {
  if (!labels || labels.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {labels.map((l) =>
        onNavigate ? (
          <button
            key={l}
            className="pill"
            style={{ cursor: "pointer", background: "none" }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(l);
            }}
          >
            {l}
          </button>
        ) : (
          <span key={l} className="pill">
            {l}
          </span>
        ),
      )}
    </span>
  );
}
