// User-facing texts of the catalog page (dev/catalog.ts), keyed by Section.id of catalog-data.ts:
// what the card is for, what you need for it and how you use it. Plain Polish, from README.pl.md.

export type Gesture = "tap" | "drag" | "hold" | "icon" | "see";

export interface Guide {
  /** One line for the gallery tile. */
  tagline: string;
  /** What the card shows, a short paragraph. */
  about: string;
  /** What you need in Home Assistant. */
  need: string;
  /** How you use it. */
  controls: [Gesture, string][];
}

export const GUIDE: Record<string, Guide> = {
  swiatlo: {
    tagline: "Duży kafel lampy, który świeci jej kolorem.",
    about: "Jedna lampa albo grupa lamp na dużym kaflu. Kafel świeci kolorem żarówki, a grupa pokazuje, ile lamp świeci („2 z 3 włączone”). Żarówki za osobnymi włącznikami, np. dwa kinkiety, też zmieszczą się na jednej karcie: przyciski włączają każdy z nich, a karta ustawia jasność i barwę obu.",
    need: "Lampa albo grupa świateł",
    controls: [
      ["tap", "Dotknij, żeby włączyć albo wyłączyć."],
      ["drag", "Przesuń palcem w lewo lub w prawo, żeby zmienić jasność."],
      ["icon", "Dotknij ikony albo przytrzymaj: jasność, odcienie bieli i kolory."],
    ],
  },
  chipy: {
    tagline: "Sceny i lampy w jednym rzędzie małych przycisków.",
    about: "Rząd małych przycisków. Przycisk akcji jednym dotknięciem włącza scenę albo skrypt, np. „Film” czy „Wieczór”. Przycisk światła działa jak mała karta lampy. Na telefonie akcje mogą schować się w pływającym przycisku w rogu ekranu.",
    need: "Sceny, skrypty albo lampy",
    controls: [
      ["tap", "Dotknij sceny, żeby ją włączyć."],
      ["hold", "Przytrzymaj lampę, żeby ustawić jasność i kolor."],
    ],
  },
  osoba: {
    tagline: "Kto jest w domu i od kiedy.",
    about: "Domownik ze zdjęciem albo pierwszą literą imienia. Zielona kropka znaczy, że jest w domu. Karta mówi też, od kiedy jest w domu albo poza nim i gdzie jest, np. „Praca”.",
    need: "Osoba z Home Assistant",
    controls: [["see", "Wystarczy spojrzeć. Dotknięcie pokazuje szczegóły."]],
  },
  alarm: {
    tagline: "Stan alarmu i uzbrajanie kodem.",
    about: "Stan alarmu w jednym spojrzeniu. Uzbrojony jest zielony, uzbrajanie ma żółty pasek odliczania z przyciskiem Anuluj, a włączony alarm barwi kartę na czerwono.",
    need: "Centrala alarmowa",
    controls: [
      ["tap", "Uzbrój otwiera klawiaturę z trybami: w domu, poza domem, noc."],
      ["tap", "Rozbrój prosi tylko o kod. Błędny kod trzęsie kropkami."],
    ],
  },
  zamek: {
    tagline: "Zamek drzwi albo auta z przyciskami.",
    about: "Czy zamek jest zamknięty, z przyciskami Zablokuj i Odblokuj (oraz Otwórz, jeśli zamek to umie). Zacięty zamek dostaje czerwoną ramkę.",
    need: "Zamek",
    controls: [
      ["tap", "Zablokuj działa od razu."],
      ["tap", "Odblokuj i Otwórz najpierw pytają o PIN, jeśli zamek go wymaga."],
    ],
  },
  encja: {
    tagline: "Drzwi, okna, gniazdka – wszystko, co ma stan.",
    about: "Mały kafel dla czegokolwiek, co ma stan. Otwarte drzwi i okna robią się czerwone, włączone urządzenia dostają kolor akcentu. Po prawej zmieszczą się małe dodatkowe przyciski, np. do lampy obok.",
    need: "Dowolne urządzenie albo czujnik",
    controls: [["tap", "Dotknij, żeby przełączyć urządzenie albo zobaczyć szczegóły czujnika."]],
  },
  przycisk: {
    tagline: "Uruchamia skrypt albo scenę i czeka na odpowiedź.",
    about: "Jednym dotknięciem coś uruchamia: skrypt, scenę albo przycisk. Potrafi poczekać na odpowiedź urządzenia, np. bramy, która zgłasza, czy naprawdę się otworzyła. Sukces świeci na zielono, błąd dostaje czerwoną ramkę.",
    need: "Skrypt, scena albo przycisk",
    controls: [["tap", "Dotknij, żeby uruchomić."]],
  },
  sensor: {
    tagline: "Temperatura albo inna liczba z wykresem.",
    about: "Temperatura albo dowolna inna liczba z małym wykresem ostatnich godzin w tle. Gdy czujnik dawno nic nie wysłał, karta mówi, jak stara jest wartość.",
    need: "Czujnik z liczbą",
    controls: [["tap", "Dotknij, żeby zobaczyć pełną historię."]],
  },
  "jakosc-powietrza": {
    tagline: "Smog w sześciu prostych poziomach.",
    about: "Zamienia odczyty PM2.5 i PM10 (albo AQI) na sześć poziomów, od „Bardzo dobra” do „Bardzo zła”, według europejskiego indeksu jakości powietrza.",
    need: "Czujnik pyłów PM2.5 / PM10 albo AQI",
    controls: [["tap", "Dotknij, żeby zobaczyć wykres z całej doby."]],
  },
  klimatyzacja: {
    tagline: "Klimatyzator albo termostat: temperatura i tryby.",
    about: "Temperatura docelowa z przyciskami − i +, tryby i prędkości nawiewu, które ma Twoje urządzenie, oraz znacznik, co urządzenie robi teraz: grzeje, chłodzi albo czeka. Na telefonie może zmienić się w pływający przycisk z temperaturą.",
    need: "Klimatyzator, termostat albo głowica grzejnika",
    controls: [
      ["tap", "− i + zmieniają temperaturę."],
      ["tap", "Przyciski trybów przełączają chłodzenie, grzanie i nawiew."],
    ],
  },
  pogoda: {
    tagline: "Pogoda teraz i na najbliższe godziny.",
    about: "Aktualna pogoda: cienka linijka, sama ikona z temperaturą albo karta z prognozą godzinową. Pokazuje też ostrzeżenia, np. o burzach.",
    need: "Prognoza pogody (np. Met.no)",
    controls: [["tap", "Dotknij: odczuwalna temperatura, wiatr, prognoza na dziś i na 7 dni."]],
  },
  przypomnienie: {
    tagline: "Pojawia się tylko wtedy, gdy coś wymaga uwagi.",
    about: "Mała pigułka, która pojawia się tylko wtedy, gdy trzeba coś zrobić, np. „Rower – bateria 18%”. Może też wyskoczyć okienko, które wraca przy każdym otwarciu dashboardu, aż dotkniesz Gotowe.",
    need: "Przełącznik pomocnika (input_boolean)",
    controls: [["tap", "Dotknij pigułki: Przypomnij później albo Gotowe."]],
  },
  rolety: {
    tagline: "Rolety, żaluzje i bramy garażowe.",
    about: "Pasek pokazuje, jak bardzo roleta jest otwarta. Żaluzje z ruchomymi lamelami mają drugi pasek do ich kąta.",
    need: "Roleta, żaluzja albo brama",
    controls: [
      ["drag", "Przesuń palcem po karcie – roleta rusza, gdy puścisz."],
      ["tap", "Otwórz, Stop i Zamknij."],
    ],
  },
  odtwarzacz: {
    tagline: "Głośnik albo telewizor z okładką i głośnością.",
    about: "Okładka, tytuł i wykonawca, postęp utworu i głośność. W małym miejscu zamienia się w jeden wiersz z przyciskiem odtwarzania.",
    need: "Głośnik, telewizor albo inny odtwarzacz",
    controls: [
      ["tap", "Poprzedni, pauza i następny."],
      ["drag", "Przesuń pasek głośności."],
    ],
  },
  "lista-wyboru": {
    tagline: "Wybór jednej opcji z listy.",
    about: "Lista opcji, np. tryb odkurzacza albo „w domu / poza domem / noc”. Pod spodem może być stan drugiego urządzenia.",
    need: "Pomocnik z listą opcji (input_select / select)",
    controls: [["tap", "Dotknij, żeby rozwinąć listę i wybrać."]],
  },
  oczyszczacz: {
    tagline: "Tryby, prędkość, jakość powietrza i filtry w jednym kaflu.",
    about: "Działa z każdym oczyszczaczem, który w Home Assistant jest encją fan. Sama encja wystarczy: karta pokazuje zasilanie, tryby i prędkości urządzenia. PM2.5, wilgotność, wodę i filtry znajduje sama, gdy urządzenie je ma. Funkcje specyficzne dla modelu dodajesz w ustawieniach, bez kodu.",
    need: "Oczyszczacz jako encja fan",
    controls: [
      ["tap", "Przyciski zmieniają tryb i prędkość od razu, a gdy urządzenie nie potwierdzi, karta to cofa."],
      ["tap", "Dotknij bloku PM2.5: wykresy z 6, 24 lub 48 godzin i dodatkowe sterowanie."],
      ["hold", "Przytrzymaj nagłówek, żeby otworzyć szczegóły."],
    ],
  },
  wentylator: {
    tagline: "Prędkość wentylatora suwakiem.",
    about: "Duży kafel z suwakiem. Ikona kręci się tym szybciej, im wyższa prędkość.",
    need: "Wentylator albo oczyszczacz",
    controls: [
      ["drag", "Przesuń palcem, żeby ustawić prędkość."],
      ["tap", "Dotknij, żeby włączyć albo wyłączyć."],
    ],
  },
  liczba: {
    tagline: "Dowolna wartość liczbowa suwakiem.",
    about: "Liczba z jednostką na dużym kaflu z suwakiem, np. próg wilgotności albo głośność dzwonka.",
    need: "Pomocnik liczbowy (input_number / number)",
    controls: [["drag", "Przesuń palcem, żeby ustawić wartość."]],
  },
  kalendarz: {
    tagline: "Najbliższe wydarzenia na kolejne dni.",
    about: "Wydarzenia z kalendarza pogrupowane po dniach, z wyraźnie oznaczonym dziś i jutro.",
    need: "Kalendarz (np. Google)",
    controls: [["see", "Wystarczy spojrzeć."]],
  },
  tytul: {
    tagline: "Nagłówki dzielące dashboard na części.",
    about: "Nagłówek w trzech stylach: mały napis, duży tytuł sekcji albo nagłówek pokoju. Obok mogą być wartości, np. temperatura w pokoju.",
    need: "Nic – wystarczy wpisać tekst",
    controls: [["see", "Porządkuje dashboard."]],
  },
  powitanie: {
    tagline: "„Dzień dobry” z imieniem i datą.",
    about: "Powitanie według pory dnia z imieniem zalogowanej osoby i dzisiejszą datą.",
    need: "Nic",
    controls: [["see", "Zmienia się samo rano, po południu i wieczorem."]],
  },
  stosy: {
    tagline: "Kilka kart w jednej kolumnie albo w rzędzie.",
    about: "Karty jedna pod drugą albo obok siebie, jak w zwykłym Home Assistant, ale z jedną szerokością dla całej grupy, np. 70% ekranu, wyśrodkowaną albo przy brzegu.",
    need: "Inne karty do zgrupowania",
    controls: [["see", "W edytorze dodajesz karty zakładkami, tak jak w zwykłym stosie."]],
  },
  pasek: {
    tagline: "Drzwi, alarm i zamki w jednej ramce.",
    about: "Pasek z kilkoma małymi kafelkami w jednej ramce, np. drzwi wejściowe, alarm i zamek auta. Każdy kafelek działa jak swoja karta.",
    need: "Kilka urządzeń do jednego paska",
    controls: [["tap", "Każdy kafelek reaguje jak jego pełna karta."]],
  },
  "pop-up": {
    tagline: "Okno z kartami całego pokoju.",
    about: "Okno z dowolnymi kartami, otwierane z przycisku, paska nawigacji albo wiersza na dashboardzie. Zamykasz je ×, dotknięciem obok albo przesunięciem w dół.",
    need: "Karty, które ma pokazać okno",
    controls: [["tap", "Dotknij wiersza, żeby otworzyć okno."]],
  },
  "plywajacy-panel": {
    tagline: "Wszystkie termostaty pod jednym przyciskiem.",
    about: "Jeden okrągły przycisk, który otwiera arkusz z kartami – najczęściej wszystkimi termostatami naraz. Przycisk mówi, ile z nich grzeje, i ostrzega o słabej baterii głowicy. Na komputerze jest wierszem w siatce.",
    need: "Termostaty albo inne karty",
    controls: [
      ["tap", "Dotknij, żeby otworzyć arkusz."],
      ["tap", "W arkuszu „Wszystkie: Komfort / Eco” zmienia wszystkie naraz."],
    ],
  },
  odstep: {
    tagline: "Miejsce, żeby przewinąć ponad pływające przyciski.",
    about: "Niewidoczna karta z pustym miejscem. Dodana na końcu dashboardu sama dopasowuje się do wysokości pływających przycisków, żeby nie zasłaniały ostatniej karty. Możesz też ustawić stałą wysokość w pikselach.",
    need: "Nic",
    controls: [["see", "Nic nie pokazuje. Jej obrys widać tylko podczas edycji dashboardu."]],
  },
  "pasek-nawigacji": {
    tagline: "Przyciski do widoków dashboardu.",
    about: "Pasek z przyciskami do widoków dashboardu albo okien pop-up. Może przykleić się do dołu ekranu jak w aplikacji.",
    need: "Widoki dashboardu",
    controls: [["tap", "Dotknij, żeby przejść do widoku."]],
  },
};
