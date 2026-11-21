'use strict';
// ===================== DANE GRY: przedmioty, poziomy, teksty =====================

const GRAVITY = 1500;
const GROUND_Y = 1000;
const WORLD_H = 1100;
const CHEEK_SLOTS = 6;      // pojemność policzków
const MAX_CONES = 5;

const ITEM_TYPES = {
  acorn:     { name: 'Żołądź',          kind: 'food',  points: 10, slots: 1, weight: 40, groundWeight: 10 },
  hazel:     { name: 'Orzech laskowy',  kind: 'food',  points: 20, slots: 1, weight: 26, groundWeight: 14 },
  walnut:    { name: 'Orzech włoski',   kind: 'food',  points: 45, slots: 2, weight: 7,  groundWeight: 22 },
  cone:      { name: 'Szyszka',         kind: 'ammo',  weight: 13, groundWeight: 8 },
  mushroom:  { name: 'Borowik',         kind: 'heal',  weight: 3,  groundWeight: 6 },
  golden:    { name: 'Złoty żołądź',    kind: 'power', power: 'golden', dur: 9,  weight: 1.4, groundWeight: 2 },
  raspberry: { name: 'Malina',          kind: 'power', power: 'speed',  dur: 9,  weight: 3,  groundWeight: 3 },
  feather:   { name: 'Piórko polatuchy',kind: 'power', power: 'glide',  dur: 15, weight: 2.2, groundWeight: 1 },
  rotten:    { name: 'Zgniły orzech',   kind: 'bad',   weight: 5,  groundWeight: 7 },
};

// Ciekawostka pokazywana przy pierwszym podniesieniu danego przedmiotu
const ITEM_FACTS = {
  acorn: 'Żołądź – dęby co kilka lat mają „rok nasienny” i sypią żołędziami jak szalone.',
  hazel: 'Leszczyna – wiewiórka rozłupuje orzech laskowy siekaczami w kilka sekund.',
  walnut: 'Orzech włoski – ciężki i kaloryczny. Zajmuje 2 miejsca w policzkach!',
  cone: 'Szyszka – wiewiórki obgryzają łuski, by dostać się do nasion. Możesz też nią rzucić!',
  mushroom: 'Borowik – wiewiórki naprawdę suszą grzyby, wieszając je na gałęziach! +1 serce.',
  golden: 'Złoty żołądź – legenda lasu. Nietykalność i podwójne punkty!',
  raspberry: 'Malina – zastrzyk cukru. Biegasz i skaczesz szybciej!',
  feather: 'Polatucha to jedyna „latająca” wiewiórka Europy – szybuje na fałdach skóry. Przytrzymaj skok w powietrzu!',
  rotten: 'Zgniły orzech… Fuj! Kręci się w głowie – sterowanie odwrócone.',
};

const DOG_TYPES = {
  jamnik:   { name: 'Jamnik',   patrol: 75, chase: 285, jump: 0,   w: 66, h: 26, color: '#8b4a1f', dark: '#5a2d10', senses: 520 },
  owczarek: { name: 'Owczarek', patrol: 90, chase: 250, jump: 560, w: 62, h: 40, color: '#3a2a1e', dark: '#c48a4a', senses: 600 },
  mops:     { name: 'Mops',     patrol: 45, chase: 175, jump: 0,   w: 46, h: 32, color: '#d8c19a', dark: '#2a2420', senses: 380 },
};

const LEVELS = [
  {
    name: 'Wczesna jesień', subtitle: 'Las pachnie grzybami, a orzechy same pchają się do łapek.',
    time: 140, target: 450, trees: 11, dogs: ['jamnik', 'mops'], magpies: 1, rivals: 1,
    wind: 0, ice: false, maxItems: 22,
    sky: ['#7ec8ef', '#d9f1ff'], hills: ['#8fbf6a', '#6fa552'], leaves: ['#7fae3f', '#a6c24a', '#e0b33a', '#5f9a3a'],
    grass: ['#6fb34b', '#4f8f35'], particles: 'leaf',
  },
  {
    name: 'Złota jesień', subtitle: 'Wieje wiatr – uważaj na skoki! Sroki są coraz bardziej bezczelne.',
    time: 150, target: 750, trees: 13, dogs: ['jamnik', 'owczarek', 'mops'], magpies: 2, rivals: 2,
    wind: 90, ice: false, maxItems: 24,
    sky: ['#f2a65a', '#ffe6b8'], hills: ['#c98f3d', '#a8702e'], leaves: ['#e0782a', '#f2b632', '#c94a1f', '#b8862b'],
    grass: ['#9aa84a', '#76802f'], particles: 'leaf',
  },
  {
    name: 'Pierwsze przymrozki', subtitle: 'Gałęzie są oblodzone i śliskie. Zima tuż-tuż!',
    time: 160, target: 1050, trees: 15, dogs: ['jamnik', 'owczarek', 'owczarek', 'mops'], magpies: 3, rivals: 3,
    wind: 60, ice: true, maxItems: 26,
    sky: ['#8aa4c0', '#e6eef6'], hills: ['#a9b8c4', '#8698a8'], leaves: ['#9a6a3a', '#7d5a3a', '#c9d6df', '#6e4a2a'],
    grass: ['#9fb0a0', '#7c8f80'], particles: 'snow',
  },
];

const FACTS = [
  'Wiewiórki nie zapadają w sen zimowy – w mrozy po prostu przesypiają całe dni w gnieździe.',
  'Wiewiórki zapominają o wielu zakopanych nasionach. Dzięki temu sadzą nowe dęby i leszczyny!',
  'Puszysty ogon to ster przy skokach, parasol w deszczu i kołderka w zimną noc.',
  'Tylne łapy wiewiórki obracają się do tyłu – dlatego schodzi z drzewa głową w dół.',
  'Siekacze wiewiórki rosną przez całe życie, więc musi je ciągle ścierać.',
  'Ruda wiewiórka bywa też niemal czarna – w Polsce ciemne osobniki wcale nie są rzadkie.',
  'Zimą wiewiórce rosną dłuższe pędzelki na uszach.',
  'Sroki rozpoznają się w lustrze – potrafi to bardzo niewiele zwierząt.',
  'Sroki wcale nie kochają błyskotek – badania pokazały, że raczej się ich boją. Orzechy to co innego!',
  'Wiewiórka szara z Ameryki wypiera rudą wiewiórkę w Wielkiej Brytanii i we Włoszech.',
  'Sójka jesienią potrafi ukryć kilka tysięcy żołędzi. Konkurencja nie śpi!',
  'Jamniki wyhodowano do polowań na borsuki. Na wiewiórki polują już tylko z ambicji.',
  'Wiewiórka pospolita jest w Polsce gatunkiem chronionym.',
  'Wiewiórki suszą grzyby, nabijając je na gałązki – to ich zimowa spiżarnia.',
  'Wiewiórki udają, że zakopują orzech, gdy ktoś patrzy – żeby zmylić złodziei!',
];

const LINES = {
  dogChase: ['HAU!', 'WIEWIÓRKA!!!', 'Ja tylko chcę się pobawić!', 'Stój, rudzielcu!', 'Hau hau hau!', 'To mój trawnik!'],
  dogBark: ['Zejdź tu!', 'HAU! HAU!', 'Kiedyś zejdziesz…', 'Czekam tu cały dzień!', 'Hau… zaraz, gdzie ja byłem?'],
  dogDazed: ['Skowyt!', 'Auuu…', 'Kto rzucił?!'],
  dogScared: ['Uciekam!', 'Złoty potwór!', 'Mamoooo!'],
  mopsSleep: ['Zzz…', 'Może jutro…', 'Chrrr…'],
  magpieSteal: ['Kra! Moje!', 'Dziękuję za współpracę!', 'Kra-kra, frajerze!', 'Błyszczy? Nie, ale smaczne!'],
  magpieHit: ['KRAA!', 'Oddaję, oddaję!', 'Moje piórka!'],
  magpieGift: ['Prezent!', 'Kra! Na szczęście!'],
  rival: ['Moje!', 'Ten orzech miał moje imię!', 'Kto pierwszy, ten lepszy!', 'Spadaj, ruda!', 'Mniam!'],
  rivalHit: ['Ej! To moje!', 'Nieładnie!', 'Auć!'],
  rivalEat: ['Mniam mniam…', 'Chrup chrup!', 'Smacznego mnie!'],
  fall: ['Bęc!', 'Auć, mój ogon!', 'Grawitacja 1 : 0 Wiewiórka', 'Nic mi nie jest!'],
  perfect: ['Idealne wybicie!', 'Perfekcyjnie!', 'Jak polatucha!'],
  full: ['Mmmf mmf!', 'Pełne policzki!', 'Nie zmieszczę więcej!'],
  rotten: ['Fuj!', 'Bleee…', 'Kręci mi się w głowie…'],
  hurt: ['Auć!', 'Ratunku!', 'Mój ogon!'],
  gift: ['Fuj! …ale to na szczęście!', 'Ptasia kupa = szczęście! +15'],
  bury: ['Zakopane! (chyba zapomnę)', 'Tu wyrośnie dąb!', 'Sekretny schowek!'],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
