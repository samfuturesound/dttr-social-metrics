import { useState } from "react";

/** Shared by the internal brand page and the public share page. */
export default function EngagementExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="text-[13px] text-dim underline underline-offset-2 hover:text-ink"
        onClick={() => setOpen((o) => !o)}
      >
        What does the engagement score mean?
      </button>
      {open && (
        <div className="mt-3 max-w-prose space-y-2 text-sm leading-relaxed text-dim">
          <p>
            The engagement score weights actions by what they're worth. A like
            costs nothing. A comment takes effort. A save means someone intends
            to come back. A share puts that person's own audience behind the
            post. A follow is the strongest thing a single post can do.
          </p>
          <p>
            So they're weighted: like 1, comment 3, save 5, share 5, follow 10.
            The total is divided by views, giving a score per 100 views — that
            way a small account with a devoted audience isn't beaten by a big
            account nobody responds to.
          </p>
          <p>
            It's a score, not a percentage.{" "}
            <span className="font-serif text-ink">9.2</span> doesn't mean 9.2%
            of viewers engaged; it means the weighted actions came to 9.2 per
            100 views. Compare it to the account's own median, shown alongside.
          </p>
          <p>
            Watch-through is separate: average watch time as a share of the
            video's length. Only video posts carry duration, so it's blank
            elsewhere.
          </p>
          <p>
            Platforms report different things. TikTok gives views, likes,
            comments and shares. Instagram adds saves and follows, and reels
            also give watch time. That means engagement scores can't be
            compared between platforms — a TikTok post has fewer ways to score.
            Every comparison here is within the same platform and format for
            that account, so a reel is measured against that account's other
            reels, never against its TikToks.
          </p>
        </div>
      )}
    </div>
  );
}
