# Lumen Cards

**Ładne, „szklane” karty do dashboardu Home Assistant. Każdą kartę ustawisz klikając, bez pisania kodu.**

[English](README.md)

<p align="center">
  <img src="docs/images/dashboard-desktop.jpg" alt="Dashboard na tablet / komputer zbudowany z Lumen Cards" width="820"><br>
  <img src="docs/images/dashboard-phone.jpg" alt="Ten sam dom na telefonie" width="260">
  <img src="docs/images/dashboard-phone-dark.jpg" alt="Dashboard na telefonie w trybie ciemnym, w nocy" width="260">
</p>

Co dostajesz:

- **Karty na codzienne sprawy w domu:** światła, domownicy, alarm, zamki, drzwi, brama, temperatury, jakość powietrza, klimatyzacja i przypomnienia.
- **Pogoda na dashboardzie.** Za kartami pada deszcz, sypie śnieg, snuje się mgła albo świeci słońce, a krople i śnieg osiadają też na samych kartach.
- **Duże, wygodne przyciski.** Światło włączasz dotknięciem, ściemniasz przesuwając po nim palcem, a przytrzymanie otwiera jasność i kolor.
- **Telefon i duży ekran.** Karta wciśnięta w małe miejsce sama zamienia się w mały kwadratowy przycisk.
- **Tryb jasny i ciemny.** Karty dopasowują się do ustawień Home Assistant.
- **Po polsku i po angielsku.** Język kart i ich ustawień jest brany z Twojego profilu w Home Assistant.

---

## Spis treści

1. [Instalacja](#instalacja)
2. [Pierwsza karta](#pierwsza-karta)
3. [Karty](#karty)
4. [Przykładowe dashboardy](#przykładowe-dashboardy)
5. [Ustawienia kart](#ustawienia-kart)
6. [Pytania i problemy](#pytania-i-problemy)
7. [Dla programistów](#dla-programistów)

---

## Instalacja

Potrzebujesz **Home Assistant 2026.6 lub nowszego** i **[HACS](https://hacs.xyz/)**, czyli sklepu z dodatkami społeczności.

1. Otwórz **HACS** w bocznym menu Home Assistant.
2. Kliknij menu **⋮** w prawym górnym rogu i wybierz **Custom repositories**.
3. Wklej `https://github.com/dkej123/lumen-cards`, wybierz typ **Dashboard** i kliknij **Add**.
4. Wyszukaj w HACS **Lumen Cards**, otwórz i kliknij **Download**.
5. **Odśwież przeglądarkę**: na komputerze Ctrl+F5 (na Macu Cmd+Shift+R). W aplikacji na telefonie wejdź w **Ustawienia → Aplikacja towarzysząca → Debugowanie → Zresetuj pamięć podręczną interfejsu**.

To wszystko. HACS sam zgłosi Home Assistantowi nowe karty.

<details>
<summary>Instalacja bez HACS</summary>

1. Pobierz najnowsze wydanie ze strony Releases albo pliki z folderu `dist/`: `lumen-cards.js` i wszystkie pliki czcionek `.woff2`.
2. Skopiuj je do folderu `config/www/lumen-cards/` w Home Assistant.
3. Wejdź w **Ustawienia → Dashboardy → ⋮ → Zasoby → Dodaj zasób**, wpisz `/local/lumen-cards/lumen-cards.js` i wybierz **Moduł JavaScript**.
4. Odśwież przeglądarkę.
</details>

## Pierwsza karta

1. Otwórz dashboard i kliknij **ołówek** w prawym górnym rogu, żeby przejść do edycji.
2. Kliknij **+ Dodaj kartę**.
3. Wpisz **Lumen** w wyszukiwarkę. Zobaczysz wszystkie karty Lumen z podglądem na żywo.
   Możesz też wejść w zakładkę **Według encji** i wybrać urządzenie, np. światło. Lumen podpowie pasującą kartę.
4. Wybierz kartę. Otworzy się okno ustawień. W pierwszym polu wybierz swoje urządzenie, a podgląd od razu się zmieni.
5. Kliknij **Zapisz**.

Każde ustawienie ma swoje pole w tym oknie. Kodu nie trzeba pisać nigdy.

> **Wskazówka:** żeby powiększyć albo zmniejszyć kartę, w trybie edycji przeciągnij jej róg. Wąska karta sama przełączy się na wersję kompaktową.

---

## Karty

### Światło

<img src="docs/images/light.png" alt="Karty świateł: włączone i wyłączone" width="480"><br>
<img src="docs/images/light-color.png" alt="Kolorowa taśma LED i białe światło w kuchni" width="480"><br>
<img src="docs/images/light-dark.png" alt="Karty świateł w trybie ciemnym" width="480">

Duży kafel jednego światła, który świeci kolorem żarówki.

- **Dotknięcie** włącza i wyłącza.
- **Przesunięcie palcem** w lewo lub w prawo ściemnia i rozjaśnia.
- **Kółko** po prawej zmienia biel na cieplejszą lub chłodniejszą.
- **Przytrzymanie** otwiera pełne sterowanie: jasność, barwę bieli, a w kolorowych żarówkach także kolory.

<img src="docs/images/light-sheet.png" alt="Panel jasności i barwy" width="260">

### Chipy

<img src="docs/images/chips.png" alt="Chipy scen i pigułki świateł" width="480">

Rząd małych okrągłych przycisków. Są dwa rodzaje:

- **Akcja:** jednym dotknięciem uruchamia scenę, skrypt albo przycisk, np. „Film” czy „Wieczór”.
- **Światło:** mała pigułka światła, działa tak samo jak karta światła.

Na telefonie akcje mogą zamienić się w **pływający przycisk** w rogu ekranu (zdjęcie przy [Klimatyzacji](#klimatyzacja)).

### Osoba

<img src="docs/images/person.png" alt="Dwie osoby: w domu i poza domem" width="480">

Domownik: zdjęcie (albo pierwsza litera imienia), **zielona kropka, gdy jest w domu**, i od kiedy jest w domu albo poza nim. Gdy jest poza domem, karta pokazuje też gdzie, np. „Praca”.

### Alarm

<img src="docs/images/alarm.png" alt="Alarm uzbrojony i rozbrojony" width="480">

Stan alarmu w jednym spojrzeniu: zielony, gdy uzbrojony, czerwony, gdy rozbrojony. Kiedy alarm się włączy, pojawia się czerwony baner, a cały ekran pulsuje na czerwono:

<img src="docs/images/alarm-triggered.png" alt="Wzbudzony alarm" width="480">

Sam decydujesz, co robi dotknięcie, np. uruchamia Twój skrypt „uzbrój / rozbrój”.

### Zamek

<img src="docs/images/lock.png" alt="Zamek auta i zamek drzwi" width="480">

Czy zamek jest zamknięty, z przyciskami **Zablokuj** i **Odblokuj** (oraz **Otwórz**, jeśli zamek umie otworzyć drzwi). Jeśli zamek wymaga PIN-u, najpierw pokaże się pole na kod:

<img src="docs/images/lock-code.png" alt="Wpisywanie kodu zamka" width="260">

### Encja (drzwi, okno…)

<img src="docs/images/entity.png" alt="Drzwi wejściowe zamknięte, tylne otwarte" width="480">

Mały kafel dla czegokolwiek, co ma stan. Drzwi i okna robią się **czerwone, gdy są otwarte**. Na telefonie karta może być małym kwadratowym przyciskiem.

### Przycisk

<img src="docs/images/button.png" alt="Przycisk bramy z dodatkowym przyciskiem światła" width="480">

Jednym dotknięciem coś uruchamia: skrypt, scenę albo przycisk. Potrafi też **poczekać na odpowiedź** urządzenia, np. bramy, która zgłasza, czy naprawdę się otworzyła. Wtedy pokaże „Otwarto bramę” albo treść błędu.

Mały okrągły przycisk po prawej to **dodatkowy przycisk** (`sub_buttons`). Możesz dodać takie do kilku kart, np. żeby zapalić światło obok.

### Sensor

<img src="docs/images/sensor.png" alt="Dwa sensory temperatury z wykresami" width="480">

Temperatura (albo dowolna inna liczba) z małym wykresem z ostatnich godzin w tle. Dotknięcie pokazuje pełną historię.

### Klimatyzacja

<img src="docs/images/climate.png" alt="Karta klimatyzacji" width="480">

Klimatyzator albo termostat: temperatura docelowa z przyciskami **−** i **+**, tryb (wył. / grzanie / chłodzenie) i nadmuch.

Na telefonie karta może zmienić się w **pływający okrągły przycisk** z temperaturą. Dotknięcie otwiera sterowanie, a przytrzymanie włącza lub wyłącza urządzenie:

<img src="docs/images/climate-fab.png" alt="Pływające przyciski scen i klimatyzacji" width="260">
<img src="docs/images/climate-dialog.png" alt="Sterowanie klimatyzacją na telefonie" width="260">

### Jakość powietrza

<img src="docs/images/air-quality.png" alt="Jakość powietrza: dobra" width="480">

Zamienia PM2.5 / PM10 (albo czujnik AQI) na sześć prostych poziomów, od „Bardzo dobra” do „Bardzo zła”, według Europejskiego Indeksu Jakości Powietrza. Dotknięcie pokazuje wykres z 24 godzin. Gdy czujnik przestanie wysyłać dane, karta dostaje przerywaną ramkę i napis „Nieaktualne dane”.

### Przypomnienie

<img src="docs/images/reminder.png" alt="Pigułka przypomnienia" width="480">

Mała pigułka, która pojawia się **tylko wtedy, gdy coś wymaga uwagi**, np. „Rower – bateria 18%”. Może też wyskoczyć okienko w chwili startu i potem przy każdym otwarciu dashboardu, aż dotkniesz **Gotowe**:

<img src="docs/images/reminder-dialog.png" alt="Okno przypomnienia" width="260">

### Tytuł

<img src="docs/images/title.png" alt="Trzy style tytułu" width="480">

Nagłówki dzielące dashboard na części, w trzech stylach: mały napis wersalikami, duży tytuł sekcji albo nagłówek pokoju. Obok nagłówka mogą być wartości, np. temperatura w pokoju.

### Powitanie

<img src="docs/images/greeting.png" alt="Powitanie" width="480">

„Dzień dobry” albo „Dobry wieczór” z imieniem zalogowanej osoby i dzisiejszą datą.

### Tło pogodowe

<img src="docs/images/weather-rainy.jpg" alt="Deszcz za kartami i na kartach" width="480">
<img src="docs/images/weather-snowy-dark.jpg" alt="Śnieg w nocy, tryb ciemny" width="480">

Dodaj tę kartę **raz na każdy widok dashboardu**, a niebo za kartami będzie pokazywać prawdziwą pogodę: słońce, chmury, deszcz, śnieg, mgłę, wiatr i burzę, w dzień i w nocy. Krople i śnieg pojawiają się też na innych kartach Lumen.

Sama karta nie zajmuje miejsca. Jeśli chcesz, może pokazać trzy przełączniki, żeby każde urządzenie decydowało za siebie: tło, pogoda na kartach i animacje. Przydaje się na starym tablecie.

---

## Przykładowe dashboardy

To te dwa dashboardy z góry strony. Żeby użyć jednego z nich:

1. Utwórz nowy dashboard: **Ustawienia → Dashboardy → + Dodaj dashboard → Nowy dashboard od zera**.
2. Otwórz go, kliknij **ołówek**, potem **⋮ → Edytor konfiguracji w trybie surowym**.
3. Usuń wszystko, wklej przykład i kliknij **Zapisz**.
4. **Zamień przykładowe urządzenia na swoje.** Na przykład `light.sofa` zmień na nazwę swojego światła. Możesz to też zrobić później, karta po karcie, ołówkiem.

<details>
<summary><b>Dashboard na telefon</b> (jedna kolumna)</summary>

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
          # cztery małe kwadratowe przyciski w jednym rzędzie
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
          # te dwie karty stają się pływającymi przyciskami w rogu
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
<summary><b>Dashboard na tablet / komputer</b> (trzy kolumny)</summary>

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

> **Jeden dashboard na telefon i tablet?** Tak. Dodaj kartę dwa razy: raz małą (np. na 3 kolumny), widoczną tylko na telefonie, i raz dużą, widoczną tylko na dużym ekranie. W edytorze karty otwórz zakładkę **Widoczność** → **Dodaj warunek** → **Ekran** i zaznacz rozmiary ekranu. Home Assistant sam ukryje drugą kopię.

---

## Ustawienia kart

Wszystko to zmienisz w edytorze karty. Nazwy zapisane `takim krojem` to nazwy w YAML, gdybyś tam zajrzał.

### Ustawienia każdej karty

Znajdziesz je w sekcjach **Wygląd** i **Zaawansowane** na dole edytora.

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `layout` | **Auto** sam wybiera wygląd: kompaktowy, gdy karta jest mała. **Pełny** albo **Kompaktowy** wymusza jeden wygląd. | Auto |
| `color_scheme` | Karta jasna albo ciemna, albo **Auto**, czyli jak w Home Assistant | Auto |
| `accent_color` | Kolor przycisków i wyróżnień | z motywu |
| `glow_color` | Kolor poświaty włączonych świateł (karty światła i chipów) | kolor światła |
| `weather_effects` | Krople, śnieg itp. na tej karcie. Wymaga karty tła pogodowego w tym samym widoku. | wł. |
| `tap_action`, `hold_action`, `double_tap_action` | Co dzieje się po dotknięciu, przytrzymaniu albo dwukrotnym dotknięciu: przełączenie, szczegóły, inna strona, skrypt… | zależy od karty |
| `sub_buttons` | Małe dodatkowe okrągłe przyciski po prawej stronie karty, każdy z własnym urządzeniem i akcją. Są w kartach encji, przycisku, osoby i alarmu. | brak |
| `styles` | Dla majsterkowiczów: własny CSS wewnątrz karty | brak |

<a id="lumen-light-card"></a>

### Światło (`lumen-light-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Światło | – |
| `name`, `icon` | Nazwa i ikona na kaflu | z urządzenia |
| `power_entity` | Włącznik albo przekaźnik, który zasila żarówkę. Gdy jest wyłączony, żarówka jest „wyłączona”, a nie „niedostępna”, a dotknięcie przełącza przekaźnik. | brak |
| `show_state` | Pokazuj linię z jasnością | wł. |
| `show_color_button` | Pokazuj kółko barwy | wł. |

<a id="lumen-chips-card"></a>

### Chipy (`lumen-chips-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `chips` | Lista chipów. Każdy ma `type`: **action** (scena, skrypt, przycisk…) albo **light** (światło). Każdy ma też `entity`, a opcjonalnie `name`, `icon` i `tap_action`. Chip światła może mieć `power_entity`. | – |
| `alignment` | Do lewej, do środka, do prawej albo rozłożone | do lewej |
| `fab` | **Pokaż jako pływający przycisk**: akcje przechodzą do okrągłego przycisku w prawym dolnym rogu | wył. |
| `fab_narrow_only` | **Auto: tylko na wąskim ekranie.** Pływający przycisk pojawia się tylko na telefonie i tablecie w pionie, a na szerszych ekranach zostaje zwykły rząd chipów. Odznacz, żeby przycisk pływał zawsze. | wł. |
| `title` | Nagłówek nad pozycjami pływającego przycisku | „Sceny” |

<a id="lumen-person-card"></a>

### Osoba (`lumen-person-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Osoba | – |
| `presence_entity` | Czujnik, który najlepiej wie, czy ktoś jest w domu, np. brelok Bluetooth. Bez niego liczy się strefa „dom” osoby. | brak |
| `name` | Wyświetlane imię | z osoby |
| `picture` | Adres (URL) zdjęcia | zdjęcie osoby |
| `avatar_color` | Kolor tła za literą, gdy nie ma zdjęcia | brzoskwiniowy |
| `show_name`, `show_status` | Pokazuj imię / linię „w domu od…” | wł. |

<a id="lumen-alarm-card"></a>

### Alarm (`lumen-alarm-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Centrala alarmu | – |
| `name`, `icon` | Nazwa oraz ikona zamiast tarczy (np. garaż) | z urządzenia |
| `banner` | Czerwony baner, gdy alarm się włączy | wł. |
| `banner_text` | Tekst banera | „Alarm: *nazwa*!” |
| `screen_ring` | Czerwona pulsująca ramka wokół całego ekranu, gdy alarm się włączy | wł. |
| `show_state` | Pokazuj linię stanu | wł. |

Wskazówka: ustaw `tap_action` na swój skrypt uzbrajania/rozbrajania, wtedy jedno dotknięcie przełącza alarm.

<a id="lumen-lock-card"></a>

### Zamek (`lumen-lock-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Zamek | – |
| `name`, `icon` | Nazwa i ikona | z urządzenia |
| `busy_entity` | Czujnik, który jest „włączony”, kiedy zamek pracuje (niektóre zamki w autach potrzebują chwili). Karta poczeka na koniec, zanim napisze „gotowe”. | brak |
| `show_state` | Pokazuj linię stanu | wł. |

<a id="lumen-entity-card"></a>

### Encja (`lumen-entity-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Dowolne urządzenie albo czujnik | – |
| `name`, `icon` | Nazwa i ikona | z urządzenia |
| `show_name`, `show_icon`, `show_state` | Pokazuj albo ukryj każdą część | wł. |

<a id="lumen-button-card"></a>

### Przycisk (`lumen-button-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Co przycisk uruchamia: skrypt, scenę, przycisk albo cokolwiek, co da się przełączyć | – |
| `name`, `icon` | Nazwa i ikona | z urządzenia |
| `feedback` | **Czekaj na odpowiedź urządzenia** po dotknięciu. Wypełnij `status_entity` (czujnik z kodem odpowiedzi), `success_state` (kod oznaczający sukces, domyślnie `"200"`), `message_entity` (czujnik z treścią błędu) i `success_text` (tekst po sukcesie). | wył. |
| `last_used_entity` | Pomocnik „data i godzina”, w którym zapisuje się ostatnie użycie | brak |
| `secondary_info` | Druga linia: **Auto** (ostatnie użycie), stan, ostatnie uruchomienie, ostatnia zmiana albo nic | Auto |
| `show_name`, `show_icon`, `show_state` | Pokazuj albo ukryj każdą część | wł. |

<a id="lumen-sensor-card"></a>

### Sensor (`lumen-sensor-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Czujnik | – |
| `name` | Wyświetlana nazwa | z czujnika |
| `hours` | Ile godzin obejmuje wykres | 12 |
| `color` | Kolor wykresu | kolor akcentu |
| `show_name`, `show_graph` | Pokazuj nazwę / wykres | wł. |

<a id="lumen-climate-card"></a>

### Klimatyzacja (`lumen-climate-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Klimatyzator albo termostat | – |
| `name`, `icon` | Nazwa i ikona | z urządzenia |
| `hvac_modes` | Które przyciski trybu pokazać | wył., grzanie, chłodzenie |
| `fan_modes` | Które przyciski nadmuchu pokazać | auto, niski, średni, wysoki |
| `min_temp`, `max_temp` | Zawęża zakres temperatur (puste = zakres urządzenia) | zakres urządzenia |
| `fab` | **Pokaż jako pływający przycisk** w rogu | wył. |
| `fab_narrow_only` | **Auto: tylko na wąskim ekranie**: pływający przycisk na telefonie, zwykła karta na dużym ekranie | wł. |
| `power_action` | Co robi przycisk zasilania, jeśli wolisz własny skrypt | włącza ostatni tryb / wyłącza |
| `show_current_temp`, `show_modes`, `show_fan_modes` | Pokazuj temperaturę w pokoju / przyciski trybu / przyciski nadmuchu | wł. |

Karta pokazuje tylko tryby, które urządzenie naprawdę ma. Termostaty z zakresem „od–do” też działają: dotknij dolnej albo górnej liczby, żeby wybrać, którą zmieniają **−** i **+**.

<a id="lumen-air-quality-card"></a>

### Jakość powietrza (`lumen-air-quality-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `pm25`, `pm10`, `aqi_entity` | Twoje czujniki powietrza. Wystarczy jeden z trzech. | – |
| `stale_hours` | Po ilu godzinach bez nowych danych karta pokaże „Nieaktualne dane” | 1 |
| `footer` | Krótka notka na dole okna z wykresem, np. „Czujnik na balkonie” | brak |
| `levels` | Własne nazwy sześciu poziomów (tylko w YAML) | Bardzo dobra … Bardzo zła |
| `show_values`, `show_bar` | Pokazuj liczby / kolorowy pasek poziomów | wł. |

<a id="lumen-reminder-card"></a>

### Przypomnienie (`lumen-reminder-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `entity` | Co obserwować, np. pomocnik-przełącznik „niska bateria roweru” | – |
| `state` | Przypomnienie działa, dopóki urządzenie ma ten stan | `on` |
| `name`, `icon`, `color` | Napis, ikona i kolor pigułki (informacja, OK, ostrzeżenie, alarm) | z urządzenia, informacja |
| `value`, `value_entity` | Dodatkowy tekst na pigułce; `{value}` zamienia się w liczbę z `value_entity`, np. „Bateria {value}%” | brak |
| `show_chip` | Czy w ogóle pokazywać pigułkę (wył. = tylko okienko) | wł. |
| `dialog` | Okienko w chwili, gdy przypomnienie startuje | wł. |
| `title`, `message` | Nagłówek i tekst okienka | nazwa |
| `done` | Przycisk **Gotowe**, który wyłącza przypomnienie | wył. |
| `done_action` | Inna akcja dla **Gotowe** | wyłączenie encji |
| `alignment` | Gdzie stoi pigułka: z lewej, na środku, z prawej | z lewej |

<a id="lumen-title-card"></a>

### Tytuł (`lumen-title-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `title` | Tekst | – |
| `heading_style` | **Nadtytuł** (małe wersaliki), **Tytuł sekcji** (duży) albo **Nagłówek pokoju** | Nadtytuł |
| `badges` | Wartości obok tytułu. Każda ma `entity`, a opcjonalnie `state_content` (atrybut zamiast stanu) i `name` (napis przed wartością). | brak |
| `entity`, `tap_action` | Co otwiera dotknięcie tytułu | nic |

<a id="lumen-greeting-card"></a>

### Powitanie (`lumen-greeting-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `show_date` | Data nad powitaniem | wł. |
| `name` | Imię po powitaniu | zalogowana osoba |
| `sun_entity` | Czujnik słońca, po którym karta poznaje porę dnia | `sun.sun` |

<a id="lumen-weather-background-card"></a>

### Tło pogodowe (`lumen-weather-background-card`)

| Ustawienie | Co robi | Domyślnie |
|---|---|---|
| `weather_entity` | Twoje urządzenie z prognozą pogody | – |
| `sun_entity` | Czujnik słońca (dzień i noc) | `sun.sun` |
| `show_controls` | Pokazuj trzy przełączniki: tło pogodowe, pogoda na kartach, animacje. Każde urządzenie pamięta swój wybór. | wył. |

---

## Pytania i problemy

**Zainstalowałem, ale nie widzę kart.**
Odśwież przeglądarkę klawiszami Ctrl+F5 (na Macu Cmd+Shift+R). W aplikacji na telefonie: **Ustawienia → Aplikacja towarzysząca → Debugowanie → Zresetuj pamięć podręczną interfejsu**. Potem przy dodawaniu karty wpisz „Lumen”.

**Widzę „Custom element doesn't exist: lumen-…”.**
To samo: odśwież przeglądarkę. Jeśli dalej to widać, sprawdź **Ustawienia → Dashboardy → ⋮ → Zasoby**. Powinien tam być jeden wpis kończący się na `lumen-cards.js`.

**Na dashboardzie nie pada deszcz ani śnieg.**
Dodaj kartę **Tło pogodowe** do tego samego widoku (jedna na widok wystarczy) i wybierz w niej swoje urządzenie pogody. Na słabszych tabletach efekty mogą być wyłączone. Włącz `show_controls`, żeby zobaczyć przełączniki.

**Na telefonie karty wyglądają inaczej niż na tablecie.**
Tak ma być: mała karta pokazuje wersję kompaktową. Jeśli chcesz sam zdecydować, co gdzie widać, zajrzyj do wskazówki pod [Przykładowymi dashboardami](#przykładowe-dashboardy): dwie kopie karty i warunek widoczności **Ekran**. Możesz też ustawić `layout` na **Pełny** albo **Kompaktowy**, żeby wyłączyć automatyczne przełączanie.

**Pływający przycisk klimatyzacji coś zasłania.**
Kilka pływających przycisków samo ustawia się jeden nad drugim. Żeby podnieść je wyżej, np. nad dolny pasek nawigacji, dodaj do motywu Home Assistant `lumen-cards-fab-bottom: 90px`.

**Czy mogę zmienić kolory?**
Tak: `accent_color` i `glow_color` w każdej karcie albo dla wszystkich kart naraz zmiennymi `lumen-cards-accent` i `lumen-cards-glow-color` w motywie Home Assistant.

**Czy da się obsługiwać karty klawiaturą?**
Tak. Tab przechodzi między kartami, Enter albo spacja to dotknięcie, Shift+Enter to przytrzymanie (np. otwiera panel światła). Strzałki zmieniają jasność, a Escape zamyka okna.

---

## Dla programistów

```sh
npm install
npm run dev     # demo na zmyślonych urządzeniach: http://localhost:5174/dev/index.html
npm test
npm run build   # → dist/
```

Opcje demo: `?compact`, `&dark`, `&lang=pl`, `&fx` (pogoda), `&weather=snowy`, `&scene=phone|desktop`, `&only=<karta>`. Teksty są w `src/translations/en.json` i `pl.json`. Nowy język to nowy plik zarejestrowany w `src/core/i18n.ts`.

## Licencja

MIT. Czcionki Manrope i IBM Plex Mono (SIL Open Font License), pobrane przez Fontsource.
