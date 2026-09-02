import { age, compact, multiple } from "../lib/format";
import type {
  FlaggedPost,
  Intervention,
  PostNote,
  StreamingCapture,
} from "../lib/types";
import PostDetail from "./PostDetail";
import { brandPath, navigate } from "../lib/router";
import { OpenPost, PlatformPill, Thumb } from "./BrandRow";
import { SkipMarker } from "./SkipRateExplainer";
import AssistMark from "./AssistMark";

/**
 * variant "score" (default): the multiple leads — Leading / Best Performing.
 * variant "feed": recency leads, the multiple sits quiet on the right.
 * variant "reach": raw views lead — Most Viewed; the multiple is meta.
 *
 * Rendered as a fragment so consecutive rows stay adjacent siblings and the
 * theme's `.post + .post` rule draws the divider.
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
  /** Leading and Latest only. Best and Most viewed still show the marker on an
   *  already-assisted post, but carry no control. */
  canMark?: boolean;
}) {
  const { post, open } = props;
  const feed = props.variant === "feed";
  const reach = props.variant === "reach";
  const isReel = post.content_type === "reels";
  const noteCount = props.notes.length;

  const headline = reach ? compact(post.views) : multiple(post.views_multiple);

  return (
    <>
      <div className={`post${post.is_assisted ? " assisted" : ""}`}>
        <Thumb url={post.thumbnail_url} />

        <div className="meta">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <a
              className="brand"
              href={brandPath(post.brand_name)}
              onClick={(e) => {
                e.preventDefault();
                navigate(brandPath(post.brand_name));
              }}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {post.brand_name}
            </a>
            <PlatformPill network={post.network} contentType={post.content_type} />
          </div>

          {post.caption && (
            <div
              className="when"
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {post.caption}
            </div>
          )}

          <div className="when">
            <span style={feed ? { color: "var(--ink)", fontWeight: 500 } : undefined}>
              {age(post.age_days)} old
            </span>
            {reach ? (
              <> · {multiple(post.views_multiple)} its baseline</>
            ) : (
              <>
                {" · "}
                <span className="num">{compact(post.views)}</span> views vs{" "}
                <span className="num">{compact(post.median_views)}</span> median
              </>
            )}
            {isReel &&
              (post.skip_rate !== null || post.avg_watch_seconds !== null) && (
                <>
                  {" · "}
                  {post.skip_rate !== null && (
                    <>
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                        skip {Math.round(post.skip_rate)}%
                      </span>
                      {props.medianSkip != null && (
                        <> vs {Math.round(props.medianSkip)}% median</>
                      )}
                      <SkipMarker skipRate={post.skip_rate} />
                    </>
                  )}
                  {post.skip_rate !== null &&
                    post.avg_watch_seconds !== null &&
                    " · "}
                  {post.avg_watch_seconds !== null &&
                    `${post.avg_watch_seconds.toFixed(1)}s watch`}
                </>
              )}
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <button className="lnk" onClick={props.onToggle} aria-expanded={open}>
              Notes{noteCount > 0 ? ` (${noteCount})` : ""}
            </button>
            <AssistMark
              externalId={post.external_id}
              publishedAt={post.published_at}
              interventions={props.interventions}
              assistedFrom={post.assisted_from}
              assistKinds={post.assist_kinds}
              reload={props.reload}
              showControl={props.canMark === true}
            />
          </div>
        </div>

        {feed ? (
          <div
            className="num"
            style={{
              flexShrink: 0,
              alignSelf: "center",
              fontWeight: 700,
              color: "var(--muted)",
            }}
          >
            {multiple(post.views_multiple)}
          </div>
        ) : (
          <div className="mult" style={{ flexShrink: 0, textAlign: "right" }}>
            {headline}
            {reach && <small>views</small>}
          </div>
        )}

        <OpenPost href={post.permalink} />
      </div>

      {open && (
        <div
          style={{
            borderTop: "2px solid var(--line)",
            paddingTop: 14,
            marginBottom: 14,
          }}
        >
          <PostDetail {...props} />
        </div>
      )}
    </>
  );
}
