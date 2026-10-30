import { computeHelper, computeLabel, type Schema } from "./form";
import { t } from "./i18n";

// Labels and helpers of the fields the newer cards (cover, media, select, fan, number, calendar,
// nav, pop-up) add; everything else falls through to the shared tables in form.ts.

const LABELS: Record<string, string> = {
  show_buttons: "editor.show_buttons",
  show_tilt: "editor.show_tilt",
  show_volume: "editor.show_volume",
  show_progress: "editor.show_progress",
  show_source: "editor.show_source",
  show_title: "editor.show_title",
  icon_animation: "editor.icon_animation",
  secondary_entity: "editor.secondary_entity",
  days: "editor.days",
  max_events: "editor.max_events",
  items: "editor.nav_items",
  position: "editor.nav_position",
  narrow_only: "editor.narrow_only",
  hash: "editor.hash",
  cards: "editor.cards",
  show_trigger: "editor.show_trigger",
  auto_close: "editor.auto_close",
  badge_entities: "editor.badge_entities",
};

const HELPERS: Record<string, string> = {
  secondary_entity: "editor.help.secondary_entity",
  days: "editor.help.days",
  items: "editor.help.nav_items",
  position: "editor.help.nav_position",
  hash: "editor.help.hash",
  cards: "editor.help.cards",
  show_trigger: "editor.help.show_trigger",
  auto_close: "editor.help.auto_close",
  badge_entities: "editor.help.badge_entities",
  narrow_only_fab: "editor.help.narrow_only_fab",
  fab_sheet_cards: "editor.help.fab_sheet_cards",
};

const label = (s: { name?: string; title?: string }) => (s.name && LABELS[s.name] ? t(LABELS[s.name]) : computeLabel(s));
const helper = (s: { name?: string; helper?: string }) => {
  const key = s.helper ?? s.name;
  return key && HELPERS[key] ? t(HELPERS[key]) : computeHelper(s);
};

/** Editor form (like `form()` in form.ts) that also knows the labels above. */
export function formX(schema: Schema[], assertConfig?: (c: Record<string, unknown>) => void) {
  return { schema, computeLabel: label, computeHelper: helper, assertConfig };
}

/** `name` + `icon` side by side. */
export const nameIcon = (): Schema => ({
  name: "",
  type: "grid",
  flatten: true,
  schema: [
    { name: "name", selector: { text: {} } },
    { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } },
  ],
});

/** "Actions" section with tap and hold only (slider tiles: a horizontal drag is not a double tap). */
export const tapHold = (withTap = true): Schema => ({
  name: "",
  type: "expandable",
  flatten: true,
  title: t("editor.actions"),
  icon: "mdi:gesture-tap",
  schema: [...(withTap ? [{ name: "tap_action", selector: { ui_action: {} } }] : []), { name: "hold_action", selector: { ui_action: {} } }],
});
