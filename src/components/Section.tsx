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
  return <p className="pt-5 text-sm text-dim">{children}</p>;
}

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
    <section>
      <button
        className="group flex w-full items-baseline justify-between border-b border-line pb-2 text-left"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-dim group-hover:text-ink">
          {props.title}
          {props.timescale && (
            <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-dim/70">
              ({props.timescale})
            </span>
          )}
          <span className="ml-2 font-normal text-dim/70">{props.count}</span>
        </span>
        <span className="font-serif text-sm leading-none text-dim/70 group-hover:text-ink">
          {open ? "–" : "+"}
        </span>
      </button>
      {open && props.subtitle && (
        <p className="max-w-prose pt-3 text-[13px] leading-relaxed text-dim">
          {props.subtitle}
        </p>
      )}
      {open && props.children}
    </section>
  );
}
