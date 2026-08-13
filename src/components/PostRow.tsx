import { age, compact, multiple, shortDate } from "../lib/format";
import type {
  FlaggedPost,
  Intervention,
  PostNote,
  StreamingCapture,
} from "../lib/types";
import PostDetail from "./PostDetail";
import { brandPath, navigate } from "../lib/router";
import { Thumb } from "./BrandRow";
import { SkipMarker } from "./SkipRateExplainer";

const NETWORK_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

/**
 * variant "score" (default): the multiple leads — Leading / Best Performing.
 * variant "feed": recency leads, the multiple sits quiet on the right.
 * variant "reach": raw views lead — Most Viewed; the multiple is meta.
 */
export default function PostRow(props: {
  post: FlaggedPost;
  notes: PostNote[];
  interventions: Intervention[];
  streaming: StreamingCapture[];
  open: boolean;
  onToggle: () => void;
  reload: () => Promise<void>;
  variant?: "score" | "feed" | "reach";
  /** This account's own median skip rate, for the reel comparison. */
  medianSkip?: number | null;
}) {
  const { post, open } = props;
  const feed = props.variant === "feed";
  const reach = props.variant === "reach";
  const isReel = post.content_type === "reels";
  const noteCount = props.notes.length;

  return (
    <li>
      <div className="flex w-full items-center gap-4 py-4">
        <Thumb url={post.thumbnail_url} />

        {/* Headline number: the multiple (score) or raw views (reach) */}
        {!feed && (
          <span
            className={
              reach
                ? "w-18 shrink-0 text-right font-serif text-2xl leading-none text-accent"
                : post.is_assisted
                  ? "w-18 shrink-0 text-right font-serif text-xl text-dim"
                  : "w-18 shrink-0 text-right font-serif text-[2rem] leading-none text-accent"
            }
          >
            {reach ? compact(post.views) : multiple(post.views_multiple)}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <a
              href={brandPath(post.brand_name)}
              onClick={(e) => {
                e.preventDefault();
                navigate(brandPath(post.brand_name));
              }}
              className="text-[15px] font-semibold hover:underline"
            >
              {post.brand_name}
            </a>
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
            <span className={feed ? "text-ink" : undefined}>
              {age(post.age_days)} old
            </span>
            {reach ? (
              <> · {multiple(post.views_multiple)} its baseline</>
            ) : (
              <>
                {" "}
                · {compact(post.views)} views vs {compact(post.median_views)}{" "}
                median
              </>
            )}
            {isReel &&
              (post.skip_rate !== null || post.avg_watch_seconds !== null) && (
                <span className="text-ink">
                  {" · "}
                  {post.skip_rate !== null && (
                    <>
                      skip {Math.round(post.skip_rate)}%
                      {props.medianSkip != null && (
                        <span className="text-dim">
                          {" "}
                          vs {Math.round(props.medianSkip)}% median
                        </span>
                      )}
                      <SkipMarker skipRate={post.skip_rate} />
                    </>
                  )}
                  {post.skip_rate !== null &&
                    post.avg_watch_seconds !== null &&
                    " · "}
                  {post.avg_watch_seconds !== null &&
                    `${post.avg_watch_seconds.toFixed(1)}s watch`}
                </span>
              )}
            {" · "}
            <button
              className="underline underline-offset-2 hover:text-ink"
              onClick={props.onToggle}
              aria-expanded={open}
            >
              Notes{noteCount > 0 ? ` (${noteCount})` : ""}
            </button>
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
      </div>

      {open && <PostDetail {...props} />}
    </li>
  );
}
