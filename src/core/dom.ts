// Walking up from a card to HA's elements around it (across shadow roots).

/** Ancestors of `node`, nearest first; a shadow root continues with its host. */
export function* composedAncestors(node: Node, max = 80): Generator<Element> {
  let n: Node | null = node;
  for (let i = 0; i < max && n; i++) {
    const parent: Node | null = n.parentNode;
    n = parent instanceof ShadowRoot ? parent.host : parent;
    if (n instanceof Element) yield n;
  }
}

/** The nearest ancestor that matches `test`. */
export function findAncestor(node: Node, test: (el: Element) => boolean, max?: number): Element | undefined {
  for (const el of composedAncestors(node, max)) if (test(el)) return el;
  return undefined;
}

/** A Lovelace view element (hui-sections-view, hui-masonry-view, hui-panel-view, hui-view…). */
export const isHaView = (el: Element): boolean => el.localName === "hui-view" || el.localName === "hui-view-container" || /^hui-.*-view$/.test(el.localName);

/** The view the card is in. */
export const viewOf = (el: Element): Element | undefined => findAncestor(el, isHaView);

/** HA's hui-card / hui-section wrapper with its config (visibility conditions). */
export type HuiWrapper = HTMLElement & { config?: { visibility?: unknown } };
