import { useState } from "react";

/** Shared by the internal brand page and the public share page. */
export default function EngagementExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="lnk" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        What does the engagement score mean?
      </button>
      {open && (
        <>
          <hr className="r" />
          <div className="note" style={{ maxWidth: "66ch", marginTop: 0 }}>
            <p style={{ marginTop: 0 }}>
              The engagement score weights actions by what they&rsquo;re worth. A
              like costs nothing. A comment takes effort. A save means someone
              intends to come back. A share puts that person&rsquo;s own audience
              behind the post. A follow is the strongest thing a single post can
              do.
            </p>
            <p>
              So they&rsquo;re weighted: <b>like 1, comment 3, save 5, share 5,
              follow 10</b>. The total is divided by views, giving a score per 100
              views — that way a small account with a devoted audience
              isn&rsquo;t beaten by a big account nobody responds to.
            </p>
            <p>
              It&rsquo;s a score, not a percentage. <b className="num">9.2</b>{" "}
              doesn&rsquo;t mean 9.2% of viewers engaged; it means the weighted
              actions came to 9.2 per 100 views. Compare it to the
              account&rsquo;s own median, shown alongside.
            </p>
            <p>
              Watch-through is separate: average watch time as a share of the
              video&rsquo;s length. Only video posts carry duration, so
              it&rsquo;s blank elsewhere.
            </p>
            <p style={{ marginBottom: 0 }}>
              Platforms report different things. TikTok gives views, likes,
              comments and shares. Instagram adds saves and follows, and reels
              also give watch time. That means engagement scores can&rsquo;t be
              compared between platforms — a TikTok post has fewer ways to
              score. Every comparison here is within the same platform and
              format for that account, so a reel is measured against that
              account&rsquo;s other reels, never against its TikToks.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
