import { useState } from "react";
import { age, compact, multiple, shortDate } from "../lib/format";
import type {
  FlaggedPost,
  Intervention,
  PostNote,
  StreamingCapture,
} from "../lib/types";
import PostDetail from "./PostDetail";

const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

/**
 * Post image, Metricool-grid style. Instagram CDN URLs carry expiry tokens
 * and start 404ing after a while, so a failed load swaps to a neutral tile
 * of the same size — never a broken-image glyph, never a layout shift.
 */
function Thumb({ url }: { url: string | null }) {
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
 * variant "score" (default): the multiple leads — Leading / Best Performing.
 * variant "feed": recency leads, the multiple sits quiet on the right —
 * the Latest sections.
 */
export default function PostRow(props: {
  post: FlaggedPost;
  notes: PostNote[];
  interventions: Intervention[];
  streaming: StreamingCapture[];
  open: boolean;
  onToggle: () => void;
  reload: () => Promise<void>;
  variant?: "score" | "feed";
}) {
  const { post, open } = props;
  const feed = props.variant === "feed";
  const isReel = post.content_type === "reels";

  return (
    <li>
      <button
        className="flex w-full items-center gap-4 py-4 text-left"
        onClick={props.onToggle}
        aria-expanded={open}
      >
        <Thumb url={post.thumbnail_url} />

        {/* In score rows the multiple is the loudest thing on the page */}
        {!feed && (
          <span
            className={
              post.is_assisted
                ? "w-18 shrink-0 text-right font-serif text-xl text-dim"
                : "w-18 shrink-0 text-right font-serif text-[2rem] leading-none text-accent"
            }
          >
            {multiple(post.views_multiple)}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15px] font-semibold">{post.brand_name}</span>
            <span className="text-xs text-dim">
              {NETWORK_LABEL[post.network] ?? post.network}{" "}
              {post.content_type === "posts"
                ? "post"
                : post.content_type.replace(/s$/, "")}
            </span>
            {post.is_assisted && post.assisted_from && (
              <span className="text-xs italic text-dim">
                assisted from {shortDate(post.assisted_from)}
              </span>
            )}
          </span>
          {post.caption && (
            <span className="mt-0.5 block truncate text-sm text-dim">
              {post.caption}
            </span>
          )}
          <span className="mt-1 block text-[13px] text-dim">
            {feed ? (
              <span className="text-ink">{age(post.age_days)} old</span>
            ) : (
              <span>{age(post.age_days)} old</span>
            )}{" "}
            · {compact(post.views)} views vs {compact(post.median_views)} median
            {isReel &&
              (post.skip_rate !== null || post.avg_watch_seconds !== null) && (
                <span className="text-ink">
                  {" · "}
                  {post.skip_rate !== null &&
                    `skip ${Math.round(post.skip_rate)}%`}
                  {post.skip_rate !== null &&
                    post.avg_watch_seconds !== null &&
                    " · "}
                  {post.avg_watch_seconds !== null &&
                    `${post.avg_watch_seconds.toFixed(1)}s watch`}
                </span>
              )}
            {props.notes.length > 0 && (
              <span>
                {" "}
                · {props.notes.length} note{props.notes.length > 1 ? "s" : ""}
              </span>
            )}
          </span>
        </span>

        {feed && (
          <span
            className={
              post.is_assisted
                ? "shrink-0 self-center font-serif text-sm italic text-dim/70"
                : "shrink-0 self-center font-serif text-base text-dim"
            }
          >
            {multiple(post.views_multiple)}
          </span>
        )}

        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
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
      </button>

      {open && <PostDetail {...props} />}
    </li>
  );
}
