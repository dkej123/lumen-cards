import { describe, expect, it } from "vitest";
import { formDefaults, withDefaults, withoutDefaults } from "../src/core/form-editor";

describe("visual editor shows defaults", () => {
  const schema = [
    { name: "entity", selector: { entity: {} } },
    { name: "", type: "expandable", flatten: true, schema: [{ name: "", type: "grid", flatten: true, schema: [{ name: "show_modes", default: true }, { name: "show_range", default: false }] }] },
    { name: "feedback", type: "expandable", schema: [{ name: "success_state", default: "200" }] },
  ];
  it("collects flattened defaults only", () => {
    expect(formDefaults(schema)).toEqual({ show_modes: true, show_range: false });
  });
  it("a default-on switch is shown checked; unchanged defaults stay out of the YAML", () => {
    const d = formDefaults(schema);
    expect(withDefaults({ entity: "climate.a" }, d).show_modes).toBe(true);
    expect(withoutDefaults({ entity: "climate.a", show_modes: true, show_range: false }, d, { entity: "climate.a" })).toEqual({ entity: "climate.a" });
    expect(withoutDefaults({ entity: "climate.a", show_modes: false, show_range: false }, d, { entity: "climate.a" })).toEqual({ entity: "climate.a", show_modes: false });
    // A value the user had written explicitly is kept.
    expect(withoutDefaults({ entity: "climate.a", show_modes: true }, d, { entity: "climate.a", show_modes: true })).toEqual({ entity: "climate.a", show_modes: true });
  });
});
