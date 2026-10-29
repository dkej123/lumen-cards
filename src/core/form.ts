import { t } from "./i18n";
import { subButtonsField } from "./sub-buttons";

// Visual editor = HA's own ha-form (getConfigForm), no internal HA elements of our own:
// they change every release (HA 2026.4–2026.7 renamed several). Labels go through t().

export type Schema = Record<string, unknown>;

/** Field labels: the Polish label is the key of the translation. Standard fields (entity, name, icon, actions) keep HA's own labels. */
const LABELS: Record<string, string> = {
  power_entity: "editor.power_entity",
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
  max_width: "editor.max_width",
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
  presence_entity: "editor.help.presence_entity",
  presence_badge: "editor.help.presence_badge",
  feedback: "editor.help.feedback",
  min_temp: "editor.help.temp_range",
  max_temp: "editor.help.temp_range",
  pm25: "editor.help.pm",
  styles: "editor.help.styles",
  max_width: "editor.help.max_width",
  sub_buttons: "editor.help.sub_buttons",
};

export const computeLabel = (s: { name?: string; title?: string }) => (s.name && LABELS[s.name] ? t(LABELS[s.name]) : s.title ? t(s.title) : undefined);
export const computeHelper = (s: { name?: string; helper?: string }) => {
  const key = s.helper ?? s.name;
  return key && HELPERS[key] ? t(HELPERS[key]) : undefined;
};

const select = (options: [string, string][]) => ({
  select: { mode: "dropdown", options: options.map(([value, label]) => ({ value, label: t(label) })) },
});

interface AppearanceOpts {
  /** Glow colour of lit lights. */
  glow?: boolean;
  /** Weather effects toggle. */
  effects?: boolean;
  /** `layout` field: "width" (auto by card width), "screen" (auto by screen width) or none. */
  layout?: "width" | "screen" | false;
}

/** "Appearance" section shared by every card. */
export const appearance = ({ glow = false, effects = true, layout = "screen" }: AppearanceOpts = {}): Schema => ({
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
      schema: [...(glow ? [{ name: "glow_color", selector: { ui_color: {} } }] : []), { name: "accent_color", selector: { ui_color: {} } }],
    },
    { name: "max_width", selector: { number: { min: 120, max: 2000, step: 10, mode: "box", unit_of_measurement: "px" } } },
    ...(effects ? [{ name: "weather_effects", default: true, selector: { boolean: {} } }] : []),
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
    { name: "styles", selector: { text: { multiline: true } } },
  ],
});

/** Floating-button fields (climate, scene chips). */
export const fabFields = (): Schema[] => [
  { name: "fab", default: false, selector: { boolean: {} } },
  { name: "fab_narrow_only", default: true, selector: { boolean: {} } },
];

export const actions = (withTap = true): Schema => ({
  name: "",
  type: "expandable",
  flatten: true,
  title: t("editor.actions"),
  icon: "mdi:gesture-tap",
  schema: [
    ...(withTap ? [{ name: "tap_action", selector: { ui_action: {} } }] : []),
    { name: "hold_action", selector: { ui_action: {} } },
    { name: "double_tap_action", selector: { ui_action: {} } },
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
