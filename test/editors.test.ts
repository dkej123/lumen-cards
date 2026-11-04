// @vitest-environment happy-dom
// The visual editors: what each form offers, and which fields it shows in which mode.
import { afterEach, describe, expect, it, vi } from "vitest";
import { form, hide, type Schema } from "../src/core/form";
import { LumenFormEditor } from "../src/core/form-editor";
import "../src/lumen-cards";
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
