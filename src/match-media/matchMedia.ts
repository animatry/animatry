import { context } from "@core";

type AnimatryCallback = (ctx: typeof context.current) => void | (() => void);

function matchMedia(query: string, callback: AnimatryCallback) {
  const mql = window.matchMedia(query);
  const ctx = context.create(null);
  let cleanup: void | (() => void);

  function handleMatch(e: MediaQueryListEvent | MediaQueryList) {
    if (e.matches) {
      context.setCurrent(ctx);
      cleanup = callback(ctx);
    } else {
      if (typeof cleanup === "function") {
        cleanup();
      }
      context.clear(ctx);
      if (context.current === ctx) {
        context.setCurrent(null);
      }
    }
  }

  handleMatch(mql);

  mql.addEventListener("change", handleMatch);

  return () => {
    mql.removeEventListener("change", handleMatch);
    if (typeof cleanup === "function") {
      cleanup();
    }
    context.clear(ctx);
    if (context.current === ctx) {
      context.setCurrent(null);
    }
  };
}

export { matchMedia };
