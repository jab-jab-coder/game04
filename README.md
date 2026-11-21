# 🐿️ Orzechowa Gorączka

Przeglądarkowa gra platformowa o życiu wiewiórek. Skacz po gałęziach, wspinaj się po pniach,
zbieraj orzechy i żołędzie, uciekaj przed psami i nie daj się okraść srokom, zanim przyjdzie zima!

- 1 lub 2 graczy (kooperacja na jednym ekranie)
- klawiatura + gamepad (standardowe mapowanie: Xbox / PlayStation / większość padów USB)
- czysty HTML5 Canvas + JavaScript, **zero zależności i zero kroku budowania**
- cała grafika i dźwięk generowane w kodzie (brak plików graficznych/dźwiękowych)

## Uruchomienie lokalne

Wystarczy otworzyć `index.html` w przeglądarce (dwuklik). Opcjonalnie przez serwer:

```bash
python3 -m http.server 8000
# potem http://localhost:8000
```

## Wdrożenie na GitHub Pages

1. Utwórz repozytorium na GitHubie i wypchnij kod na gałąź `main`:
   ```bash
   git init -b main
   git add .
   git commit -m "Orzechowa Gorączka – pierwsza wersja"
   git remote add origin https://github.com/<użytkownik>/<repo>.git
   git push -u origin main
   ```
2. W repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` publikuje grę przy każdym pushu na `main`.
   Adres: `https://<użytkownik>.github.io/<repo>/`

## Sterowanie

| Akcja | Gracz 1 | Gracz 2 | Pad |
|---|---|---|---|
| Ruch | A / D | ← / → | lewa gałka / krzyżak |
| Wspinaczka / zeskok | W / S | ↑ / ↓ | gałka góra/dół |
| Skok (przytrzymaj = siła) | Spacja | prawy Shift / Num0 / `/` | A (✕) / LB / LT |
| Akcja (rzut szyszką, zakopywanie) | E / Q | prawy Ctrl / Enter / `.` | B / X / Y |
| Pauza | P / Esc | P / Esc | Start |

`M` – wyciszenie. W trybie 1 gracza działają oba zestawy klawiszy i każdy pad.
W trybie 2 graczy pierwszy podłączony pad steruje Graczem 1, drugi – Graczem 2
(można też łączyć: jeden gracz na klawiaturze, drugi na padzie).

## Zasady i mechanika

### Cel
Każdy poziom to pora roku z limitem czasu („Do zimy”). Trzeba zgromadzić w **dziupli (Spiżarni)**
określoną liczbę punktów. Pasek u góry ekranu ma 3 progi gwiazdek: 100%, 140% i 180% celu.

| Poziom | Cel | Czas | Utrudnienia |
|---|---|---|---|
| 1. Wczesna jesień | 450 | 2:20 | jamnik, mops, 1 sroka, 1 rywal |
| 2. Złota jesień | 750 | 2:30 | + owczarek, podmuchy wiatru, 2 sroki, 2 rywali |
| 3. Pierwsze przymrozki | 1050 | 2:40 | oblodzone, śliskie gałęzie, 3 sroki, 3 rywali |

Las jest losowany przy każdym podejściu, więc każda rozgrywka wygląda inaczej.

### Skakanie – serce gry
- Przytrzymaj **skok**: nad wiewiórką pojawia się wskaźnik siły, który **pulsuje** 0 → 100% → 0.
- Puść, gdy wskaźnik jest w **zielonym polu** → **idealne wybicie** (+13% siły, efekt i dźwięk).
- Ładując skok, możesz normalnie **biec i wspinać się** (nieco wolniej). Można też zacząć ładować
  w locie – skok wykona się, gdy puścisz przycisk już po wylądowaniu.
- Puszczenie skoku tuż po zbiegnięciu z krawędzi gałęzi nadal działa („coyote time”).
- Kierunek trzymany w chwili puszczenia decyduje o kierunku skoku; bez kierunku – skok w górę.
- Za słaby skok między drzewami = lot na trawę, gdzie czekają psy.
- **Upadek z dużej wysokości** ogłusza na chwilę i wysypuje 2 przedmioty z policzków,
  a z bardzo dużej – zabiera też serce.
- W locie przytrzymaj **górę** przy pniu, aby się go złapać. **Dół** na gałęzi = zeskok przez gałąź.

### Policzki i punktacja
- Policzki mieszczą **6 miejsc** (widać, jak puchną!). Orzech włoski zajmuje 2 miejsca.
- Każde zajęte miejsce **spowalnia** wiewiórkę i osłabia skok – ryzyko kontra nagroda.
- Wpłata do dziupli: **combo +15% za każdy kolejny przedmiot**, pełne policzki **+25%**.
- **Zakopywanie** (na trawie: dół + akcja): 60% punktów od razu, bezpieczne „wyjście awaryjne”.
  W miejscu zakopania rośnie sadzonka – ukłon w stronę roli wiewiórek w sadzeniu lasów.

### Przysmaki i przedmioty
| Przedmiot | Efekt |
|---|---|
| Żołądź | 10 pkt |
| Orzech laskowy | 20 pkt |
| Orzech włoski | 45 pkt, 2 miejsca (częściej na ziemi – ryzykownie!) |
| Szyszka | amunicja (max 5) |
| Borowik | +1 serce (max 5) |
| Złoty żołądź | 9 s nietykalności, psy uciekają, punkty ×2 |
| Malina | 9 s szybszego biegu i mocniejszych skoków |
| Piórko polatuchy | 15 s szybowania (przytrzymaj skok w locie) |
| Zgniły orzech | 4 s odwróconego sterowania, −10 pkt |

### Przeciwnicy
- **Psy** pilnują trawy. Jamnik – bardzo szybki; owczarek – podskakuje do nisko siedzących
  wiewiórek; mops – wolny i często zasypia (ale budzi się, gdy przejdziesz obok). Złapanie =
  −1 serce i rozsypane orzechy. Gdy siedzisz na drzewie, psy szczekają pod nim i po chwili się nudzą.
  Szyszka ogłusza psa na 3 s.
- **Sroki** krążą nad lasem i pikują na wiewiórki z pełnymi policzkami, kradnąc orzech.
  Skocz sroce na grzbiet albo traf ją szyszką, a upuści łup (+25 pkt).
- **Szaruś** (wiewiórka szara) podbiera jedzenie, a po zebraniu 3 sztuk siada i je
  (tylko w spokojnym miejscu). Skocz mu na głowę lub rzuć szyszką – wypuści wszystko z łapek (+15 pkt).
- Psy gonią też Szarusia. Widząc goniącego psa, ucieka bardzo szybko na najbliższe drzewo, które nie
  stoi za psem, chwilę tam odpoczywa (zjadając, co zdążył zebrać) i wraca do zbierania.
  Gdy pies go dopadnie, **gubi cały łup** (okazja dla ciebie!), odskakuje i na 3 s staje się nietykalny.
  Jeśli nie zdąży uciec w 4 s – „Puff!” – zjawia się na gałęzi najbliższego drzewa.

### Utrata wszystkich serc
Wiewiórka mdleje na 3,5 s i wraca przy dziupli z 3 sercami (traci zawartość policzków i szyszki).

### Humor i przyroda
- Dymki z tekstami psów („Ja tylko chcę się pobawić!”), srok („Dziękuję za współpracę!”) i rywali.
- Ptasi „prezent” od sroki daje +15 pkt – bo przecież to **na szczęście**.
- Przy pierwszym podniesieniu każdego przedmiotu oraz między poziomami pojawiają się
  prawdziwe ciekawostki przyrodnicze (o polatusze, suszeniu grzybów, srokach i lustrze itd.).
- Na koniec gry humorystyczne nagrody: „Kaskader roku”, „Polatucha honoris causa”,
  „Ulubienica jamników”…

## Struktura kodu

```
index.html            – strona gry
css/style.css
js/data.js            – stałe, przedmioty, poziomy, ciekawostki, teksty dymków
js/audio.js           – syntezowane efekty dźwiękowe i muzyka (WebAudio)
js/input.js           – klawiatura + Gamepad API
js/world.js           – proceduralne generowanie lasu
js/entities.js        – wiewiórki (fizyka, skoki), AI rywali, psy, sroki, przedmioty
js/render.js          – rysowanie wszystkich elementów na Canvas
js/main.js            – pętla gry, stany, kolizje, punktacja, kamera, HUD, menu
.github/workflows/pages.yml – automatyczny deploy na GitHub Pages
```

Balans łatwo zmieniać w `js/data.js` (cele i czasy poziomów, liczba wrogów, punkty i rzadkość
przedmiotów) oraz w `js/entities.js` (siła skoku, grawitacja, prędkości psów).
