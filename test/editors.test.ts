// @vitest-environment happy-dom
// The visual editors: what each form offers, and which fields it shows in which mode.
import { afterEach, describe, expect, it, vi } from "vitest";
import { form, hide, type Schema } from "../src/core/form";
import { formDefaults, LumenFormEditor } from "../src/core/form-editor";
import { t } from "../src/core/i18n";
import "../src/lumen-cards";
import { lastUsedMs } from "../src/cards/button";
import { purifierFormConfig } from "../src/cards/purifier";
import { ent, mockHass, mount, settle } from "./helpers";

type Field = Schema & { name?: string; schema?: Field[] };
type Form = { schema: Field[]; schemaFor(c: Record<string, unknown>): Field[] };
const formOf = (name: string) => (customElements.get(`lumen-${name}-card`) as unknown as { getConfigForm(): Form }).getConfigForm();
const names = (list: Field[]): string[] => list.flatMap((f) => (f.schema && (f.flatten || !f.name) ? names(f.schema) : f.name ? [f.name] : []));
/** The field names the editor shows for `config`. */
const shown = (name: string, config: Record<string, unknown>) => names(formOf(name).schemaFor(config));

/** [card, config that hides them, hidden fields, config that shows them]. */
const MODES: [string, Record<string, unknown>, string[], Record<string, unknown>][] = [
  ["alarm", { layout: "wide" }, ["banner", "banner_text"], {}],
  ["alarm", { banner: false }, ["banner_text"], {}],
  ["alarm", { layout: "compact" }, ["show_state", "show_buttons"], {}],
  ["button", { secondary_info: "state" }, ["last_used_entity"], {}],
  ["calendar", { show_title: false }, ["name", "icon", "tap_action", "hold_action"], {}],
  ["chips", {}, ["fab_narrow_only", "fab_side", "fab_icon", "title"], { fab: true }],
  ["climate", {}, ["fab_narrow_only", "fab_side"], { fab: true }],
  ["climate", { layout: "compact" }, ["hvac_modes", "fan_modes", "preset_modes", "show_modes", "show_fan_modes", "show_presets", "show_swing", "show_action", "show_range"], {}],
  ["climate", { fab: true, fab_narrow_only: false }, ["preset_modes", "show_presets", "show_swing", "show_action", "show_range", "show_battery", "battery_entity", "battery_low"], { fab: true }],
  ["entity", { entity: "sensor.a" }, ["device_class"], { entity: "binary_sensor.a" }],
  ["media", { volume_only: true }, ["tap_action", "show_progress", "show_volume", "show_source"], {}],
  ["media", {}, ["show_playback", "volume_remote", "volume_step"], { volume_only: true }],
  ["nav", { position: "inline" }, ["narrow_only"], {}],
  ["reminder", { dialog: false }, ["title", "message", "done", "done_action"], { done: true }],
  ["reminder", {}, ["done_action"], { done: true }],
  ["weather-background", {}, ["layout", "accent_color", "max_width", "max_width_unit"], { show_controls: true }],
];

describe("fields that do not apply are hidden", () => {
  it.each(MODES)("%s %j hides them", (card, off, fields, on) => {
    const hidden = shown(card, off);
    const visible = shown(card, on);
    for (const f of fields) {
      expect(hidden, f).not.toContain(f);
      expect(visible, f).toContain(f);
    }
  });

  it.each(MODES)("%s %j keeps a field that holds a value, so it can be cleared", (card, off, fields) => {
    for (const f of fields) expect(shown(card, { ...off, [f]: "x" }), f).toContain(f);
  });

  it.each(MODES)("%s: docs and catalog still read every field", (card, _off, fields) => {
    expect(names(formOf(card).schema)).toEqual(expect.arrayContaining(fields));
  });

  it("the keep-a-value rule looks inside rows and groups, and drops what is left empty", () => {
    const row = { name: "", type: "grid", flatten: true, schema: [{ name: "a" }] };
    const group = { name: "", type: "expandable", flatten: true, schema: [row] };
    expect(hide({}, [group], [[true, ["a"]]])).toEqual([]);
    expect(hide({ a: 1 }, [group], [[true, ["a"]]])).toEqual([group]);
    expect(hide(undefined, [group], [[true, ["a"]]])).toEqual([group]);
    expect(hide({}, [group], [[false, ["a"]]])).toEqual([group]);
  });
});

describe("form editor", () => {
  const editor = (mode: Schema) => {
    const el = document.createElement("lumen-form-editor") as LumenFormEditor;
    el.form = form((c) => hide(c, [{ name: "mode", selector: { boolean: {} } }, mode], [[!c?.mode, ["extra"]]]));
    return el;
  };

  it("shows the fields of the current config and follows a change", async () => {
    const el = editor({ name: "extra", default: 3, selector: { number: {} } });
    el.setConfig({ type: "x" });
    document.body.append(el);
    await el.updateComplete;
    const haForm = () => el.shadowRoot!.querySelector("ha-form") as HTMLElement & { schema: Field[]; data: Record<string, unknown> };
    expect(names(haForm().schema)).toEqual(["mode"]);
    const first = haForm().schema;
    el.setConfig({ type: "x", other: 1 });
    await el.updateComplete;
    expect(haForm().schema).toBe(first); // same fields: ha-form keeps its array
    let out: Record<string, unknown> = {};
    el.addEventListener("config-changed", (e) => (out = (e as CustomEvent).detail.config));
    haForm().dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...haForm().data, mode: true } } }));
    await el.updateComplete;
    expect(names(haForm().schema)).toEqual(["mode", "extra"]);
    // a hidden field's default stays out of the YAML
    expect(out).toEqual({ type: "x", other: 1, mode: true });
    el.remove();
  });
});

describe("open groups when the rows above them come and go", () => {
  const group = { name: "", type: "expandable", flatten: true, title: "Look", schema: [{ name: "x", selector: { text: {} } }] };
  const setup = async () => {
    const el = document.createElement("lumen-form-editor") as LumenFormEditor;
    el.form = form((c) => hide(c, [{ name: "mode", selector: { boolean: {} } }, { name: "extra", selector: { text: {} } }, group], [[!!c?.mode, ["extra"]]]));
    el.setConfig({ type: "x" });
    document.body.append(el);
    await el.updateComplete;
    return el;
  };
  type FakeForm = HTMLElement & { schema: Field[]; data: Record<string, unknown> };
  const haForm = (el: LumenFormEditor) => el.shadowRoot!.querySelector("ha-form") as FakeForm;
  /** What HA's ha-form renders for the group: a row with a panel the user can open. */
  const fakeGroup = (f: FakeForm, expanded: boolean) => {
    const row = document.createElement("ha-form-expandable") as HTMLElement & { schema?: Schema };
    row.schema = f.schema.find((x) => x.type === "expandable");
    const panel = document.createElement("ha-expansion-panel") as HTMLElement & { expanded?: boolean };
    panel.expanded = expanded;
    row.attachShadow({ mode: "open" }).append(panel);
    f.attachShadow({ mode: "open" }).append(row);
  };
  const change = async (el: LumenFormEditor, patch: Record<string, unknown>) => {
    haForm(el).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...haForm(el).data, ...patch } } }));
    await el.updateComplete;
  };

  it("a group stays open and ha-form is built anew when a row above it goes", async () => {
    const el = await setup();
    const before = haForm(el);
    fakeGroup(before, true);
    await change(el, { mode: true });
    expect(haForm(el)).not.toBe(before);
    expect(haForm(el).schema.find((f) => f.type === "expandable")!.expanded).toBe(true);
    el.remove();
  });

  it("a change inside a form of the same shape keeps ha-form", async () => {
    const el = await setup();
    const before = haForm(el);
    fakeGroup(before, true);
    await change(el, { x: "typed" });
    expect(haForm(el)).toBe(before);
    el.remove();
  });
});

describe("volume tile", () => {
  afterEach(() => vi.useRealTimers());
  const press = async (el: HTMLElement, sel: string, ms: number) => {
    const tile = el.shadowRoot!.querySelector(sel) as HTMLElement;
    const opts = { button: 0, clientX: 10, clientY: 10, pointerId: 1, bubbles: true, composed: true };
    tile.dispatchEvent(new PointerEvent("pointerdown", opts));
    await vi.advanceTimersByTimeAsync(ms);
    tile.dispatchEvent(new PointerEvent("pointerup", opts));
  };
  const player = () => mockHass([ent("media_player.tv", "playing", { volume_level: 0.5, supported_features: 4 })]);

  it("a hold runs hold_action, as on the fan tile", async () => {
    const actions: unknown[] = [];
    const el = await mount("media", { entity: "media_player.tv", volume_only: true, hold_action: { action: "toggle" } }, player());
    el.addEventListener("hass-action", (e) => actions.push((e as CustomEvent).detail.action));
    await settle(el);
    vi.useFakeTimers();
    await press(el, ".ltile", 600);
    expect(actions).toEqual(["hold"]);
    el.remove();
  });

  it("the thin volume bar of the full card does not hold", async () => {
    const actions: unknown[] = [];
    const el = await mount("media", { entity: "media_player.tv", hold_action: { action: "toggle" } }, player());
    el.addEventListener("hass-action", (e) => actions.push((e as CustomEvent).detail.action));
    await settle(el);
    vi.useFakeTimers();
    await press(el, '[role="slider"]', 600);
    expect(actions).toEqual([]);
    el.remove();
  });
});

describe("purifier editor", () => {
  type ObjectField = { selector: { object?: { fields?: Record<string, { selector: Record<string, unknown> }> } } };
  const fieldOf = (list: Field[], name: string): Field & ObjectField => {
    for (const f of list) {
      if (f.name === name) return f as Field & ObjectField;
      if (f.schema) {
        try {
          return fieldOf(f.schema, name);
        } catch {
          /* next group */
        }
      }
    }
    throw new Error(name);
  };
  const raw = (list: Field[]) => JSON.stringify(list).match(/"selector":\{"object":\{\}\}/g) ?? [];

  it("has no raw YAML box left", () => {
    expect(raw(formOf("purifier").schema)).toEqual([]);
  });

  it("an entity control offers no service fields; a list with an old service control still does", () => {
    const fields = (c: Record<string, unknown>) => Object.keys(fieldOf(formOf("purifier").schemaFor(c), "controls").selector.object!.fields!);
    expect(fields({ entity: "fan.a" })).not.toContain("service");
    expect(fields({ entity: "fan.a", controls: [{ service: "a.b", attribute: "x", field: "y" }] })).toContain("service");
    expect(Object.keys(fieldOf(formOf("purifier").schema, "controls").selector.object!.fields!)).toContain("service");
    expect(Object.keys(fieldOf(formOf("purifier").schemaFor({ entity: "fan.a" }), "service_controls").selector.object!.fields!)).toEqual(expect.arrayContaining(["attribute", "service", "field", "kind", "options"]));
  });

  it("spells out YAML's short forms for the fields", () => {
    expect(purifierFormConfig({ controls: [{ options: ["a", 1, { value: "b" }] }], index: { thresholds: [50, 100] } })).toEqual({ controls: [{ options: [{ value: "a" }, { value: "1" }, { value: "b" }] }], index: { thresholds: ["50", "100"] } });
  });

  const FAN = () => ent("fan.a", "on", { supported_features: 0, pm25: 12, iaq: 120, level: 1 });

  it("thresholds typed in the editor count as numbers", async () => {
    const el = await mount("purifier", { entity: "fan.a", index: { name: "IAQ", attribute: "iaq", thresholds: ["100", "50"].reverse(), labels: ["Low", "Mid", "High"] } }, mockHass([FAN()]));
    await settle(el);
    expect(el.shadowRoot!.textContent).toContain("High");
    el.remove();
  });

  it("a value typed for a service control goes out and is matched as a number", async () => {
    const h = mockHass([FAN()]);
    const el = await mount("purifier", { entity: "fan.a", send_delay: 0, service_controls: [{ name: "Level", attribute: "level", service: "x.set_level", field: "value", options: [{ value: "1" }, { value: "2" }] }] }, h);
    await settle(el);
    const c = el as unknown as { controls(): { change(v: unknown): { expected: Record<string, unknown>; send(): Promise<unknown> } }[] };
    expect(c.controls()).toHaveLength(1);
    const change = c.controls()[0].change("2");
    expect(change.expected).toEqual({ "fan.a|level": 2 });
    await change.send();
    expect(h.calls.at(-1)).toEqual(["x", "set_level", { value: 2 }, { entity_id: "fan.a" }]);
    el.remove();
  });

  it("controls and service controls both show, in that order", async () => {
    const el = await mount("purifier", { entity: "fan.a", controls: [{ name: "One", entity: "switch.one" }], service_controls: [{ name: "Two", attribute: "level", service: "x.y", field: "v" }] }, mockHass([FAN(), ent("switch.one", "on")]));
    await settle(el);
    expect((el as unknown as { controls(): { name: string }[] }).controls().map((x) => x.name)).toEqual(["One", "Two"]);
    el.remove();
  });

  it("the card's icon wins over the fan's; the groups match its siblings", async () => {
    const el = await mount("purifier", { entity: "fan.a", icon: "mdi:fan-alert" }, mockHass([ent("fan.a", "on", { icon: "mdi:air-purifier" })]));
    await settle(el);
    expect((el as unknown as { iconName: string }).iconName).toBe("mdi:fan-alert");
    expect(names(formOf("purifier").schema)).toEqual(expect.arrayContaining(["icon", "styles", "edit_note", "haptics"]));
    el.remove();
  });

  it("draws weather effects like the other cards", async () => {
    for (const layout of ["wide", "compact"]) {
      const el = await mount("purifier", { entity: "fan.a", layout }, mockHass([FAN()]));
      await settle(el);
      expect(el.shadowRoot!.querySelector("canvas.wfx"), layout).not.toBeNull();
      el.remove();
    }
  });

  it("a number or input_number can be the target humidity", () => {
    expect(JSON.stringify(fieldOf(formOf("purifier").schema, "target_humidity_entity"))).toContain('"number"');
  });
});

describe("options that were YAML only", () => {
  it.each([["light", "height"], ["weather", "sun_entity"], ["chips", "glow_color"]])("%s has %s", (card, field) => {
    expect(names(formOf(card).schema)).toContain(field);
  });

  it("a chip's dialog offers hold and double tap", () => {
    const chips = formOf("chips").schema.find((f) => f.name === "chips") as Field & { selector: { object: { fields: Record<string, unknown> } } };
    expect(Object.keys(chips.selector.object.fields)).toEqual(expect.arrayContaining(["tap_action", "hold_action", "double_tap_action"]));
  });

  it("the light's height has its own help, not the sensor's", () => {
    const form = formOf("light") as unknown as { computeHelper(s: Field): string };
    const help = form.computeHelper(formOf("light").schema.find((f) => f.name === "height")!);
    expect(help).toContain("40");
    expect(help).not.toContain("chart");
  });
});

describe("behaviour behind the fields", () => {
  const text = (el: HTMLElement) => el.shadowRoot!.textContent ?? "";

  it("the presence badge has a real switch", async () => {
    const h = mockHass([ent("person.a", "home"), ent("binary_sensor.b", "on")]);
    const on = await mount("person", { entity: "person.a", presence_entity: "binary_sensor.b", layout: "wide" }, h);
    await settle(on);
    expect(text(on)).toContain("BLE");
    on.remove();
    const off = await mount("person", { entity: "person.a", presence_entity: "binary_sensor.b", layout: "wide", show_presence_badge: false }, h);
    await settle(off);
    expect(text(off)).not.toContain("BLE");
    off.remove();
    expect(shown("person", {})).not.toContain("show_presence_badge");
    expect(shown("person", { presence_entity: "binary_sensor.b" })).toEqual(expect.arrayContaining(["show_presence_badge", "presence_badge"]));
    expect(shown("person", { presence_entity: "binary_sensor.b", show_presence_badge: false })).not.toContain("presence_badge");
  });

  it("the sensor type offers every type the card knows", async () => {
    const field = names(formOf("entity").schema).includes("device_class") ? JSON.stringify(formOf("entity").schema) : "";
    for (const k of ["door", "presence", "gas", "problem", "battery", "plug", "power"]) expect(field).toContain(`"value":"${k}"`);
    const h = mockHass([ent("binary_sensor.g", "on")]);
    const el = await mount("entity", { entity: "binary_sensor.g", device_class: "plug", layout: "wide" }, h);
    await settle(el);
    expect(el.shadowRoot!.innerHTML).toContain("mdi:power-plug");
    el.remove();
  });

  it("a reminder with only a value entity shows its value", async () => {
    const h = mockHass([ent("input_boolean.r", "on"), ent("sensor.v", "42")]);
    const el = await mount("reminder", { entity: "input_boolean.r", value_entity: "sensor.v", dialog: false }, h);
    await settle(el);
    expect(text(el)).toContain("42");
    el.remove();
    const own = await mount("reminder", { entity: "input_boolean.r", value_entity: "sensor.v", value: "{value} km", dialog: false }, h);
    await settle(own);
    expect(text(own)).toContain("42 km");
    own.remove();
  });

  it("the last use comes from a timestamp attribute or an ISO state, nothing else", () => {
    expect(lastUsedMs(ent("input_datetime.a", "2026-01-01", { timestamp: 1000 }))).toBe(1_000_000);
    expect(lastUsedMs(ent("sensor.a", "2026-11-04T08:00:00+00:00"))).toBe(Date.parse("2026-11-04T08:00:00Z"));
    expect(lastUsedMs(ent("sensor.a", "5"))).toBeUndefined();
    expect(lastUsedMs(ent("sensor.a", "unknown"))).toBeUndefined();
    expect(lastUsedMs(undefined)).toBeUndefined();
  });

  it("a timestamp sensor fills the button's second line", async () => {
    const h = mockHass([ent("script.go", "off"), ent("sensor.last", new Date(Date.now() - 3_600_000).toISOString())]);
    const el = await mount("button", { entity: "script.go", last_used_entity: "sensor.last" }, h);
    await settle(el);
    const plain = await mount("button", { entity: "script.go" }, h);
    await settle(plain);
    expect(text(el)).not.toEqual(text(plain));
    el.remove();
    plain.remove();
  });

  it("plain string badges keep the visual editor", async () => {
    const ctor = customElements.get("lumen-title-card") as unknown as { getConfigElement(): LumenFormEditor };
    const ed = ctor.getConfigElement();
    const cfg = { type: "custom:lumen-title-card", badges: ["sensor.a", { entity: "sensor.b" }] };
    expect(() => ed.setConfig(cfg)).not.toThrow();
    document.body.append(ed);
    await ed.updateComplete;
    expect((ed.shadowRoot!.querySelector("ha-form") as HTMLElement & { data: { badges: unknown } }).data.badges).toEqual([{ entity: "sensor.a" }, { entity: "sensor.b" }]);
    ed.remove();
  });

  it("a badges value that is not a list still goes to YAML", () => {
    const ed = (customElements.get("lumen-title-card") as unknown as { getConfigElement(): LumenFormEditor }).getConfigElement();
    expect(() => ed.setConfig({ badges: "x" })).toThrow();
  });
});

describe("schema defaults match what the card does", () => {
  /** [card, field, what the code falls back to]. */
  const DEFAULTS: [string, string, unknown][] = [
    ["light", "layout", "auto"],
    ["light", "color_scheme", "auto"],
    ["fan", "haptic_tick", "selection"],
    ["button", "secondary_info", "auto"],
    ["chips", "alignment", "start"],
    ["reminder", "alignment", "start"],
    ["reminder", "color", "info"],
    ["nav", "position", "bottom"],
    ["title", "heading_style", "overline"],
    ["media", "volume_step", 4],
    ["climate", "battery_low", 15],
    ["popup", "auto_close", 0],
    ["purifier", "layout", "wide"],
  ];
  it.each(DEFAULTS)("%s.%s defaults to %s", (card, field, value) => {
    expect(formDefaults(formOf(card).schema)[field]).toEqual(value);
  });

  it("a new chip starts as an action chip", () => {
    const chips = formOf("chips").schema.find((f) => f.name === "chips") as Field & { selector: { object: { fields: { type: { default?: string } } } } };
    expect(chips.selector.object.fields.type.default).toBe("action");
  });
});

describe("help texts", () => {
  const help = (card: string, name: string) => {
    const form = formOf(card) as unknown as Form & { computeHelper(s: Field): string | undefined };
    const find = (list: Field[]): Field | undefined => list.flatMap((f) => (f.name === name ? [f] : f.schema ? [find(f.schema)].filter(Boolean) as Field[] : []))[0];
    return form.computeHelper(find(form.schema)!);
  };

  it("the sensor card does not promise a compact look when narrow", () => {
    expect(help("sensor", "layout")).toBe(t("editor.help.layout_manual"));
    expect(help("light", "layout")).toBe(t("editor.help.layout_width"));
  });

  it("empty lists say they mean all", () => {
    expect(help("alarm", "arm_modes")).toBeTruthy();
    expect(help("climate", "preset_modes")).toBeTruthy();
  });

  it("the floating button no longer names one corner", () => {
    expect(help("climate", "fab")).not.toMatch(/right/);
  });
});

describe("advanced fields only where they do something", () => {
  const ALL = ((window as unknown as { customCards: { type: string }[] }).customCards).map((c) => c.type.replace(/^lumen-|-card$/g, ""));
  const fields = (card: string) => names(formOf(card).schema);

  it("drag ticks only on cards with a slider", () => {
    expect(ALL.filter((c) => fields(c).includes("haptic_tick")).sort()).toEqual(["chips", "cover", "fan", "light", "media", "number"]);
  });

  it("vibration not on cards that never vibrate", () => {
    const none = ALL.filter((c) => !fields(c).includes("haptics")).sort();
    expect(none).toEqual(["bar", "greeting", "horizontal-stack", "spacer", "title", "vertical-stack", "weather-background"]);
  });

  it("every card but the spacer has a note for edit mode and custom CSS", () => {
    for (const card of ALL.filter((c) => c !== "spacer")) expect(fields(card), card).toEqual(expect.arrayContaining(["edit_note", "styles"]));
  });

  it("no weather effects switch on a card that draws none", () => {
    expect(fields("reminder")).not.toContain("weather_effects");
  });

  it("the editors with HA's stack editor have the notes too", () => {
    for (const card of ["bar", "popup", "fab-sheet", "vertical-stack"]) {
      const ed = (customElements.get(`lumen-${card}-card`) as unknown as { getConfigElement(): { form: Form } }).getConfigElement();
      expect(names(ed.form.schema), card).toContain("edit_note");
    }
  });
});
