import { useCallback, useState, type ReactNode } from "react";

export function useCollapse(id: string, defaultOpen: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    const v = localStorage.getItem(`mx-open:${id}`);
    return v === null ? defaultOpen : v === "1";
  });
  const toggle = useCallback(() => {
    setOpen((o) => {
      localStorage.setItem(`mx-open:${id}`, o ? "0" : "1");
      return !o;
    });
  }, [id]);
  return [open, toggle] as const;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/**
 * Collapsible section, rendered as a native <details> so keyboard and
 * screen-reader behaviour comes for free. Open state is still persisted per
 * section id, which is why `open` is controlled rather than left to the
 * element.
 */
export function Section(props: {
  id: string;
  title: string;
  count: number;
  timescale?: string;
  defaultOpen?: boolean;
  subtitle?: string;
  children: ReactNode;
}) {
  const [open, toggle] = useCollapse(props.id, props.defaultOpen ?? false);
  return (
    <details
      className="sect"
      open={open}
      onToggle={(e) => {
        // Only react to a real user toggle, not React re-syncing the attribute.
        if ((e.currentTarget as HTMLDetailsElement).open !== open) toggle();
      }}
    >
      <summary>
        <span>{props.title}</span>
        {props.timescale && (
          <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            {props.timescale}
          </span>
        )}
        <span className="count num">{props.count}</span>
      </summary>
      <div className="body">
        {props.subtitle && <p className="note" style={{ marginTop: 0 }}>{props.subtitle}</p>}
        {props.children}
      </div>
    </details>
  );
}
