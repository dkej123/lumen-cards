# Lumen Cards

**Beautiful, glass-style cards for your Home Assistant dashboard. Every card can be set up with clicks, no code needed.**

[Polski](README.pl.md)

<p align="center">
  <img src="docs/images/dashboard-desktop.jpg" alt="A tablet / desktop dashboard built from Lumen Cards" width="820"><br>
  <img src="docs/images/dashboard-phone.jpg" alt="The same home on a phone" width="260">
  <img src="docs/images/dashboard-phone-dark.jpg" alt="The phone dashboard in dark mode, at night" width="260">
</p>

What you get:

- **Cards for the everyday things in a home:** lights, people, alarm, locks, doors, the gate, temperatures, air quality, the air conditioner, reminders, blinds, music, fans, lists, calendars, a navigation bar and pop-ups.
- **Weather on the dashboard.** Rain, snow, fog or sunshine move behind the cards, and raindrops or snow settle on the cards themselves.
- **Big, comfortable controls.** Tap a light to switch it on, slide a finger across it to dim it, and hold it to pick the brightness and colour.
- **Phone and big screen.** A card squeezed into a small space turns into a low compact tile (44 px, equal in a row).
- **Light and dark mode.** The cards follow your Home Assistant settings.
- **English and Polish.** The cards and their settings use the language from your Home Assistant profile.

### What it looks like in a real home

The author's own dashboard in the evening, in dark mode. On the desktop, the version built from Lumen Cards. On the phone, the "Dom" panel that Lumen Cards grew out of (the cards look the same):

<p align="center">
  <img src="docs/images/real-home-desktop.jpg" alt="A real home dashboard made of Lumen Cards on a desktop, in the evening" width="820"><br>
  <img src="docs/images/real-home-phone.jpg" alt="The same dashboard on a phone" width="300">
</p>

---

## Contents

1. [Install](#install)
2. [Add your first card](#add-your-first-card)
3. [The cards](#the-cards)
4. [Example dashboards](#example-dashboards)
5. [Settings of every card](#settings-of-every-card)
6. [Questions and problems](#questions-and-problems)
7. [For developers](#for-developers)

---

## Install

You need **Home Assistant 2026.6 or newer** and **[HACS](https://hacs.xyz/)** (the community store for Home Assistant add-ons).

1. Open **HACS** in the Home Assistant sidebar.
2. Click the **⋮** menu (top right) and choose **Custom repositories**.
3. Paste `https://github.com/dkej123/lumen-cards`, choose the type **Dashboard**, and click **Add**.
4. Search HACS for **Lumen Cards**, open it and click **Download**.
5. **Refresh your browser** (on a computer press Ctrl+F5, or Cmd+Shift+R on a Mac). In the Home Assistant phone app, open **Settings → Companion app → Debugging → Reset frontend cache**.

That's it. HACS tells Home Assistant about the new cards by itself.

<details>
<summary>Installing without HACS</summary>

1. Download the latest release from the Releases page, or the files in the `dist/` folder: `lumen-cards.js` and all the `.woff2` font files.
2. Copy them into the folder `config/www/lumen-cards/` on your Home Assistant.
3. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**, enter `/local/lumen-cards/lumen-cards.js` and choose **JavaScript module**.
4. Refresh the browser.
</details>

## Add your first card

1. Open a dashboard and click the **pencil** (top right) to edit it.
2. Click **+ Add card**.
3. Type **Lumen** in the search box. You will see all the Lumen cards with a live preview.
   You can also go to the **By entity** tab and pick a device, for example a light. Lumen will suggest the right card for it.
4. Pick a card. A settings window opens. Choose your device in the first field and the preview updates straight away.
5. Click **Save**.

Every setting has a field in this window. You never have to write code.

> **Tip:** to make a card bigger or smaller, drag its corner while the dashboard is in edit mode. A narrow card switches to its compact look on its own.

---

## The cards

### Light

<img src="docs/images/light.png" alt="Light cards: one on, one off" width="480"><br>
<img src="docs/images/light-color.png" alt="A colour LED strip and a white kitchen light" width="480"><br>
<img src="docs/images/light-dark.png" alt="Light cards in dark mode" width="480">

A large tile for one light. The tile glows in the colour of the bulb.

- **Tap** to switch it on or off.
- **Slide your finger** left or right across the tile to set the brightness.
- **Tap the small circle** to choose a warmer or cooler white.
- **Tap the icon or hold** to open the full controls: brightness, four white tones spread over your bulb's range, eight colours and a colour wheel for colour bulbs.

A light group shows how many lights are on ("2 of 3 on"). In a small space (under 220 px) the tile gets lower and the name may take two lines.

<img src="docs/images/light-sheet.png" alt="Brightness, white tones and colours panel" width="260">

### Chips

<img src="docs/images/chips.png" alt="Scene chips and light pills" width="480">

A row of small round buttons. They come in two kinds:

- **Action:** runs a scene, script or button with one tap, for example "Movie" or "Evening".
- **Light:** a small pill for a light, which works like the light card.

On a phone you can turn the action chips into a **floating button** in the corner of the screen. Tap it for the list of scenes; the one you used last is highlighted:

<img src="docs/images/fab-list.png" alt="Floating button with the list of scenes" width="260">

### Person

<img src="docs/images/person.png" alt="Two people: one at home, one away" width="480">

Shows a household member: their photo (or initial on a colour picked from their name), a **green dot when they are home**, and how long they have been home or away. When they are away, it shows where, for example "Work". If presence comes from a sensor such as a Bluetooth tag, a small "BLE" badge says so.

### Alarm

<img src="docs/images/alarm.png" alt="Alarm armed and disarmed" width="480">

Shows your alarm at a glance. Every armed mode is green (the icon and caption tell home, away, night or vacation apart), arming shows a yellow countdown bar with **Cancel**, the entry delay is orange and pulsing, and a triggered alarm turns the card red.

**Arm** opens a keypad with the modes your alarm supports, **Disarm** just the keypad. A wrong code makes the dots shake. Alarms that need no code switch straight away.

<img src="docs/images/alarm-keypad.png" alt="Keypad with Home, Away and Night" width="260">

When the alarm goes off, the whole screen also pulses red:

<img src="docs/images/alarm-triggered.png" alt="Alarm going off" width="480">

Prefer your own script? Set `tap_action` to it and the card and its buttons run the script instead of the keypad.

### Lock

<img src="docs/images/lock.png" alt="A car lock and a door lock" width="480">

Shows whether a lock is locked, with **Lock** and **Unlock** buttons (and **Open** if the lock can open the door). It also shows when the lock is working, open or jammed (red frame). **Lock** works straight away; if the lock needs a PIN, **Unlock** and **Open** ask for it first:

<img src="docs/images/lock-code.png" alt="Entering the lock code" width="260">

### Entity (door, window…)

<img src="docs/images/entity.png" alt="Front door closed, back door open" width="480">

A small tile for anything with a state. Doors and windows turn **red when open**, switched-on things get the accent colour. Up to four small extra buttons fit on the right (two on a narrow card). In a small space the card becomes a small square icon button, like in an access bar.

### Button

<img src="docs/images/button.png" alt="Gate button with an extra light button" width="480">

Runs something with one tap: a script, a scene, a button. It can also **wait for an answer** from the device (up to 10 seconds), for example a gate that reports whether it really opened. Success shows in green for 6 seconds; an error gets a red frame and stays until the next try.

The small round button on the right is an **extra button** (`sub_buttons`). You can add them to several cards, for example to switch a nearby light.

### Sensor

<img src="docs/images/sensor.png" alt="Two temperature sensors with charts" width="480">

A temperature (or any other number) with a small chart of the last hours behind it. Tap to see the full history. When the sensor has not reported for a while, the card gets a dashed frame and says how old the value is.

### Climate

<img src="docs/images/climate.png" alt="Air conditioner card" width="480">

For an air conditioner or a thermostat: the target temperature with **−** and **+**, the modes and fan speeds your device has, swing and presets, and a badge saying what it is doing right now (heating, cooling, idle). Thermostats with a range show two fields: "Heat to" and "Cool from".

On a phone it can shrink to a **floating round button** that shows the temperature. Tap it to open the controls, or hold it to switch the device on or off:

<img src="docs/images/climate-fab.png" alt="Floating buttons for scenes and air conditioning" width="260">
<img src="docs/images/climate-dialog.png" alt="Air conditioner controls on a phone" width="260">

### Air quality

<img src="docs/images/air-quality.png" alt="Air quality: good" width="480">

Turns PM2.5 / PM10 (or an AQI sensor) into six easy levels, from "Very good" to "Extremely poor", using the European Air Quality Index. Tap it for a 24-hour chart. If the sensor stops sending data, the card shows a dashed border and "Outdated data".

### Reminder

<img src="docs/images/reminder.png" alt="Reminder pill" width="480">

A small pill that appears **only when something needs attention**, for example "Bike – battery 18 %". It can also pop up a window when it starts, and again every time you open the dashboard, until you tap **Done**:

<img src="docs/images/reminder-dialog.png" alt="Reminder window" width="260">

### Title

<img src="docs/images/title.png" alt="Three title styles" width="480">

Headings that split your dashboard into parts, in three styles: a small caps label, a large section title, or a room header. A heading can show values next to it, like the room temperature.

### Greeting

<img src="docs/images/greeting.png" alt="Greeting" width="480">

"Good morning / Good afternoon / Good evening" with the name of whoever is logged in, and today's date.

### Weather background

<img src="docs/images/weather-rainy.jpg" alt="Rain behind and on the cards" width="480">
<img src="docs/images/weather-snowy-dark.jpg" alt="Snow at night, dark mode" width="480">

Add this card **once per dashboard view** and the sky behind your cards follows the real weather: sun, clouds, rain, snow, fog, wind and lightning, by day and by night. Raindrops and snow also appear on the other Lumen cards.

The card itself takes no space. If you like, it can show three switches so each device decides for itself: background on/off, weather on cards on/off, animations on/off. That is handy for an old tablet.

### Blinds and covers

<img src="docs/images/cover.png" alt="Blind half open with Open, Stop and Close, and slats" width="480">

Roller blinds, shutters, garage doors. **Slide your finger** across the card to set the position (it moves when you let go), or use **Open**, **Stop** and **Close**. Covers with tilting slats get a second bar for the slats.

### Media player

<img src="docs/images/media.png" alt="Music player with cover art, controls and volume, and a compact row" width="480">

Speakers and TVs: cover art, title and artist, previous / play-pause / next, progress and volume. In a small space it becomes a single row with a play button.

### List (select)

<img src="docs/images/select.png" alt="Vacuum mode list" width="480">

For `input_select` and `select` helpers, for example a vacuum mode or "home / away / night". Tap to open the list and pick an option.

### Fan and number

<img src="docs/images/fan-number.png" alt="Fan at 60 percent and two number sliders" width="480">

A fan, an `input_number` or a `number` as a big slider tile: **slide** to set the speed or value, **tap** to switch the fan on or off. The fan icon spins faster at higher speeds.

### Calendar

<img src="docs/images/calendar.png" alt="List of upcoming events" width="480">

The next events from a calendar for the coming days, with today and tomorrow clearly marked.

### Navigation bar

<img src="docs/images/nav.png" alt="Bottom navigation bar with four views" width="480">

A bar with buttons for your dashboard's views (or pop-ups). It can stick to the bottom of the screen like an app's tab bar; floating buttons then move above it.

### Pop-up

<img src="docs/images/popup.png" alt="Pop-up with the living room's cards" width="260">

A window with any cards you like, Lumen or not, opened by a link like `#living-room` (for example from the navigation bar or a button). Close it with ×, Esc, a tap outside, or by swiping down. The card itself is invisible on the dashboard unless you want a row that opens it.

### Weather

The current weather from any `weather.*` entity (Met.no, Google Weather, OpenWeatherMap…): a slim 44 px line, just an icon with the temperature (to stand next to the greeting), or a card with the next hours. Tap it for the details sheet: now (feels like, wind, humidity, pressure, UV, visibility, sunrise and sunset), today hourly with a chart of the temperature and the feels-like temperature, the next days (tap a day to see its hours) and weather warnings, e.g. from IMGW-PIB Monitor. Every tile shows only when your weather entity has that value.

### Stacks

Vertical and horizontal stacks like Home Assistant's own (cards one under another or side by side with equal widths), with the same card editor, plus one max. width for the whole group – as a percent of its place or in pixels, centred or at one side. The cards inside can have their own visibility conditions, as in HA's stacks.

### Floating panel

One floating round button that opens a sheet with any cards – typically all your thermostats in one place instead of a floating button for each. The button shows how many of them are heating, turns orange with a soft pulse while something heats, and warns about a weak valve battery or a device that is offline. In the sheet you get one row per thermostat (−/+ to change the temperature) and, when the thermostats share their presets, **All: Comfort / Eco / Off** for all of them at once. On a computer it is a row in the grid that opens the same sheet.

---

## Example dashboards

The two dashboards at the top of this page. To use one:

1. Create a new dashboard: **Settings → Dashboards → + Add dashboard → New dashboard from scratch**.
2. Open it, click the **pencil**, then **⋮ → Raw configuration editor**.
3. Delete everything there, paste the example and click **Save**.
4. **Replace the example devices with your own.** For example, change `light.sofa` to the name of your light. You can also do this later card by card with the pencil.

<details>
<summary><b>Phone dashboard</b> (one column)</summary>

```yaml
views:
  - title: Home
    type: sections
    max_columns: 1
    sections:
      - type: grid
        cards:
          - type: custom:lumen-weather-background-card
            weather_entity: weather.home
          - type: custom:lumen-greeting-card
          # four small square buttons in one row
          - type: custom:lumen-alarm-card
            entity: alarm_control_panel.house
            grid_options: { columns: 3 }
          - type: custom:lumen-alarm-card
            entity: alarm_control_panel.garage
            icon: mdi:garage
            grid_options: { columns: 3 }
          - type: custom:lumen-entity-card
            entity: binary_sensor.front_door
            grid_options: { columns: 3 }
          - type: custom:lumen-lock-card
            entity: lock.car
            icon: mdi:car
            grid_options: { columns: 3 }
          - type: custom:lumen-person-card
            entity: person.alex
            grid_options: { columns: 6 }
          - type: custom:lumen-person-card
            entity: person.sam
            grid_options: { columns: 6 }
          - type: custom:lumen-reminder-card
            entity: input_boolean.bike_battery
            name: Bike
            icon: mdi:bicycle-electric
            color: danger
            value: "Battery {value}%"
            value_entity: sensor.bike_battery
            title: Charge the bike
            message: The battery is below 20 %.
            done: true
            alignment: center
          - type: custom:lumen-title-card
            title: Living room
            heading_style: section
            badges: [sensor.living_temp]
          - type: custom:lumen-light-card
            entity: light.sofa
            icon: mdi:sofa
            grid_options: { columns: 6 }
          - type: custom:lumen-light-card
            entity: light.ceiling
            icon: mdi:ceiling-light
            grid_options: { columns: 6 }
          - type: custom:lumen-light-card
            entity: light.kitchen
            icon: mdi:stove
            grid_options: { columns: 6 }
          - type: custom:lumen-light-card
            entity: light.strip
            icon: mdi:led-strip-variant
            grid_options: { columns: 6 }
          - type: custom:lumen-air-quality-card
            pm25: sensor.pm25
            pm10: sensor.pm10
          - type: custom:lumen-sensor-card
            entity: sensor.living_temp
            grid_options: { columns: 6 }
          - type: custom:lumen-sensor-card
            entity: sensor.outside_temp
            color: light-blue
            grid_options: { columns: 6 }
          # these two become floating buttons in the corner
          - type: custom:lumen-chips-card
            fab: true
            chips:
              - { type: action, entity: scene.movie }
              - { type: action, entity: scene.evening }
          - type: custom:lumen-climate-card
            entity: climate.bedroom_ac
            fab: true
```
</details>

<details>
<summary><b>Tablet / desktop dashboard</b> (three columns)</summary>

```yaml
views:
  - title: Home
    type: sections
    max_columns: 3
    sections:
      - type: grid
        cards:
          - type: custom:lumen-weather-background-card
            weather_entity: weather.home
          - type: custom:lumen-greeting-card
          - type: custom:lumen-title-card
            title: Security
          - type: custom:lumen-alarm-card
            entity: alarm_control_panel.house
          - type: custom:lumen-alarm-card
            entity: alarm_control_panel.garage
            icon: mdi:garage
          - type: custom:lumen-title-card
            title: People
          - type: custom:lumen-person-card
            entity: person.alex
          - type: custom:lumen-person-card
            entity: person.sam
      - type: grid
        cards:
          - type: custom:lumen-chips-card
            chips:
              - { type: action, entity: scene.movie }
              - { type: action, entity: scene.evening }
          - type: custom:lumen-reminder-card
            entity: input_boolean.bike_battery
            name: Bike
            icon: mdi:bicycle-electric
            color: danger
            value: "Battery {value}%"
            value_entity: sensor.bike_battery
            done: true
            alignment: center
          - type: custom:lumen-title-card
            title: Living room
            heading_style: section
            badges: [sensor.living_temp]
          - type: custom:lumen-light-card
            entity: light.sofa
            icon: mdi:sofa
            grid_options: { columns: 6 }
          - type: custom:lumen-light-card
            entity: light.ceiling
            icon: mdi:ceiling-light
            grid_options: { columns: 6 }
          - type: custom:lumen-light-card
            entity: light.kitchen
            icon: mdi:stove
            grid_options: { columns: 6 }
          - type: custom:lumen-light-card
            entity: light.strip
            icon: mdi:led-strip-variant
            grid_options: { columns: 6 }
          - type: custom:lumen-title-card
            title: Kitchen
            heading_style: room
            badges: [sensor.living_temp]
          - type: custom:lumen-chips-card
            chips:
              - { type: light, entity: light.kitchen, name: Stove }
              - { type: light, entity: light.strip, name: Strip }
      - type: grid
        cards:
          - type: custom:lumen-title-card
            title: Access
          - type: custom:lumen-entity-card
            entity: binary_sensor.front_door
            grid_options: { columns: 6 }
          - type: custom:lumen-entity-card
            entity: binary_sensor.back_door
            grid_options: { columns: 6 }
          - type: custom:lumen-lock-card
            entity: lock.car
            icon: mdi:car
          - type: custom:lumen-button-card
            entity: script.gate
            icon: mdi:gate
            grid_options: { columns: 6 }
          - type: custom:lumen-title-card
            title: Climate
          - type: custom:lumen-air-quality-card
            pm25: sensor.pm25
            pm10: sensor.pm10
          - type: custom:lumen-sensor-card
            entity: sensor.living_temp
            grid_options: { columns: 6 }
          - type: custom:lumen-sensor-card
            entity: sensor.outside_temp
            color: light-blue
            grid_options: { columns: 6 }
          - type: custom:lumen-climate-card
            entity: climate.bedroom_ac
```
</details>

> **One dashboard for both phone and tablet?** Yes. Add a card twice: once small (for example 3 columns wide) shown only on phones, and once big shown only on large screens. In the card editor, open the **Visibility** tab → **Add condition** → **Screen** and tick the screen sizes. Home Assistant hides the other copy for you.

---

## Settings of every card

You can change all of these in the card editor. The names in `code font` are what you see in YAML, if you ever look there.

### Settings that every card has

You find them under **Appearance** and **Advanced** at the bottom of the editor.

| Setting | What it does | Default |
|---|---|---|
| `layout` | **Auto** picks the look by itself: compact when the card is small. **Full** or **Compact** forces one look. | Auto |
| `color_scheme` | Light or dark card, or **Auto** to follow Home Assistant | Auto |
| `accent_color` | Colour of buttons and highlights (switched-on things, extra buttons, sliders; the active chip and floating button; the reminder pill – it wins over the reminder's own `color`). Not offered on cards with nothing to colour (greeting, title, air quality, calendar, pop-up). | from the theme |
| `glow_color` | Colour of the glow around lit lights (light and chips cards) | the light's own colour |
| `weather_effects` | Raindrops, snow and so on drawn on this card. Needs the weather background card in the same view. | on |
| `max_width` | The card is never wider than this and stays centred in its place: pixels, or percent of its grid place with `max_width_unit: "%"` (or `max_width: 80%`). Handy in a Panel view or very wide sections; in a normal sections view the columns already keep cards narrow. | full width |
| `max_width_unit` | `px` or `%` for a numeric `max_width` | `px` |
| `tap_action`, `hold_action`, `double_tap_action` | What happens when you tap, hold or double-tap: switch, show details, open another page, run a script… | depends on the card |
| `sub_buttons` | Small extra round buttons on the right of the card, each with its own device and action. Available on entity, button, person and alarm cards. At most 4 are shown (2 on a narrow card, 1 on a compact one); the editor warns about the rest. | none |
| — | **Layout preview while editing:** a switch at the bottom of the view (All / Phone / Computer) hides the cards and sections of the other screen size, so each layout can be edited on its own. It evaluates HA screen conditions (min / max width), is remembered on the device and disappears when you leave edit mode. Appears when the view has at least one Lumen card. | – |
| `edit_note` | A note shown on the card only while the dashboard is being edited. Cards hidden by a screen condition (their own or their section's) also get a "Phone" / "Computer" label there automatically ("· section" when the condition is on the section, not the card): HA shows them all in edit mode without telling them apart. | none |
| `styles` | For tinkerers: your own CSS inside the card | none |
| `haptics` | Gentle vibration on tap, hold and while dragging (the lightest tick every 1 %, slightly firmer at the ends). Works in the HA app and Android browsers. | on |

**Colours.** `accent_color` and `glow_color` accept Home Assistant colour names (`blue`, `pink`…), hex or rgb. From that one colour the card builds the whole set: the fill, the glow, the icon background and a readable text colour, in light and dark mode.

**When something is wrong.** A card whose device is missing, or whose settings are incomplete, shows a clear Lumen error card with the reason instead of breaking. While Home Assistant is still loading, cards show a soft placeholder, and in the card picker they show example data.

<img src="docs/images/general-states.png" alt="Unavailable and unknown lock, error cards and loading" width="480">

<a id="lumen-light-card"></a>

### Light (`lumen-light-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The light | – |
| `name`, `icon` | Name and icon on the tile | from the device |
| `power_entity` | The wall switch or relay that powers the bulb. When it is off the bulb is "off", not "unavailable", and a tap switches the relay. | none |
| `show_state` | Show the brightness line | on |
| `show_color_button` | Show the small white-tone circle | on |

<a id="lumen-chips-card"></a>

### Chips (`lumen-chips-card`)

| Setting | What it does | Default |
|---|---|---|
| `chips` | The list of chips. Each one has a `type`: **action** (scene, script, button…) or **light**. Each also has an `entity`, and optionally a `name`, `icon` and `tap_action`. Light chips can have a `power_entity`. | – |
| `alignment` | Left, centre, right or spread out | left |
| `fab` | **Show as a floating button**: the action chips move into a round button in the bottom-right corner | off |
| `fab_narrow_only` | **Auto: only on narrow screens.** The floating button appears only on phones and portrait tablets; on wider screens the normal row stays. Untick to always use the floating button. | on |
| `fab_side` | **Button side**: right (default) or left, e.g. for a left-handed user. Each side has its own stack of floating buttons. | right |
| `title` | Heading above the items of the floating button | "Scenes" |
| `fab_icon` | **Button icon** of the floating button | `mdi:palette-outline` |

<a id="lumen-person-card"></a>

### Person (`lumen-person-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The person | – |
| `presence_entity` | A sensor that knows best whether they are home, for example a Bluetooth tag. Without it the person's home zone is used. | none |
| `name` | Name shown | from the person |
| `picture` | Address (URL) of a photo | the person's photo |
| `avatar_color` | Background colour behind the initial when there is no photo | picked from the name |
| `presence_badge` | Short label next to the name while presence comes from `presence_entity`; empty hides it | "BLE" |
| `show_name`, `show_status` | Show the name / the "home since…" line | on |

<a id="lumen-alarm-card"></a>

### Alarm (`lumen-alarm-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The alarm panel | – |
| `name`, `icon` | Name, and an icon instead of the shield (for example a garage) | from the device |
| `banner` | Red banner when the alarm goes off | on |
| `banner_text` | Text of the banner | "Alarm: *name*!" |
| `screen_ring` | Red pulsing frame around the whole screen when the alarm goes off | on |
| `show_state` | Show the state line | on |
| `show_buttons` | Show the Arm / Disarm button on the card | on |
| `arm_modes` | Which modes the keypad offers (`armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`) | all your alarm supports |
| `arming_time`, `pending_time` | Length of the arming countdown and the entry delay in seconds, if your alarm does not report them | from the alarm |

Tip: set `tap_action` to your arm/disarm script and the card and its buttons run it instead of the keypad.

<a id="lumen-lock-card"></a>

### Lock (`lumen-lock-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The lock | – |
| `name`, `icon` | Name and icon | from the device |
| `busy_entity` | A sensor that is "on" while the lock is working (some car locks take a while). The card waits for it to finish before saying "done". | none |
| `show_state` | Show the state line | on |

<a id="lumen-entity-card"></a>

### Entity (`lumen-entity-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | Any device or sensor | – |
| `name`, `icon` | Name and icon | from the device |
| `show_name`, `show_icon`, `show_state` | Show or hide each part | on |

<a id="lumen-button-card"></a>

### Button (`lumen-button-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | What the button runs: a script, scene, button, or anything that can be switched | – |
| `name`, `icon` | Name and icon | from the device |
| `feedback` | **Wait for the device's answer** after a tap. Fill in `status_entity` (the sensor with the answer code), `success_state` (the code that means success), `message_entity` (the sensor with the error text) and `success_text` (what to show on success). | off |
| `last_used_entity` | A date-and-time helper that stores when it was last used | none |
| `secondary_info` | Second line: **Auto** (last use), state, last run, last change, or nothing | Auto |
| `show_name`, `show_icon`, `show_state` | Show or hide each part | on |

`success_state` defaults to `"200"`.

<a id="lumen-sensor-card"></a>

### Sensor (`lumen-sensor-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The sensor | – |
| `name` | Name shown | from the sensor |
| `hours` | How many hours the chart covers | 12 |
| `color` | Colour of the chart | accent colour |
| `show_name`, `show_graph` | Show the name / the chart | on |
| `height` | Card height in px. Under 48 px it becomes one line: name left, value right, chart behind (as on the Dom panel's phone layout). | 52 (compact 36) |
| `stale_after` | After how many hours without a new reading the card shows it as outdated. Empty or 0 = never (many thermometers only report when the temperature changes). | none |

<a id="lumen-climate-card"></a>

### Climate (`lumen-climate-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The air conditioner or thermostat | – |
| `name`, `icon` | Name and icon | from the device |
| `hvac_modes` | Which mode buttons to show, in this order | all the device has |
| `fan_modes` | Which fan buttons to show (more than 5 become a list), in this order | all the device has |
| `preset_modes` | Which presets to show | all the device has |
| `min_temp`, `max_temp` | Narrow the temperature range (empty = the device's own range) | the device's |
| `step` | How much − and + change the setpoint (e.g. `0.5` when the thermostat reports 0.1). The setpoint is sent 1 s after the last tap. | the device's step |
| `fab` | **Show as a floating button** in the corner | off |
| `fab_narrow_only` | **Auto: only on narrow screens**: floating button on phones, normal card on big screens | on |
| `fab_side` | **Button side**: right (default) or left, e.g. for a left-handed user. Each side has its own stack of floating buttons. | right |
| `power_action` | What the power button does, if you want your own script instead | turns on the last used mode / turns off |
| `show_current_temp`, `show_modes`, `show_fan_modes` | Show the room temperature / the mode buttons / the fan buttons | on |
| `battery_entity`, `battery_low`, `show_battery` | Low-battery badge ("Battery 9%"). By default it reads Better Thermostat's battery info on the thermostat itself (the weakest valve); or give a % sensor / battery binary sensor. Low below `battery_low` % (default 15). | on |
| `show_swing`, `show_presets`, `show_action` | Show swing / presets / the "heating, cooling, idle" badge | on |
| `show_range` | Show the device's temperature range under the target | off |

Only the modes your device really has are shown. Thermostats with a "from–to" range work too: tap the lower or upper number to choose which one **−** and **+** change.

<a id="lumen-air-quality-card"></a>

### Air quality (`lumen-air-quality-card`)

| Setting | What it does | Default |
|---|---|---|
| `pm25`, `pm10`, `aqi_entity` | Your air sensors. One of the three is enough. | – |
| `stale_hours` | After how many hours without new data the card says "Outdated data" | 2 |
| `footer` | A short note at the bottom of the chart window, for example "Sensor on the balcony" | none |
| `levels` | Your own names for the six levels (YAML only) | Very good … Extremely poor |
| `show_values`, `show_bar` | Show the numbers / the coloured level bar | on |

<a id="lumen-reminder-card"></a>

### Reminder (`lumen-reminder-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The thing to watch, for example a toggle helper "bike battery low" | – |
| `state` | The reminder is active while the device has this state | `on` |
| `name`, `icon`, `color` | Label, icon and colour (info, ok, warning, danger) of the pill | from the device, info |
| `value`, `value_entity` | Extra text on the pill; `{value}` is replaced with the number from `value_entity`, for example "Battery {value}%" | none |
| `show_chip` | Show the pill at all (off = only the pop-up window) | on |
| `dialog` | Pop up a window when the reminder starts | on |
| `title`, `message` | Heading and text of the window | the name |
| `done` | Show a **Done** button that switches the reminder off | off |
| `done_action` | Something else for **Done** to do instead | switch off |
| `alignment` | Where the pill sits: left, centre or right | left |

<a id="lumen-title-card"></a>

### Title (`lumen-title-card`)

| Setting | What it does | Default |
|---|---|---|
| `title` | The text | – |
| `heading_style` | **Overline** (small capitals), **Section title** (large) or **Room header** | Overline |
| `badges` | Values shown next to the title. Each has an `entity`, and optionally `state_content` (an attribute to show instead of the state) and `name` (a label before the value). | none |
| `entity`, `tap_action` | What tapping the title opens | nothing |

<a id="lumen-greeting-card"></a>

### Greeting (`lumen-greeting-card`)

| Setting | What it does | Default |
|---|---|---|
| `show_date` | Show today's date above the greeting | on |
| `name` | Name after the greeting | the logged-in user |
| `sun_entity` | Sun sensor used to tell morning from evening | `sun.sun` |

<a id="lumen-weather-background-card"></a>

### Weather background (`lumen-weather-background-card`)

| Setting | What it does | Default |
|---|---|---|
| `weather_entity` | Your weather forecast device | – |
| `sun_entity` | Sun sensor for day and night | `sun.sun` |
| `show_controls` | Show the three switches: weather background, weather on cards, animations. Each device remembers its own choice. | off |

<a id="lumen-cover-card"></a>

### Blinds and covers (`lumen-cover-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The blind, shutter or garage door | – |
| `name`, `icon` | Name and icon | from the device |
| `show_buttons` | The Open / Stop / Close row (Stop only if the cover can stop) | on |
| `show_tilt` | The slats bar (only for covers with tilting slats) | on |
| `show_state` | Show the state line | on |
| `tap_action`, `hold_action` | Tap and hold | open/close, details |

<a id="lumen-media-card"></a>

### Media player (`lumen-media-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The speaker or TV | – |
| `name`, `icon` | Name, and the icon shown when there is no cover art | from the device |
| `show_progress` | The progress bar (tap it to jump, if the player can) | on |
| `show_volume` | The volume slider and mute button | on |
| `show_source` | The player's name, or the last app when it is off | on |

<a id="lumen-select-card"></a>

### List (`lumen-select-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | An `input_select` or `select` | – |
| `name`, `icon` | Name and icon | from the device |
| `secondary_entity` | Another device whose state is shown as the second line, for example the vacuum's status | none |
| `tap_action`, `hold_action` | Tap and hold | open the list, details |

<a id="lumen-fan-card"></a>

### Fan (`lumen-fan-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The fan | – |
| `name`, `icon` | Name and icon | from the device |
| `icon_animation` | Spinning icon, faster at higher speed | on |
| `show_state` | Show the speed line | on |
| `tap_action`, `hold_action` | Tap and hold | on/off, details |

<a id="lumen-number-card"></a>

### Number (`lumen-number-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | An `input_number` or `number` | – |
| `name`, `icon` | Name and icon | from the device |
| `show_state` | Show the value line | on |

<a id="lumen-calendar-card"></a>

### Calendar (`lumen-calendar-card`)

| Setting | What it does | Default |
|---|---|---|
| `entity` | The calendar | – |
| `name`, `icon` | Name and icon | from the calendar |
| `days` | How many days ahead to look | 7 |
| `max_events` | At most this many events | 5 |
| `show_title` | Show the calendar's name above the list | on |

<a id="lumen-nav-card"></a>

### Navigation bar (`lumen-nav-card`)

| Setting | What it does | Default |
|---|---|---|
| `items` | The buttons. Each has a `navigation_path` (a view such as `rooms`, a path such as `/lovelace/rooms`, or a pop-up such as `#living-room`), a `name` and an `icon`. | – |
| `position` | **Bottom**: stuck to the bottom of the screen (put this card last). **Inline**: an ordinary card where you place it. | bottom |
| `narrow_only` | Show it only on phones and narrow screens | off |

<a id="lumen-popup-card"></a>

### Pop-up (`lumen-popup-card`)

| Setting | What it does | Default |
|---|---|---|
| `hash` | The link that opens it, for example `#living-room` | – |
| `name`, `icon` | Heading of the window | none |
| `cards` | The cards inside (any Home Assistant cards, edited as YAML) | – |
| `show_trigger` | Show a row on the dashboard that opens the pop-up (otherwise the card is invisible) | off |
| `auto_close` | Close by itself after this many seconds (0 = never) | 0 |

### Stacks (`lumen-vertical-stack-card`, `lumen-horizontal-stack-card`)

```yaml
type: custom:lumen-vertical-stack-card
max_width: 80
max_width_unit: "%"
cards:
  - type: custom:lumen-light-card
    entity: light.living_room
  - type: custom:lumen-horizontal-stack-card
    cards:
      - type: tile
        entity: sun.sun
      - type: custom:lumen-weather-card
        entity: weather.home
```

| Option | What it does | Default |
|---|---|---|
| `cards` | The cards inside (any Home Assistant cards, the same editor as HA's stacks); vertical – one under another, horizontal – side by side with equal widths. The cards' own visibility conditions apply. | – |
| `title` | Heading above the cards | none |
| `max_width`, `max_width_unit` | Width of the whole stack: pixels or percent of the card's grid place (or `max_width: 80%`) | full width |
| `align` | Where a narrower stack sits: `center`, `start` (left), `end` (right) | `center` |

<a id="lumen-fab-sheet-card"></a>

### Floating panel (`lumen-fab-sheet-card`)

```yaml
type: custom:lumen-fab-sheet-card
icon: mdi:radiator
title: Heating
cards:
  - type: custom:lumen-climate-card
    entity: climate.living_room
  - type: custom:lumen-climate-card
    entity: climate.bedroom
```

| Setting | What it does | Default |
|---|---|---|
| `icon`, `title` | Icon of the floating button and heading of the sheet | `mdi:dock-bottom`, "Floating panel" |
| `cards` | The cards inside (any Home Assistant cards, edited as YAML). Climate cards show as compact thermostat rows here. | – |
| `narrow_only` | The floating button only on phones and narrow screens (under 1024 px); wider, the card is a row in the grid that opens the same sheet. Off = the button on every screen. | on |
| `fab_side` | **Button side**: right (default) or left, e.g. for a left-handed user. Each side has its own stack of floating buttons. | right |
| `badge_entities` | What the number on the button counts. Empty = the cards' thermostats that are heating; otherwise these entities when heating / on. | empty |
| `color_scheme`, `accent_color`, `styles` | As on every card | – |

The button joins the stack of floating buttons: above the scenes button (48 px), or on its own place in the corner (64 px) when it is the only one. Order from the bottom: scenes, panels (in the dashboard's order), alarm. The warning corner shows a battery below the thermostat card's `battery_low` (15 % by default) or an offline entity. While the dashboard is edited the card is always the row, marked "FAB on phones".

<a id="lumen-weather-card"></a>

### Weather (`lumen-weather-card`)

```yaml
type: custom:lumen-weather-card
entity: weather.home
warnings_entity: sensor.weather_warnings   # optional
```

| Setting | What it does | Default |
|---|---|---|
| `entity` | The weather entity (`weather.*`). Hourly and daily forecasts are used when the integration provides them. | – |
| `warnings_entity` | Optional sensor with a `warnings` list attribute (IMGW-PIB Monitor and similar: `event`, `level` 1–3, `valid_from`, `valid_to`, `content`). Warnings that are on now or start within 24 h show as pills on the card and as bars in the sheet. | – |
| `layout` | **Auto** (a line when the card is narrower than 240 px, the card from 240 px), **Line**, **Card** or **Icon and temperature only** (no background, for next to the greeting) | auto |
| `hours` | **Hours on the card**: 4–8. The card shows only as many as fit at 44 px or more. | 6 |
| `show_feels`, `show_minmax`, `show_hours`, `show_warnings` | Feels-like temperature, today's low / high, the row of hours and the warnings on the card | on |
| `sun_entity` | Day / night icons now | `sun.sun` |
| `color_scheme`, `accent_color`, `max_width`, `max_width_unit`, `weather_effects`, `styles` | As on every card | – |

Tap opens the details sheet, hold opens Home Assistant's own weather dialog. Sunrise and sunset in the sheet are calculated from the location of your Home Assistant.

---

## Questions and problems

**I installed it but can't find the cards.**
Refresh the browser with Ctrl+F5 (Cmd+Shift+R on a Mac). In the phone app, use **Settings → Companion app → Debugging → Reset frontend cache**. Then search for "Lumen" when adding a card.

**I see "Custom element doesn't exist: lumen-…".**
Same fix: refresh the browser. If it is still there, check **Settings → Dashboards → ⋮ → Resources**. There should be one entry ending in `lumen-cards.js`.

**There is no rain or snow on my dashboard.**
Add the **Weather background** card to the same view (one per view is enough), and choose your weather device in it. Some old tablets turn effects off to save power. Turn on `show_controls` to see the switches.

**The cards look different on my phone and on my tablet.**
That's on purpose: a small card shows its compact look. To decide exactly what appears where, see the tip under [Example dashboards](#example-dashboards) (two copies plus the **Screen** visibility condition). You can also set `layout` to **Full** or **Compact** to stop the automatic switching.

**My air conditioner's floating button covers something.**
Two floating buttons stack on top of each other automatically. To move them up, for example above a bottom navigation bar, add `lumen-cards-fab-bottom: 90px` to your Home Assistant theme.

**Can I change the colours?**
Yes: `accent_color` and `glow_color` on each card, or for all cards at once with `lumen-cards-accent` and `lumen-cards-glow-color` in a Home Assistant theme.

**Can I use it with a keyboard?**
Yes. Tab moves between cards. Enter or Space taps. Shift+Enter holds (for example to open the light panel). The arrow keys change brightness, and Escape closes windows.

---

## For developers

```sh
npm install
npm run dev     # demo with made-up devices: http://localhost:5174/dev/index.html
npm test
npm run build   # → dist/
```

Demo options: `?compact`, `&dark`, `&lang=pl`, `&fx` (weather), `&weather=snowy`, `&scene=phone|desktop`, `&only=<card>` (e.g. `fab-sheet`, `compact-row`), `&edit` (edit mode). Texts live in `src/translations/en.json` and `pl.json`. To add a language, add a file and register it in `src/core/i18n.ts`.

## License

MIT. Fonts: Manrope and IBM Plex Mono (SIL Open Font License), via Fontsource.
