// Sections of the catalog page (dev/catalog.ts): every Lumen card with its variants on the demo
// home of mock-hass.ts. Texts in Polish, the language of the page.

export interface Variant {
  /** Tab label. */
  label: string;
  /** Card config without `type` (the section's card). */
  config: Record<string, unknown>;
  /** Width in the 12-column preview grid (default 12). */
  span?: number;
  /** Short note under the preview: what to try. */
  hint?: string;
}

export interface Section {
  id: string;
  /** Card name in the catalog. */
  name: string;
  /** `lumen-<card>-card`. */
  card: string;
  group: string;
  lead: string;
  variants: Variant[];
}

const reminder = { entity: "input_boolean.bike_battery", name: "Rower", icon: "mdi:bicycle-electric", color: "danger", value: "Bateria {value}%", value_entity: "sensor.bike_battery", title: "Naładuj rower", message: "Bateria spadła poniżej 20 %." };
const purifierFull = {
  entity: "fan.air_purifier",
  name: "Oczyszczacz",
  speeds: [{ percentage: 20, name: "Cichy" }, { percentage: 40, name: "1" }, { percentage: 60, name: "2" }, { percentage: 80, name: "3" }, { percentage: 100, name: "Turbo" }],
  humidity_targets: [40, 50, 60],
  target_humidity_service: { service: "demo_purifier.set_target_humidity", field: "humidity" },
  humidifier_when: { attribute: "function", contains: "Humidification" },
  index: { name: "Alergeny", entity: "sensor.air_purifier_allergens", thresholds: [3, 6, 9], labels: ["Dobry", "Średni", "Słaby", "Bardzo słaby"], max: 12 },
  filters: [{ name: "Wstępny", attribute: "pre_filter", unit: "h" }, { name: "HEPA", attribute: "hepa_filter", unit: "h" }, { name: "Węglowy", attribute: "carbon_filter", unit: "h" }, { name: "Knot", attribute: "wick_filter", unit: "h" }],
  controls: [
    { name: "Wyłącznik czasowy", attribute: "timer", service: "demo_purifier.set_timer", field: "hours", min: 0, max: 12, min_label: "Wył." },
    { name: "Jasność panelu", attribute: "light_brightness", service: "demo_purifier.set_light_brightness", field: "level", options: [0, 25, 50, 75, 100] },
    { name: "Podświetlenie wyświetlacza", attribute: "display_light", service: "demo_purifier.set_display_light", field: "light" },
    { name: "Blokada rodzicielska", attribute: "child_lock", service: "demo_purifier.set_child_lock", field: "lock" },
  ],
};
const thermostats = ["th_living", "th_bedroom", "th_bathroom"].map((id) => ({ type: "custom:lumen-climate-card", entity: `climate.${id}` }));

export const SECTIONS: Section[] = [
  {
    id: "swiatlo",
    name: "Światło",
    card: "light",
    group: "Oświetlenie",
    lead: "Kafel żarówki: przeciągnięcie w bok ustawia jasność, dotknięcie włącza, ikona otwiera barwę i kolor.",
    variants: [
      { label: "Ściemniana", config: { entity: "light.sofa", icon: "mdi:sofa" }, span: 6, hint: "Przeciągnij w bok, żeby zmienić jasność. Dotknij ikony, żeby wybrać barwę." },
      { label: "Kolorowa", config: { entity: "light.strip", icon: "mdi:led-strip-variant" }, span: 6, hint: "Ikona otwiera koło barw." },
      { label: "Wyłączona", config: { entity: "light.ceiling", icon: "mdi:ceiling-light" }, span: 6 },
      { label: "Grupa", config: { entity: "light.kitchen_all", icon: "mdi:lightbulb-group" }, span: 6 },
      { label: "Dwa kinkiety", config: { entity: "light.sconces", name: "Kinkiety", icon: "mdi:wall-sconce-flat", power_entities: ["switch.sconce_1", "switch.sconce_2"], sub_buttons: [{ entity: "switch.sconce_1", name: "Kinkiet 1", icon: "mdi:wall-sconce-flat" }, { entity: "switch.sconce_2", name: "Kinkiet 2", icon: "mdi:wall-sconce-flat" }] }, hint: "Dwa małe przyciski włączają każdy kinkiet osobno. Gdy świeci choć jeden, przesuń po karcie, żeby zmienić jasność obu. Dotknięcie karty nic nie robi." },
      { label: "Mała", config: { entity: "light.sofa", icon: "mdi:sofa", layout: "compact" }, span: 4 },
      { label: "Niedostępna", config: { entity: "light.bedroom" }, span: 6 },
    ],
  },
  {
    id: "chipy",
    name: "Chipy",
    card: "chips",
    group: "Oświetlenie",
    lead: "Rząd pigułek: sceny, skrypty i światła jednym dotknięciem. Na telefonie sceny mogą zejść do pływającego przycisku.",
    variants: [
      { label: "Sceny", config: { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }] } },
      { label: "Światła", config: { chips: [{ type: "light", entity: "light.kitchen", name: "Kuchnia" }, { type: "light", entity: "light.strip", name: "Taśma" }, { type: "light", entity: "light.ceiling", name: "Sufit" }] }, hint: "Przytrzymaj chip światła, żeby ustawić jasność." },
      { label: "Wyśrodkowane", config: { alignment: "center", chips: [{ type: "action", entity: "scene.movie" }, { type: "light", entity: "light.sofa", name: "Sofa" }] } },
    ],
  },
  {
    id: "osoba",
    name: "Osoba",
    card: "person",
    group: "Dom",
    lead: "Domownik z awatarem, kropką obecności i czasem od ostatniej zmiany.",
    variants: [
      { label: "W domu", config: { entity: "person.alex", avatar_color: "light-blue" }, span: 6 },
      { label: "Poza domem", config: { entity: "person.sam", avatar_color: "amber" }, span: 6 },
      { label: "Z obecnością BLE", config: { entity: "person.zoe", presence_entity: "binary_sensor.zoe_ble" }, span: 6 },
      { label: "Mała", config: { entity: "person.alex", avatar_color: "light-blue", layout: "compact" }, span: 6 },
    ],
  },
  {
    id: "alarm",
    name: "Alarm",
    card: "alarm",
    group: "Bezpieczeństwo",
    lead: "Stan alarmu w jednym spojrzeniu. Uzbrój otwiera klawiaturę z wyborem trybu, kod demo to 1234.",
    variants: [
      { label: "Rozbrojony", config: { entity: "alarm_control_panel.demo" }, hint: "Uzbrój, kod 1234. Po 10 s alarm przechodzi z uzbrajania w uzbrojony." },
      { label: "Uzbrajanie", config: { entity: "alarm_control_panel.arming", screen_ring: false, banner: false } },
      { label: "Wzbudzony", config: { entity: "alarm_control_panel.triggered", screen_ring: false, banner: false } },
      { label: "Mała", config: { entity: "alarm_control_panel.home_mode", layout: "compact" }, span: 4 },
    ],
  },
  {
    id: "zamek",
    name: "Zamek",
    card: "lock",
    group: "Bezpieczeństwo",
    lead: "Zamek z przyciskami Zablokuj / Odblokuj; z kodem pyta o niego klawiaturą. Kod demo: 1234.",
    variants: [
      { label: "Z kodem", config: { entity: "lock.demo" }, hint: "Odblokuj i wpisz 1234." },
      { label: "Odblokowany", config: { entity: "lock.unlocked" } },
      { label: "Zacięty", config: { entity: "lock.jammed" } },
      { label: "Mała", config: { entity: "lock.car", icon: "mdi:car", layout: "compact" }, span: 4, hint: "Dotknij: okno z poleceniami." },
    ],
  },
  {
    id: "encja",
    name: "Encja",
    card: "entity",
    group: "Dom",
    lead: "Stan dowolnej encji: drzwi, okna, gniazdka, z małymi przyciskami po prawej.",
    variants: [
      { label: "Drzwi", config: { entity: "binary_sensor.back_door" }, span: 6 },
      { label: "Gniazdko", config: { entity: "switch.coffee" }, span: 6, hint: "Dotknij, żeby przełączyć." },
      { label: "Z przyciskami", config: { entity: "fan.purifier", sub_buttons: [{ entity: "input_boolean.purifier_night" }, { entity: "fan.purifier", icon: "mdi:power" }] } },
      { label: "Mała", config: { entity: "binary_sensor.front_door", layout: "compact" }, span: 3 },
    ],
  },
  {
    id: "przycisk",
    name: "Przycisk",
    card: "button",
    group: "Dom",
    lead: "Skrypt, scena albo przycisk, z opcjonalnym odczytem wyniku z czujnika (brama: co trzecie naciśnięcie się nie udaje).",
    variants: [
      { label: "Z odpowiedzią", config: { entity: "script.gate", icon: "mdi:gate", feedback: { status_entity: "sensor.gate_status", message_entity: "sensor.gate_message", success_text: "Otwarta" } }, hint: "Naciśnij kilka razy: trzecie naciśnięcie kończy się błędem." },
      { label: "Kolor", config: { entity: "script.barrier", color: "var(--lumen-info)" }, span: 6 },
      { label: "Mała", config: { entity: "script.gate", icon: "mdi:gate", layout: "compact" }, span: 3 },
    ],
  },
  {
    id: "sensor",
    name: "Sensor",
    card: "sensor",
    group: "Klimat",
    lead: "Wartość z wykresem ostatnich godzin. Niska wysokość daje jedną linijkę nad przygaszonym wykresem.",
    variants: [
      { label: "Temperatura", config: { entity: "sensor.living_temp" }, span: 6 },
      { label: "Kolor", config: { entity: "sensor.outside_temp", color: "light-blue" }, span: 6 },
      { label: "Niski", config: { entity: "sensor.living_temp", height: 36 }, span: 6 },
      { label: "Brak danych", config: { entity: "sensor.cellar" }, span: 6 },
    ],
  },
  {
    id: "jakosc-powietrza",
    name: "Jakość powietrza",
    card: "air-quality",
    group: "Klimat",
    lead: "Sześć poziomów PM2.5 / PM10 / AQI z paskiem; dotknięcie otwiera wykresy z całej doby.",
    variants: [
      { label: "PM2.5 + PM10", config: { pm25: "sensor.pm25", pm10: "sensor.pm10" }, hint: "Dotknij karty: wykresy 24 h." },
      { label: "Mała", config: { pm25: "sensor.pm25", pm10: "sensor.pm10", layout: "compact" } },
      { label: "AQI", config: { aqi_entity: "sensor.aqi" } },
    ],
  },
  {
    id: "klimatyzacja",
    name: "Klimatyzacja",
    card: "climate",
    group: "Klimat",
    lead: "Temperatura, tryby i nawiew. Zmiana temperatury idzie do urządzenia 0,8 s po ostatnim dotknięciu.",
    variants: [
      { label: "Klimatyzator", config: { entity: "climate.bedroom_ac", fan_modes: ["auto", "low", "medium", "high"] } },
      { label: "Zakres", config: { entity: "climate.heat_cool" } },
      { label: "Grzejnik", config: { entity: "climate.radiator" } },
      { label: "Wiersz", config: { entity: "climate.th_bathroom", layout: "compact" }, hint: "Ikona włącza i wyłącza, − / + zmienia temperaturę." },
    ],
  },
  {
    id: "pogoda",
    name: "Pogoda",
    card: "weather",
    group: "Klimat",
    lead: "Linijka, ikona albo karta z prognozą godzinową; dotknięcie otwiera pełną prognozę i ostrzeżenia.",
    variants: [
      { label: "Karta", config: { entity: "weather.home", warnings_entity: "sensor.weather_warnings", layout: "wide" }, hint: "Dotknij karty: prognoza godzinowa i na 7 dni." },
      { label: "Linijka", config: { entity: "weather.home", warnings_entity: "sensor.weather_warnings", layout: "compact" } },
      { label: "Ikona", config: { entity: "weather.home", layout: "icon" }, span: 4 },
    ],
  },
  {
    id: "przypomnienie",
    name: "Przypomnienie",
    card: "reminder",
    group: "Dom",
    lead: "Pigułka, gdy coś wymaga uwagi, i okno z przyciskami Przypomnij później / Gotowe.",
    variants: [
      { label: "Pigułka", config: { entity: "input_boolean.laundry", icon: "mdi:washing-machine", color: "ok", value: "{value} min", value_entity: "sensor.laundry_min", dialog: false } },
      { label: "Z oknem", config: reminder, hint: "Okno wyskakuje samo, gdy przypomnienie się włącza; potem otwiera je dotknięcie pigułki." },
      { label: "Ostrzeżenie", config: { entity: "input_boolean.window", icon: "mdi:window-open-variant", color: "warning", value: "{value} min", value_entity: "sensor.window_min", alignment: "center", dialog: false } },
    ],
  },
  {
    id: "rolety",
    name: "Rolety",
    card: "cover",
    group: "Dom",
    lead: "Roleta albo brama: przeciągnięcie ustawia położenie, przyciski otwierają i zamykają, żaluzje mają też kąt lameli.",
    variants: [
      { label: "Roleta", config: { entity: "cover.living_room" }, hint: "Przeciągnij w bok albo użyj przycisków." },
      { label: "Żaluzja", config: { entity: "cover.office_blind" } },
      { label: "Niedostępna", config: { entity: "cover.kitchen" } },
    ],
  },
  {
    id: "odtwarzacz",
    name: "Odtwarzacz",
    card: "media",
    group: "Rozrywka",
    lead: "Okładka, tytuł, postęp, głośność i sterowanie odtwarzaczem.",
    variants: [
      { label: "Gra", config: { entity: "media_player.living_room" }, hint: "Pauza, następny utwór, głośność." },
      { label: "Wyłączony", config: { entity: "media_player.kitchen" } },
      { label: "Mała", config: { entity: "media_player.living_room", layout: "compact" } },
    ],
  },
  {
    id: "lista-wyboru",
    name: "Lista wyboru",
    card: "select",
    group: "Dom",
    lead: "Opcje input_select / select jako lista rozwijana, z drugą encją pod spodem.",
    variants: [{ label: "Odkurzacz", config: { entity: "input_select.vacuum_mode", secondary_entity: "sensor.vacuum_status" }, hint: "Dotknij, żeby wybrać tryb." }],
  },
  {
    id: "oczyszczacz",
    name: "Oczyszczacz powietrza",
    card: "purifier",
    group: "Klimat",
    lead: "Oczyszczacz na dowolnej encji fan: tryby i prędkość z urządzenia, reszta tylko gdy ją ma.",
    variants: [
      { label: "Z nawilżaniem", config: purifierFull, hint: "Zmień tryb albo prędkość. Dotknij bloku PM2.5, żeby otworzyć wykresy i sterowanie." },
      { label: "Samo fan", config: { entity: "fan.simple_purifier" }, hint: "Bez konfiguracji: tryby i trzy prędkości wynikają z urządzenia. Zła jakość powietrza barwi kartę." },
      { label: "Alarmy", config: { entity: "fan.old_filter_purifier" }, hint: "Mało wody i filtr do wymiany, z atrybutów urządzenia." },
      { label: "Mała", config: { entity: "fan.air_purifier", name: "Oczyszczacz", layout: "compact" }, span: 8 },
      { label: "Niedostępny", config: { entity: "fan.gone_purifier" } },
    ],
  },
  {
    id: "wentylator",
    name: "Wentylator",
    card: "fan",
    group: "Klimat",
    lead: "Prędkość wentylatora suwakiem.",
    variants: [{ label: "Wentylator", config: { entity: "fan.bedroom" }, span: 6 }],
  },
  {
    id: "liczba",
    name: "Liczba",
    card: "number",
    group: "Dom",
    lead: "input_number / number jako suwak z jednostką.",
    variants: [
      { label: "Procent", config: { entity: "input_number.humidity_threshold" }, span: 6 },
      { label: "Skala", config: { entity: "number.doorbell_volume" }, span: 6 },
    ],
  },
  {
    id: "kalendarz",
    name: "Kalendarz",
    card: "calendar",
    group: "Dom",
    lead: "Najbliższe wydarzenia pogrupowane po dniach.",
    variants: [{ label: "Tydzień", config: { entity: "calendar.home" } }],
  },
  {
    id: "tytul",
    name: "Tytuł",
    card: "title",
    group: "Układ",
    lead: "Nagłówek sekcji albo pokoju, z temperaturą i stanem obok.",
    variants: [
      { label: "Sekcja", config: { title: "Bezpieczeństwo" } },
      { label: "Pokój", config: { title: "Salon", heading_style: "section", badges: ["sensor.living_temp"] } },
      { label: "Mały pokój", config: { title: "Kuchnia", heading_style: "room", badges: ["sensor.living_temp"] } },
    ],
  },
  {
    id: "powitanie",
    name: "Powitanie",
    card: "greeting",
    group: "Układ",
    lead: "Powitanie według pory dnia z imieniem i datą.",
    variants: [
      { label: "Pełne", config: {} },
      { label: "Mała", config: { layout: "compact" } },
    ],
  },
  {
    id: "stosy",
    name: "Stosy",
    card: "vertical-stack",
    group: "Układ",
    lead: "Stos pionowy i poziomy z jedną maksymalną szerokością (px albo %) dla całej grupy kart.",
    variants: [
      { label: "Pionowy 70 %", config: { max_width: 70, max_width_unit: "%", title: "Salon", cards: [{ type: "custom:lumen-light-card", entity: "light.sofa", icon: "mdi:sofa" }, { type: "custom:lumen-horizontal-stack-card", cards: [{ type: "custom:lumen-sensor-card", entity: "sensor.living_temp" }, { type: "custom:lumen-sensor-card", entity: "sensor.outside_temp", color: "light-blue" }] }] } },
      { label: "Poziomy", config: { cards: [{ type: "custom:lumen-person-card", entity: "person.alex", layout: "compact" }, { type: "custom:lumen-person-card", entity: "person.sam", layout: "compact" }] } },
    ],
  },
  {
    id: "pasek",
    name: "Pasek",
    card: "bar",
    group: "Układ",
    lead: "Pasek dostępu: drzwi, alarmy, zamki i przyciski jako kafelki w jednej szklanej ramce.",
    variants: [
      { label: "Dostęp", config: { cards: [{ type: "custom:lumen-entity-card", entity: "binary_sensor.front_door" }, { type: "custom:lumen-entity-card", entity: "binary_sensor.back_door" }, { type: "custom:lumen-alarm-card", entity: "alarm_control_panel.house" }, { type: "custom:lumen-lock-card", entity: "lock.car", icon: "mdi:car" }] } },
    ],
  },
  {
    id: "pop-up",
    name: "Pop-up",
    card: "popup",
    group: "Układ",
    lead: "Okno z dowolnymi kartami otwierane linkiem #salon. Tu z wierszem, który je otwiera.",
    variants: [
      {
        label: "Salon",
        config: { hash: "#salon", name: "Salon", icon: "mdi:sofa-outline", show_trigger: true, cards: [{ type: "custom:lumen-light-card", entity: "light.sofa", icon: "mdi:sofa" }, { type: "custom:lumen-cover-card", entity: "cover.living_room", show_buttons: false }, { type: "custom:lumen-media-card", entity: "media_player.living_room", layout: "compact" }] },
        hint: "Dotknij wiersza.",
      },
    ],
  },
  {
    id: "plywajacy-panel",
    name: "Pływający panel",
    card: "fab-sheet",
    group: "Układ",
    lead: "Na telefonie pływający przycisk, szerzej wiersz; oba otwierają arkusz z kartami, np. wszystkimi termostatami.",
    variants: [{ label: "Ogrzewanie", config: { title: "Ogrzewanie", icon: "mdi:radiator", cards: thermostats }, hint: "Na tej stronie widać podgląd. Na Twoim telefonie to okrągły przycisk w rogu ekranu, na komputerze wiersz, który otwiera arkusz." }],
  },
  {
    id: "odstep",
    name: "Odstęp",
    card: "spacer",
    group: "Układ",
    lead: "Puste miejsce pod ostatnią kartą, żeby dało się ją przewinąć ponad pływające przyciski.",
    variants: [
      { label: "Nad przyciski", config: {}, hint: "Sam dopasowuje wysokość do pływających przycisków na ekranie. Bez przycisków nie zajmuje miejsca." },
      { label: "Własna wysokość", config: { height: 100 } },
    ],
  },
  {
    id: "pasek-nawigacji",
    name: "Pasek nawigacji",
    card: "nav",
    group: "Układ",
    lead: "Przyciski widoków dashboardu, w siatce albo przyklejone do dołu ekranu.",
    variants: [
      {
        label: "W siatce",
        config: { position: "inline", items: [{ navigation_path: "#dom", name: "Dom", icon: "mdi:home-variant" }, { navigation_path: "#pokoje", name: "Pokoje", icon: "mdi:sofa-outline" }, { navigation_path: "#klimat", name: "Klimat", icon: "mdi:thermometer" }, { navigation_path: "#kamery", name: "Kamery", icon: "mdi:cctv" }] },
      },
    ],
  },
];
