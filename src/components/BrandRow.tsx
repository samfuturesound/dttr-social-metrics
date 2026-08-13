import { useState } from "react";
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
 * Post image, Metricool-grid style. Instagram CDN URLs carry expiry tokens
 * and start 404ing after a while, so a failed load swaps to a neutral tile
 * of the same size — never a broken-image glyph, never a layout shift.
 */
export function Thumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span
        aria-hidden
        className="h-12 w-12 shrink-0 self-center rounded-sm bg-line"
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 self-center rounded-sm object-cover"
    />
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
}) {
  const { post } = props;
  const title =
    post.caption?.trim() ||
    `${NETWORK_LABEL[post.network] ?? post.network} ${post.content_type}`;
  return (
    <li className="flex w-full items-center gap-4 py-4">
      <Thumb url={post.thumbnail_url} />
      {props.headline !== undefined && (
        <span
          className={
            post.is_assisted
              ? "w-18 shrink-0 text-right font-serif text-xl text-dim"
              : "w-18 shrink-0 text-right font-serif text-[1.75rem] leading-none text-accent"
          }
        >
          {props.headline}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="block truncate text-sm">{title}</span>
          <span className="text-xs text-dim">
            {NETWORK_LABEL[post.network] ?? post.network}
          </span>
          {post.is_assisted && post.assisted_from && (
            <span className="text-xs italic text-dim">
              assisted from {shortDate(post.assisted_from)}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] text-dim">{props.meta}</span>
      </span>
      {props.right !== undefined && (
        <span className="shrink-0 self-center font-serif text-base text-dim">
          {props.right}
        </span>
      )}
      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 self-center p-1 text-dim/70 hover:text-ink"
          title="Open post"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </li>
  );
}

export function Stat(props: { value: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-2xl leading-tight">{props.value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.15em] text-dim">
        {props.label}
      </div>
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
    <div className="mt-6 overflow-x-auto">
      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.15em] text-dim">
            <th className="py-2 pr-4 font-medium"></th>
            <th className="py-2 pr-4 font-medium">Posts</th>
            <th className="py-2 pr-4 font-medium">Median views</th>
            <th className="py-2 pr-4 font-medium">Median engagement</th>
            <th className="py-2 font-medium">Median completion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {props.rows.map((pl) => (
            <tr key={`${pl.network}-${pl.content_type}`}>
              <td className="py-2.5 pr-4">
                {platformLabel(pl.network, pl.content_type)}
              </td>
              <td className="py-2.5 pr-4 font-serif">{pl.posts}</td>
              <td className="py-2.5 pr-4 font-serif">
                {pl.median_views !== null ? props.compact(pl.median_views) : ""}
              </td>
              <td className="py-2.5 pr-4 font-serif">
                {pl.median_engagement_rate !== null
                  ? pl.median_engagement_rate.toFixed(1)
                  : ""}
              </td>
              <td className="py-2.5 font-serif">
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

/** Small grey label tags. A brand with two labels shows two. */
export function LabelTags({
  labels,
  onNavigate,
}: {
  labels: string[] | null | undefined;
  onNavigate?: (name: string) => void;
}) {
  if (!labels || labels.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {labels.map((l) =>
        onNavigate ? (
          <button
            key={l}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(l);
            }}
            className="rounded-full border border-line px-2 py-px text-[10px] uppercase tracking-wider text-dim hover:border-dim hover:text-ink"
          >
            {l}
          </button>
        ) : (
          <span
            key={l}
            className="rounded-full border border-line px-2 py-px text-[10px] uppercase tracking-wider text-dim"
          >
            {l}
          </span>
        ),
      )}
    </span>
  );
}
