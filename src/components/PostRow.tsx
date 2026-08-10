import { age, compact, multiple, shortDate } from "../lib/format";
import type {
  FlaggedPost,
  Intervention,
  PostNote,
  StreamingCapture,
} from "../lib/types";
import PostDetail from "./PostDetail";

const NETWORK_LABEL: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  facebook: "FB",
};

export default function PostRow(props: {
  post: FlaggedPost;
  notes: PostNote[];
  interventions: Intervention[];
  streaming: StreamingCapture[];
  email: string;
  open: boolean;
  onToggle: () => void;
  reload: () => Promise<void>;
}) {
  const { post, open } = props;
  const isReel = post.content_type === "reels";
  const big = post.views_multiple >= 10;

  return (
    <li className="rounded-lg border border-edge bg-panel">
      <button
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
        onClick={props.onToggle}
        aria-expanded={open}
      >
        {/* Multiple — the headline number, de-emphasised when assisted */}
        <div className="w-16 shrink-0 text-right">
          {post.is_assisted ? (
            <span className="text-lg font-semibold text-dim/70">
              {multiple(post.views_multiple)}
            </span>
          ) : (
            <span
              className={`text-2xl font-bold tabular-nums ${big ? "text-hot" : "text-ink"}`}
            >
              {multiple(post.views_multiple)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{post.brand_name}</span>
            <span className="text-xs text-dim">
              {NETWORK_LABEL[post.network] ?? post.network} ·{" "}
              {post.content_type === "posts" ? "post" : post.content_type}
            </span>
            {post.is_assisted && post.assisted_from && (
              <span className="rounded bg-hot/15 px-1.5 py-px text-xs font-medium text-hot">
                assisted from {shortDate(post.assisted_from)}
              </span>
            )}
          </div>
          {post.caption && (
            <p className="truncate text-sm text-dim">{post.caption}</p>
          )}
          <p className="mt-0.5 text-xs text-dim">
            {age(post.age_days)} old · {compact(post.views)} views vs{" "}
            {compact(post.median_views)} median
            {isReel && (
              <span className="text-ink/80">
                {" "}
                ·{" "}
                {post.skip_rate !== null && (
                  <>skip {Math.round(post.skip_rate)}%</>
                )}
                {post.avg_watch_seconds !== null && (
                  <> · {post.avg_watch_seconds.toFixed(1)}s watch</>
                )}
              </span>
            )}
            {props.notes.length > 0 && (
              <span> · {props.notes.length} note{props.notes.length > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>

        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded p-1.5 text-dim hover:bg-edge hover:text-ink"
            title="Open post"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
