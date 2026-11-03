import { t } from "./i18n";
import { subButtonsField } from "./sub-buttons";

// Visual editor = HA's own ha-form (getConfigForm), no internal HA elements of our own:
// they change every release (HA 2026.4–2026.7 renamed several). Labels go through t().

export type Schema = Record<string, unknown>;

/** Field labels by field name (translation keys); a field's own `title` wins (computeLabel). */
const LABELS: Record<string, string> = {
  entity: "editor.entity",
  name: "editor.name",
  icon: "editor.icon",
  tap_action: "editor.tap_action",
  hold_action: "editor.hold_action",
  double_tap_action: "editor.double_tap_action",
  cards: "editor.cards",
  value: "editor.value",
  value_entity: "editor.value_entity",
  power_entity: "editor.power_entity",
  speeds: "card.purifier.editor.speeds",
  show_humidifier: "card.purifier.editor.show_humidifier",
  humidifier_entity: "card.purifier.editor.humidifier_entity",
  humidity_targets: "card.purifier.editor.humidity_targets",
  target_humidity_service: "card.purifier.editor.target_humidity_service",
  humidifier_when: "card.purifier.editor.humidifier_when",
  show_filters: "card.purifier.editor.show_filters",
  filters: "card.purifier.editor.filters",
  controls: "card.purifier.editor.controls",
  confirm_timeout: "card.purifier.editor.confirm_timeout",
  pm25_entity: "card.purifier.editor.pm25_entity",
  temperature_entity: "card.purifier.editor.temperature_entity",
  humidity_entity: "card.purifier.editor.humidity_entity",
  target_humidity_entity: "card.purifier.editor.target_humidity_entity",
  water_level_entity: "card.purifier.editor.water_level_entity",
  water_empty_entity: "card.purifier.editor.water_empty_entity",
  index: "card.purifier.editor.index",
  power_entities: "editor.power_entities",
  layout: "editor.layout",
  color_scheme: "editor.color_scheme",
  glow_color: "editor.glow_color",
  accent_color: "editor.accent_color",
  weather_effects: "editor.weather_effects",
  weather_entity: "editor.weather_entity",
  sun_entity: "editor.sun_entity",
  show_controls: "editor.show_controls",
  title: "editor.title",
  show_date: "editor.show_date",
  heading_style: "editor.heading_style",
  badges: "editor.badges",
  min_temp: "editor.min_temp",
  max_temp: "editor.max_temp",
  hvac_modes: "editor.hvac_modes",
  fan_modes: "editor.fan_modes",
  power_action: "editor.power_action",
  fab: "editor.fab_on",
  fab_narrow_only: "editor.fab_narrow_only",
  pm25: "PM2.5",
  pm10: "PM10",
  aqi_entity: "editor.aqi_entity",
  footer: "editor.footer",
  stale_hours: "editor.stale_hours",
  chips: "card.chips.name",
  alignment: "editor.alignment",
  presence_entity: "editor.presence_entity",
  presence_badge: "editor.presence_badge",
  picture: "editor.picture",
  avatar_color: "editor.avatar_color",
  banner: "editor.banner",
  banner_text: "editor.banner_text",
  screen_ring: "editor.screen_ring",
  busy_entity: "editor.busy_entity",
  arm_modes: "editor.arm_modes",
  arming_time: "editor.arming_time",
  pending_time: "editor.pending_time",
  show_buttons: "editor.show_buttons",
  preset_modes: "editor.preset_modes",
  show_swing: "editor.show_swing",
  show_presets: "editor.show_presets",
  show_action: "editor.show_action",
  show_range: "editor.show_range",
  stale_after: "editor.stale_after",
  feedback: "card.button.feedback",
  status_entity: "editor.status_entity",
  success_state: "editor.success_state",
  message_entity: "editor.message_entity",
  success_text: "editor.success_text",
  secondary_info: "editor.secondary_info",
  last_used_entity: "editor.last_used_entity",
  hours: "editor.hours",
  color: "card.light.color",
  state: "editor.state",
  message: "editor.message",
  done_action: "editor.done_action",
  battery_entity: "editor.battery_entity",
  step: "editor.step",
  haptics: "editor.haptics",
  haptic_tick: "editor.haptic_tick",
  fab_side: "editor.fab_side",
  fab_icon: "editor.fab_icon",
  device_class: "editor.device_class",
  battery_low: "editor.battery_low",
  show_battery: "editor.show_battery",
  dialog: "editor.dialog",
  done: "editor.done",
  snooze_minutes: "editor.snooze_minutes",
  show_chip: "editor.show_chip",
  show_name: "editor.show_name",
  show_icon: "editor.show_icon",
  show_state: "editor.show_state",
  show_status: "editor.show_status",
  show_graph: "editor.show_graph",
  show_values: "editor.show_values",
  show_bar: "editor.show_bar",
  show_current_temp: "editor.show_current_temp",
  show_modes: "editor.show_modes",
  show_fan_modes: "editor.show_fan_modes",
  show_color_button: "editor.show_color_button",
  show_greeting_name: "editor.show_greeting_name",
  sub_buttons: "editor.sub_buttons",
  styles: "editor.styles",
  edit_note: "editor.edit_note",
  max_width: "editor.max_width",
  max_width_unit: "editor.max_width_unit",
  align: "editor.align",
  card_width: "editor.card_width",
  disarmed_color: "editor.disarmed_color",
  height: "editor.height",
  warnings_entity: "editor.warnings_entity",
  show_feels: "editor.show_feels",
  show_minmax: "editor.show_minmax",
  show_hours: "editor.show_hours",
  show_warnings: "editor.show_warnings",
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
  show_trigger: "editor.show_trigger",
  auto_close: "editor.auto_close",
  badge_entities: "editor.badge_entities",
};

const HELPERS: Record<string, string> = {
  layout_width: "editor.help.layout_width",
  layout_screen: "editor.help.layout_screen",
  color_scheme: "editor.help.color_scheme",
  heading_style: "editor.help.heading_style",
  glow_color: "editor.help.glow_color",
  accent_color: "editor.help.accent_color",
  weather_effects: "editor.help.weather_effects",
  hvac_modes: "editor.help.hvac_modes",
  fan_modes: "editor.help.fan_modes",
  power_action: "editor.help.power_action",
  arming_time: "editor.help.arming_time",
  pending_time: "editor.help.arming_time",
  stale_after: "editor.help.stale_after",
  fab: "editor.help.fab",
  fab_narrow_only: "editor.help.fab_narrow_only",
  power_entity: "editor.help.power_entity",
  power_entities: "editor.help.power_entities",
  presence_entity: "editor.help.presence_entity",
  presence_badge: "editor.help.presence_badge",
  feedback: "editor.help.feedback",
  min_temp: "editor.help.temp_range",
  max_temp: "editor.help.temp_range",
  pm25: "editor.help.pm",
  styles: "editor.help.styles",
  edit_note: "editor.help.edit_note",
  max_width: "editor.help.max_width",
  battery_entity: "editor.help.battery_entity",
  step: "editor.help.step",
  haptics: "editor.help.haptics",
  haptic_tick: "editor.help.haptic_tick",
  fab_side: "editor.help.fab_side",
  device_class: "editor.help.device_class",
  sub_buttons: "editor.help.sub_buttons",
  weather_hours: "editor.help.weather_hours",
  disarmed_color: "editor.help.disarmed_color",
  height: "editor.help.height",
  warnings_entity: "editor.help.warnings_entity",
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
  spacer_height: "editor.help.spacer_height",
  purifier_layout: "card.purifier.help.layout",
  purifier_preset_modes: "card.purifier.help.preset_modes",
  purifier_speeds: "card.purifier.help.speeds",
  purifier_humidity_targets: "card.purifier.help.humidity_targets",
  purifier_target_service: "card.purifier.help.target_service",
  purifier_when: "card.purifier.help.when",
  purifier_filters: "card.purifier.help.filters",
  purifier_controls: "card.purifier.help.controls",
  purifier_confirm_timeout: "card.purifier.help.confirm_timeout",
  purifier_index: "card.purifier.help.index",
  fab_sheet_cards: "editor.help.fab_sheet_cards",
};

/** A field's own `title` wins over the shared label of its name (e.g. `hours` of the weather card). */
export const computeLabel = (s: { name?: string; title?: string }) => (s.title ? t(s.title) : s.name && LABELS[s.name] ? t(LABELS[s.name]) : undefined);
export const computeHelper = (s: { name?: string; helper?: string }) => {
  const key = s.helper ?? s.name;
  return key && HELPERS[key] ? t(HELPERS[key]) : undefined;
};

export const select = (options: [string, string][]) => ({
  select: { mode: "dropdown", options: options.map(([value, label]) => ({ value, label: t(label) })) },
});

interface AppearanceOpts {
  /** Glow colour of lit lights. */
  glow?: boolean;
  /** Weather effects toggle. */
  effects?: boolean;
  /** `layout` field: "width" (auto by card width), "screen" (auto by screen width) or none. */
  layout?: "width" | "screen" | false;
  /** Accent colour field (off for cards with nothing in the accent colour). */
  accent?: boolean;
}

/** "Appearance" section shared by every card. */
export const appearance = ({ glow = false, effects = true, layout = "screen", accent = true }: AppearanceOpts = {}): Schema => ({
  name: "",
  type: "expandable",
  flatten: true,
  title: t("editor.appearance"),
  icon: "mdi:palette-outline",
  schema: [
    {
      name: "",
      type: "grid",
      flatten: true,
      schema: [
        ...(layout ? [{ name: "layout", helper: `layout_${layout}`, selector: select([["auto", "common.auto"], ["wide", "editor.layout.wide"], ["compact", "editor.layout.compact"]]) }] : []),
        { name: "color_scheme", selector: select([["auto", "common.auto"], ["light", "editor.scheme.light"], ["dark", "editor.scheme.dark"]]) },
      ],
    },
    {
      name: "",
      type: "grid",
      flatten: true,
      schema: [...(glow ? [{ name: "glow_color", selector: { ui_color: {} } }] : []), ...(accent ? [{ name: "accent_color", selector: { ui_color: {} } }] : [])],
    },
    maxWidthField(),
    ...(effects ? [{ name: "weather_effects", default: true, selector: { boolean: {} } }] : []),
  ],
});

/** Max. width with its unit (px / % of the grid place), side by side. */
export const maxWidthField = (unit = "px"): Schema => ({
  name: "",
  type: "grid",
  flatten: true,
  schema: [
    { name: "max_width", selector: { number: { min: 1, max: 2000, step: 1, mode: "box" } } },
    { name: "max_width_unit", default: unit, selector: select([["px", "editor.unit.px"], ["%", "editor.unit.percent"]]) },
  ],
});

/**
 * "Advanced" section (Bubble Card style extras): visibility switches of the card's parts,
 * sub-buttons where the card has room, and custom CSS.
 */
export const advanced = (shows: [string, boolean?][] = [], opts: { subButtons?: boolean; extra?: Schema[] } = {}): Schema => ({
  name: "",
  type: "expandable",
  flatten: true,
  title: t("editor.advanced"),
  icon: "mdi:tune-variant",
  schema: [
    ...(shows.length ? [{ name: "", type: "grid", flatten: true, schema: shows.map(([name, def = true]) => ({ name, default: def, selector: { boolean: {} } })) }] : []),
    ...(opts.extra ?? []),
    ...(opts.subButtons ? [subButtonsField()] : []),
    hapticsField,
    { name: "edit_note", selector: { text: {} } },
    { name: "styles", selector: { text: { multiline: true } } },
  ],
});

/** Vibration feedback (taps, holds, drag ticks); on by default. */
export const hapticsField: Schema = {
  name: "",
  type: "grid",
  flatten: true,
  schema: [
    { name: "haptics", default: true, selector: { boolean: {} } },
    { name: "haptic_tick", selector: select(["selection", "light", "medium", "heavy", "success", "warning", "failure"].map((k): [string, string] => [k, `editor.haptic_tick.${k}`])) },
  ],
};

/** Side of the floating button (left for left-handed use). */
export const fabSideField: Schema = { name: "fab_side", default: "right", selector: select([["right", "editor.fab_side.right"], ["left", "editor.fab_side.left"]]) };

/** Floating-button fields (climate, scene chips). */
export const fabFields = (): Schema[] => [
  { name: "fab", default: false, selector: { boolean: {} } },
  { name: "fab_narrow_only", default: true, selector: { boolean: {} } },
  fabSideField,
];

export const actions = (withTap = true, withDouble = true): Schema => ({
  name: "",
  type: "expandable",
  flatten: true,
  title: t("editor.actions"),
  icon: "mdi:gesture-tap",
  schema: [
    ...(withTap ? [{ name: "tap_action", selector: { ui_action: {} } }] : []),
    { name: "hold_action", selector: { ui_action: {} } },
    // slider tiles: a horizontal drag is not a double tap
    ...(withDouble ? [{ name: "double_tap_action", selector: { ui_action: {} } }] : []),
  ],
});

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

/**
 * Editor form. `assertConfig` throws only for configs the form cannot show (HA then falls back to
 * the YAML editor) – never for a field that is just empty while the user edits.
 */
export function form(schema: Schema[], assertConfig?: (c: Record<string, unknown>) => void) {
  return { schema, computeLabel, computeHelper, assertConfig };
}

/**
 * getStubConfig: the first entity of `domain` that is not on the dashboard yet (`entities`), then
 * any (`fallback`), as HA passes them to getStubConfig(hass, entities, entitiesFallback).
 */
export const stub = (hass: { states: Record<string, unknown> } | undefined, domain: string | string[], entities?: string[], fallback?: string[]): string | undefined => {
  const domains = Array.isArray(domain) ? domain : [domain];
  const ok = (id: string) => domains.some((d) => id.startsWith(`${d}.`)) && !!hass?.states[id];
  return entities?.find(ok) ?? fallback?.find(ok);
};

/** First entity of a domain for getStubConfig. */
export const firstOf = (hass: { states: Record<string, unknown> } | undefined, domain: string, fallback = ""): string =>
  Object.keys(hass?.states ?? {}).find((id) => id.startsWith(`${domain}.`)) ?? fallback;

/**
 * getStubConfig of a card with one `entity`: an entity of `domains` not on the dashboard yet,
 * else the first of `firstDomains` (default the first domain), else `fallbackId`.
 */
export const entityStub =
  (domains: string | string[], fallbackId: string, firstDomains: string[] = [Array.isArray(domains) ? domains[0] : domains]) =>
  (hass?: { states: Record<string, unknown> }, entities?: string[], fallback?: string[]) => ({
    entity: stub(hass, domains, entities, fallback) ?? firstDomains.reduceRight((acc, d) => firstOf(hass, d, acc), fallbackId),
  });
