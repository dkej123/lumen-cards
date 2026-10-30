import { t } from "./i18n";

/**
 * The card's `entity` (or `key`) must be an entity id – of one of `domains` when given; else the
 * card shows `msg` (default "pick an entity").
 */
export function requireEntity(c: object, o: { key?: string; domains?: string[]; msg?: string } = {}): void {
  const v = (c as Record<string, unknown>)[o.key ?? "entity"];
  const ok = typeof v === "string" && v !== "" && (!o.domains || o.domains.some((d) => v.startsWith(`${d}.`)));
  if (!ok) throw new Error(t(o.msg ?? "error.pick_entity"));
}
