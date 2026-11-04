# Lumen Cards: guide for AI agents

Lumen Cards is a library of glass-style custom cards for Home Assistant Lovelace dashboards, written in Lit + TypeScript and installed through HACS. One bundle (`dist/lumen-cards.js`) registers every card.

- Part 1: building or changing a dashboard with Lumen cards.
- Part 2: changing the library's code.
- [docs/agents/overview.md](docs/agents/overview.md): what the project is and what it can do, in one file, with links to each card.
- [docs/agents/cards/](docs/agents/cards/): one file per card, with every option of that card.
- [docs/agents/cards.md](docs/agents/cards.md): every card and every field, generated from the code. Use it for option names and allowed values; do not guess them.
- README.md: end-user prose and the fallback values of each setting.

# Part 1: dashboards

## Install and resource

| Fact | Value |
|---|---|
| Minimum Home Assistant | 2026.6 |
| HACS | custom repository `https://github.com/dkej123/lumen-cards`, type **Dashboard** |
| File | `lumen-cards.js`, with the `.woff2` fonts flat next to it |
| Resource under HACS | registered by HACS |
| Resource without HACS | copy `dist/lumen-cards.js` and `dist/*.woff2` to `config/www/lumen-cards/`; add `/local/lumen-cards/lumen-cards.js` as a **JavaScript module** |
| "Custom element doesn't exist" | refresh the browser cache, then check there is one resource ending in `lumen-cards.js` |

## Card config

```yaml
type: custom:lumen-<name>-card
entity: light.sofa
```

The element tag is `lumen-<name>-card`; YAML needs the `custom:` prefix. Exact fields: [docs/agents/cards.md](docs/agents/cards.md).

Icons: `mdi:<name>`. Any icon works; those not bundled come from Home Assistant's `ha-icon`.

Actions (`tap_action`, `hold_action`, `double_tap_action`, `sub_buttons[].tap_action`…) use Home Assistant's format and go to its own handler:

```yaml
tap_action:
  action: navigate
  navigation_path: "#living-room"
```

## Which card for which entity

"Picker" = Home Assistant's card picker suggests this card for the domain.

| Domain | Card | Main key | Notes |
|---|---|---|---|
| `light` | `lumen-light-card` | `entity` | Picker. Small pills in a row: `lumen-chips-card`, `type: light` |
| `sensor` with a unit | `lumen-sensor-card` | `entity` | Picker. Chart behind the value |
| `sensor` PM2.5, PM10 or AQI | `lumen-air-quality-card` | `pm25`, `pm10`, `aqi_entity` | Picker. One of the three is enough |
| `binary_sensor`, any other state | `lumen-entity-card` | `entity` | Picker for `binary_sensor`. Tap defaults to details |
| `script`, `scene`, `button`, `input_button`, `automation` | `lumen-button-card` | `entity` | Picker. Several in one row: `lumen-chips-card`, `type: action` |
| `switch` and other toggleable | `lumen-button-card` | `entity` | Tap toggles. `lumen-entity-card` shows the state and needs `tap_action: { action: toggle }` |
| `input_boolean` as a "needs attention" flag | `lumen-reminder-card` | `entity` | Picker. Shows only while `state` matches (default `on`) |
| `climate` | `lumen-climate-card` | `entity` | Picker. Several: put them in `lumen-fab-sheet-card` |
| `cover` | `lumen-cover-card` | `entity` | Picker |
| `fan` | `lumen-fan-card` | `entity` | Picker |
| `media_player` | `lumen-media-card` | `entity` | Picker |
| `lock` | `lumen-lock-card` | `entity` | Picker. Real device |
| `alarm_control_panel` | `lumen-alarm-card` | `entity` | Picker. Real device |
| `person` | `lumen-person-card` | `entity` | Picker. Optional `presence_entity` |
| `input_select`, `select` | `lumen-select-card` | `entity` | Picker |
| `input_number`, `number` | `lumen-number-card` | `entity` | Picker |
| `calendar` | `lumen-calendar-card` | `entity` | Picker |
| `weather`, current weather and forecast | `lumen-weather-card` | `entity` | Picker |
| `weather`, animated background of the view | `lumen-weather-background-card` | `weather_entity` | Picker. Note the different key |

No entity needed: `lumen-greeting-card`, `lumen-title-card`, `lumen-nav-card`, `lumen-spacer-card`, and the containers below.

## Sections views and `grid_options`

Use a `sections` view. A section has 12 columns. Each card has a default width (see "Default `grid_options`" in cards.md); `grid_options` overrides it.

```yaml
views:
  - title: Home
    type: sections
    max_columns: 3
    sections:
      - type: grid
        cards:
          - type: custom:lumen-light-card
            entity: light.sofa
            grid_options: { columns: 6 }
          - type: custom:lumen-entity-card
            entity: binary_sensor.front_door
            grid_options: { columns: 3 }
```

`max_width` (with `max_width_unit: "%"` or `px`) caps a card or stack and centres it in its place. It is for Panel views and very wide sections.

## Phone and desktop

Lumen's narrow/wide boundary is a **1024 px** viewport. For a different arrangement per screen, add a card twice with Home Assistant's `screen` condition, on the card or on a whole section:

```yaml
- type: custom:lumen-light-card
  entity: light.sofa
  grid_options: { columns: 3 }
  visibility:
    - condition: screen
      media_query: "(max-width: 1023px)"
- type: custom:lumen-light-card
  entity: light.sofa
  grid_options: { columns: 6 }
  visibility:
    - condition: screen
      media_query: "(min-width: 1024px)"
```

- A card hidden by such a condition also hides its floating button and dialogs.
- Home Assistant shows every copy in edit mode. Lumen labels them "Phone" / "Computer" there. `edit_note` adds your own note, visible only in edit mode.
- A view with Lumen cards gets an All / Phone / Computer switch in edit mode. It evaluates min-width and max-width queries only.

## Compact and full layout

`layout` values: `auto` (default), `wide` (shown as "Full" in the editor), `compact`. `lumen-weather-card` also has `icon`; there `compact` is the one-line look and `wide` the card with hours. The value `full` does not exist.

With `auto`, a card follows either its own width or the screen. Cards without a `layout` field in their form are not listed.

<!-- compact-table:begin (generated: npm run docs:agents) -->
| Card | `layout: auto` is compact when |
|---|---|
| `lumen-alarm-card` | card < 200 px |
| `lumen-button-card` | card < 120 px |
| `lumen-climate-card` | card < 300 px |
| `lumen-cover-card` | card < 200 px |
| `lumen-entity-card` | card < 120 px |
| `lumen-fan-card` | card < 200 px |
| `lumen-light-card` | card < 220 px |
| `lumen-lock-card` | card < 200 px |
| `lumen-media-card` | card < 280 px |
| `lumen-number-card` | card < 200 px |
| `lumen-person-card` | card < 240 px |
| `lumen-purifier-card` | never (only `layout: compact`) |
| `lumen-select-card` | card < 200 px |
| `lumen-sensor-card` | never (only `layout: compact`) |
| `lumen-weather-card` | card < 240 px |
| `lumen-air-quality-card` | screen < 1024 px |
| `lumen-chips-card` | screen < 1024 px |
| `lumen-greeting-card` | screen < 1024 px |
| `lumen-title-card` | screen < 1024 px |
| `lumen-weather-background-card` | screen < 1024 px |
<!-- compact-table:end -->

Three columns of a section are a typical way to reach the compact look on a phone. In `lumen-bar-card` inner Lumen cards are always compact; in `lumen-fab-sheet-card` inner climate cards are compact unless they set `layout`.

## Floating buttons

Three cards can float, always in a corner of the screen:

| Card | Enable | Only below 1024 px unless | At 1024 px and up with the default |
|---|---|---|---|
| `lumen-chips-card` | `fab: true` | `fab_narrow_only: false` | the normal row |
| `lumen-climate-card` | `fab: true` | `fab_narrow_only: false` | the normal card |
| `lumen-fab-sheet-card` | always, when it has `cards` | `narrow_only: false` | a row in the grid opening the same sheet |

With `fab: true` you need no second copy of the card for desktop. On chips, only `type: action` chips float; `type: light` chips stay in the row.

Stacking (`src/core/layer.ts`):

- `fab_side: right` (default) or `left`. Each side is its own stack.
- From the bottom: scenes (chips), then climate and floating panels in registration order.
- The lowest button is 64 px, each next one 48 px, with a 12 px gap.
- The stack starts 24 px from the bottom plus the safe area, and 16 px from the edge of the view. Change this with the theme variables below.
- A visible `lumen-nav-card` with `position: bottom` lifts the stack by itself, unless a theme set `lumen-cards-fab-bottom`.

### `lumen-spacer-card`

Floating buttons can cover the last card. Put a spacer last in the view:

```yaml
- type: custom:lumen-spacer-card
```

It is as tall as the taller stack on screen plus 16 px, and takes no space when no button floats. `height: <px>` fixes the height instead. Its outline shows only while editing.

## Lights behind relays

**One relay** feeding one bulb, the bulb being `unavailable` while the relay is off:

```yaml
type: custom:lumen-light-card
entity: light.sofa
power_entity: switch.sofa_relay
```

- Relay off shows "off", not "unavailable".
- A tap switches the relay when the bulb is on or the relay is off.
- Setting a value with the relay off switches it on and sends the value 2 s and 5 s later.
- `power_entity` accepts `switch`, `light` and `input_boolean` entities.

**Several bulbs behind several switches**: `entity` is the group, `power_entities` the switches.

```yaml
type: custom:lumen-light-card
entity: light.wall_lamps
name: Wall lamps
icon: mdi:wall-sconce-flat
power_entities:
  - switch.wall_lamp_1
  - switch.wall_lamp_2
sub_buttons:
  - entity: switch.wall_lamp_1
    name: Wall lamp 1
  - entity: switch.wall_lamp_2
    name: Wall lamp 2
```

- Only the small buttons switch power. A tap on the tile does nothing unless `tap_action` is set.
- While any switch is on, the tile sets brightness and colour of the group. While all are off, values cannot be set.
- Without `sub_buttons` there is one button per switch, with the switch's icon or a bulb.
- Use `power_entities` for two or more switches and `power_entity` for one: the one-relay behaviour above does not apply to a single-item `power_entities`.

`sub_buttons` limit: 4 shown, 2 on a card narrower than 280 px, 1 when compact (the light card shows 2 when compact and at least 170 px wide). The rest is hidden. Available on the light, entity, button, person and alarm cards.

## Containers

All take `cards`: a list of complete card configs, Lumen or not. Inside `lumen-bar-card`, popup and panel, Lumen cards draw no weather effects unless they set `weather_effects`.

| Card | Use | Own keys |
|---|---|---|
| `lumen-vertical-stack-card` | One under another, one width for the group | `title`, `max_width`, `max_width_unit`, `align` |
| `lumen-horizontal-stack-card` | Side by side | same, plus `card_width: equal` (default) or `content` (own width, wraps) |
| `lumen-bar-card` | One 52 px glass row of compact cells with equal widths, e.g. doors and locks | none |
| `lumen-popup-card` | Sheet opened by a URL hash | `hash` (required), `name`, `icon`, `show_trigger`, `auto_close` |
| `lumen-fab-sheet-card` | Floating button opening a sheet, typically all thermostats | `icon`, `title`, `narrow_only`, `fab_side`, `badge_entities` |

```yaml
- type: custom:lumen-horizontal-stack-card
  card_width: content
  align: start
  cards:
    - type: custom:lumen-reminder-card
      entity: input_boolean.bike_battery
- type: custom:lumen-popup-card
  hash: "#living-room"
  name: Living room
  cards:
    - type: custom:lumen-light-card
      entity: light.sofa
- type: custom:lumen-button-card
  entity: script.movie
  tap_action:
    action: navigate
    navigation_path: "#living-room"
- type: custom:lumen-fab-sheet-card
  icon: mdi:radiator
  title: Heating
  cards:
    - type: custom:lumen-climate-card
      entity: climate.living_room
    - type: custom:lumen-climate-card
      entity: climate.bedroom
```

The popup card is invisible on the dashboard unless `show_trigger: true`. `lumen-nav-card` items can also open it with `navigation_path: "#living-room"`.

## Weather background

Add `lumen-weather-background-card` **once per view**. It takes no space, unless `show_controls: true` shows the per-device switches.

```yaml
- type: custom:lumen-weather-background-card
  weather_entity: weather.home
```

Without it, `weather_effects` on the other cards draws nothing. `weather_effects: false` turns effects off for one card.

## Theme variables

Set them in a Home Assistant theme, without the leading `--`:

```yaml
my_theme:
  lumen-cards-fab-bottom: 90px
  lumen-cards-fab-right: 24px
  lumen-cards-fab-left: 24px
  lumen-cards-glow-color: "#ffb347"
```

| Variable | Effect | Default |
|---|---|---|
| `lumen-cards-fab-bottom` | Distance of the floating stacks from the bottom | 24px |
| `lumen-cards-fab-right`, `lumen-cards-fab-left` | Distance of the floating buttons from the edge of the view | 16px |
| `lumen-cards-glow-color` | Glow of lit lights, for all cards; a card's `glow_color` wins | the light's own colour |

No theme variable sets the accent. Use `accent_color` per card, despite the `lumen-cards-accent` mentioned in the README.

## Rules

- **Verify entity ids before using them.** Read the live state list; never write an id you have not seen there. The ids in this file, cards.md and the README are examples, including `Starting config` values.
- **Never put secrets or private entity names into this repo**: no tokens, hostnames, addresses, real names. Examples use generic ids such as `light.sofa`.
- **Alarm, lock and gate entities are real devices.** Do not call their services or trigger their scripts to test a card. Check them by reading state. The same goes for any `script` or `button` whose effect you do not know.
- **Validation errors show on the card; `setConfig` does not throw.** Saving a bad config succeeds, and the card then renders a Lumen error card with the reason and the type. A missing main `entity` renders "Entity not found". So check the rendered dashboard, not just the save result. A throw from a form's `assertConfig` only makes Home Assistant fall back to the YAML editor.
- Unknown keys are ignored silently: check names against cards.md.
- `show_*` switches default to on where cards.md says `true`. Write only values that differ from the default.

# Part 2: changing the library

## Repo map

| Path | What |
|---|---|
| `src/lumen-cards.ts` | Bundle entry: imports every card |
| `src/cards/` | One file per card, except both stacks in `stack.ts` |
| `src/core/base-card.ts` | `LumenBaseCard`: config, `hass` gating, general states, compact logic |
| `src/core/container-card.ts` | `LumenContainerCard`: base of cards holding `cards` |
| `src/core/form.ts` | Editor schema helpers, `LABELS`, `HELPERS` |
| `src/core/register.ts` | `registerCard`: element + `window.customCards` entry |
| `src/core/layer.ts` | Body-level layer for overlays, floating-button stacks |
| `src/core/controllers/` | ReactiveControllers: `code-pad`, `host-look`, `pending`, `tween`, `user-styles` |
| `src/core/` others | Actions, sheets, presses, sub-buttons, i18n, visibility labels, shared parts |
| `src/core/icons.ts` | **Generated** by `scripts/gen-icons.mjs` from `mdi:` literals in `src/`. Do not edit |
| `src/lights/controller.ts` | `LightsController`: tile, pill, sheet, relay logic, shared by light and chips cards |
| `src/logic/` | Decisions without rendering: unit-test them in `test/logic.test.ts` |
| `src/weather/` | Weather effects engine and drawing |
| `src/translations/` | `en.json`, `pl.json` |
| `src/design/` | Design tokens, font list |
| `src/hass/` | Home Assistant types |
| `dev/` | Demo (`demo.ts`, `index.html`), mock `hass` (`mock-hass.ts`), catalog (`catalog.ts`, `catalog-data.ts`, `catalog-guide.ts`) |
| `test/` | vitest. `helpers.ts`: entities, recording `hass` mock, mounting cards |
| `dist/` | Built bundle and fonts, **committed** |
| `docs/agents/` | `overview.md`, `cards.md`, `cards/<tag>.md`: **generated** by `test/agent-docs.test.ts`. Do not edit |

## Commands

| Command | Use |
|---|---|
| `npx vitest run` | All tests |
| `npx tsc --noEmit -p .` | Type check, including `test/` and `dev/` |
| `npm run build` | Icons + `tsc --noEmit` + bundle into `dist/`. Must succeed |
| `npm run docs:agents` | Rewrites `docs/agents/` and the compact table in this file |
| `npm run dev` | Demo with mock devices at `http://localhost:5174/dev/index.html` (options in the README) |

**Commit `dist/` with every source change.** CI runs the build and tests, then fails on `git diff --exit-code -- dist/`.

## Conventions

- Cards extend `LumenBaseCard<Config>` and implement `renderCard()`, not `render()`: `render()` adds the error, loading and edit-mode states around it.
- `entityIds()` is required and lists every entity the card reads. A new `hass` re-renders the card only when one of these changed.
- `validate(config)` throws an `Error` with a translated message; the base class shows it as the error card. Never throw out of `setConfig`.
- `defaults()` merges under the user's config.
- Per-card statics: `compactBelow` (px or `"screen"`), `grid`, `cardSize`, `skeletonHeight`, `sample`.
- Behaviour with a lifecycle goes in a ReactiveController (`LayerController`, `FabController`, `LightsController`, `Pending`, `Tween`…), not in the card's callbacks. Timers die with the card: `this.every()` or the controller's `hostDisconnected`.
- Overlays (sheets, dialogs, floating buttons) render through `LayerController` into a body-level layer, because dashboard ancestors may be transformed.
- Pure decisions go in `src/logic/`.
- User-visible text only through `t("card.<name>.…")`. `test/i18n.test.ts` requires every key in both files, equal placeholders, and no Polish text in `src/`.
- The editor is Home Assistant's `ha-form` via `getConfigForm()`, built with `form()`, `nameIcon()`, `actions()`, `advanced()`, `appearance()`.
- A field that does not apply in the current mode: `form((c) => hide(c, schema, [[condition, ["field"]]]))`. `getConfigForm().schema` still has every field for the docs and the catalog, and a field holding a value stays so it can be cleared.
- **Every editor field needs a label.** Add its name to `LABELS` in `src/core/form.ts`, or give it a `title` (a nested list field: `label`). Help text goes in `HELPERS`, or `helper: "<key>"` on the field. All of them need keys in `en.json` and `pl.json`. `test/form-labels.test.ts` enforces labels.
- A new config key not in the form (YAML only) goes in `SUPPLEMENT` in `test/agent-docs.test.ts`.

## Add a card

1. `src/cards/<name>.ts`: class with `renderCard`, `entityIds`, `validate`, `static getStubConfig`, `static getConfigForm`; a container extends `LumenContainerCard`.
2. Register it in that file:

   ```ts
   registerCard("lumen-<name>-card", LumenNameCard, {
     name: "card.<name>.name",
     description: "card.<name>.description",
     domains: ["<domain>"], // optional: picker suggestion
   });
   ```

3. Import it in `src/lumen-cards.ts`.
4. Add texts to `src/translations/en.json` and `pl.json`.
5. Add labels and help to `src/core/form.ts`.
6. Add tests in `test/`.
7. Document it in `README.md` and `README.pl.md`, with `<a id="lumen-<name>-card"></a>` above the settings table: the picker's documentation link points at that anchor.
8. Add a section to `SECTIONS` in `dev/catalog-data.ts` and an entry under the same id in `GUIDE` in `dev/catalog-guide.ts` (both in Polish). Add demo entities to `dev/mock-hass.ts` if needed.
9. Run `npm run docs:agents`, `npx vitest run` and `npm run build`. Commit everything, `dist/` and `docs/agents/cards.md` included.

Change a form or a threshold: run `npm run docs:agents` too. `test/agent-docs.test.ts` fails until you do.
