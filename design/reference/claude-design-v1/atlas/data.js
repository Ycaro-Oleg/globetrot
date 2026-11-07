// Atlas & Thread — representative data. Prices are illustrative estimates (BRL), not live quotes.
window.AT = window.AT || {};
(function (AT) {
  const C = (name, country, iso, ll, stay, food, region, blurb) => ({ kind: 'city', name, country, iso, ll, stay, food, region, blurb });
  const S = (name, city, cat, cost, state, dur, tip) => ({ kind: 'spot', name, city, cat, cost, state, dur, tip });
  AT.places = {
    saopaulo: C('São Paulo', 'Brazil', '076', [-46.63, -23.55], 0, 0, 'home', 'Home.'),
    tokyo: C('Tokyo', 'Japan', '392', [139.69, 35.69], 295, 180, 'asia', 'Neon, quiet shrines and the best breakfast markets on earth.'),
    hakone: C('Hakone', 'Japan', '392', [139.1, 35.23], 520, 160, 'asia', 'Hot springs, lake views and, on a clear day, Fuji.'),
    kyoto: C('Kyoto', 'Japan', '392', [135.77, 35.01], 373, 180, 'asia', 'Wooden streets, temple gardens and a thousand red gates.'),
    nara: C('Nara', 'Japan', '392', [135.8, 34.68], 240, 140, 'asia', 'Giant Buddha, polite deer. An easy day from Kyoto.'),
    osaka: C('Osaka', 'Japan', '392', [135.5, 34.69], 290, 170, 'asia', 'Japan’s kitchen — loud, friendly, open late.'),
    kanazawa: C('Kanazawa', 'Japan', '392', [136.65, 36.56], 260, 150, 'asia', 'Gardens, gold leaf and smaller crowds.'),
    hiroshima: C('Hiroshima', 'Japan', '392', [132.46, 34.39], 250, 150, 'asia', 'A city of memory, and the island shrine of Miyajima.'),
    lisbon: C('Lisbon', 'Portugal', '620', [-9.14, 38.72], 320, 150, 'europe', 'Seven hills, yellow trams and custard tarts.'),
    porto: C('Porto', 'Portugal', '620', [-8.61, 41.15], 260, 130, 'europe', 'Tiled churches above a river of port lodges.'),
    lagos: C('Lagos', 'Portugal', '620', [-8.67, 37.1], 280, 140, 'europe', 'Golden cliffs on the Algarve coast.'),
    cusco: C('Cusco', 'Peru', '604', [-71.97, -13.53], 180, 90, 'southam', 'Inca stone under colonial roofs, the door to Machu Picchu.'),
    reykjavik: C('Reykjavík', 'Iceland', '352', [-21.9, 64.15], 560, 320, 'europe', 'Northern lights, black beaches, hot pools in the snow.'),
    marrakech: C('Marrakech', 'Morocco', '504', [-7.99, 31.63], 200, 100, 'africa', 'Riads, souks and the Atlas mountains at the edge of town.'),
    buenosaires: C('Buenos Aires', 'Argentina', '032', [-58.38, -34.6], 230, 120, 'southam', 'Long dinners, tango halls, grand avenues.'),
    colonia: C('Colonia', 'Uruguay', '858', [-57.84, -34.47], 200, 110, 'southam', 'A cobbled river town, one ferry away.'),
    montevideo: C('Montevideo', 'Uruguay', '858', [-56.16, -34.9], 220, 120, 'southam', 'A calm capital with a 22 km riverside promenade.'),
    paraty: C('Paraty', 'Brazil', '076', [-44.71, -23.22], 260, 120, 'brazil', 'Colonial streets, green bays and boat days.'),
    amsterdam: C('Amsterdam', 'Netherlands', '528', [4.9, 52.37], 450, 200, 'europe', 'Canals, bikes and very good museums.'),
    berlin: C('Berlin', 'Germany', '276', [13.4, 52.52], 330, 160, 'europe', 'History on every corner, and late nights.'),
    prague: C('Prague', 'Czechia', '203', [14.42, 50.08], 260, 130, 'europe', 'A fairy-tale old town and cheap, excellent beer.'),
    vienna: C('Vienna', 'Austria', '040', [16.37, 48.21], 330, 160, 'europe', 'Coffee houses, palaces and concert halls.'),
    budapest: C('Budapest', 'Hungary', '348', [19.04, 47.5], 230, 120, 'europe', 'Thermal baths on both sides of the Danube.'),
    hanoi: C('Hanoi', 'Vietnam', '704', [105.85, 21.03], 150, 70, 'asia', 'Street food on tiny stools, lakes, motorbikes.'),
    mexico: C('Mexico City', 'Mexico', '484', [-99.13, 19.43], 220, 110, 'americas', 'Tacos, murals and huge, generous museums.'),
    rome: C('Rome', 'Italy', '380', [12.5, 41.9], 380, 170, 'europe', 'Three thousand years, and the best pasta of your life.'),

    tsukiji: S('Tsukiji outer market', 'tokyo', 'food', 60, 'est', '2 h', 'Go before 9am — tamagoyaki on a stick.'),
    sensoji: S('Senso-ji & Asakusa', 'tokyo', 'history', 0, 'conf', '2 h', 'Tokyo’s oldest temple. Free.'),
    meiji: S('Meiji Jingu', 'tokyo', 'history', 0, 'conf', '1.5 h', 'A forest shrine next to Harajuku.'),
    yanaka: S('Yanaka Ginza', 'tokyo', 'food', 40, 'est', '2 h', 'Old-Tokyo shopping street; croquettes.'),
    shibuya: S('Shibuya crossing at night', 'tokyo', 'culture', 0, 'conf', '1 h', 'Watch it from above, then walk it.'),
    lakeashi: S('Lake Ashi cruise', 'hakone', 'nature', 70, 'est', '1.5 h', 'Fuji views on clear mornings.'),
    onsen: S('Evening onsen at the ryokan', 'hakone', 'culture', 0, 'conf', '1 h', 'Included with your stay.'),
    owakudani: S('Ōwakudani valley', 'hakone', 'nature', 25, 'est', '1 h', 'Volcanic steam and black eggs.'),
    inari: S('Fushimi Inari, before 8am', 'kyoto', 'history', 0, 'conf', '2–3 h', 'Wear good shoes. Free.'),
    nishiki: S('Nishiki Market lunch', 'kyoto', 'food', 90, 'est', '1.5 h', 'Grazing; cash helps.'),
    kiyomizu: S('Kiyomizu-dera & Sannenzaka', 'kyoto', 'history', 20, 'est', '2 h', 'Temple entry; go at sunset.'),
    arashiyama: S('Arashiyama bamboo grove', 'kyoto', 'nature', 0, 'conf', '2 h', 'Arrive early to have it quiet.'),
    pontocho: S('Dinner along Pontochō', 'kyoto', 'food', 150, 'unk', '2 h', 'Price depends on where you sit.'),
    todaiji: S('Tōdai-ji & deer park', 'nara', 'history', 25, 'est', '3 h', '45 min by train from Kyoto.'),
    dotonbori: S('Dotonbori street food', 'osaka', 'food', 80, 'est', '2 h', 'Takoyaki, okonomiyaki, kushikatsu.'),
    kuromon: S('Kuromon market', 'osaka', 'food', 70, 'est', '1.5 h', '“Osaka’s kitchen.”'),
    castle: S('Osaka Castle park', 'osaka', 'history', 25, 'est', '2 h', 'Best in cherry-blossom season.'),
    kenrokuen: S('Kenroku-en garden', 'kanazawa', 'nature', 15, 'est', '2 h', 'One of Japan’s three great gardens.'),
    alfama: S('Alfama & tram 28', 'lisbon', 'culture', 20, 'est', '3 h', 'Get lost on purpose.'),
    belem: S('Pastéis de Belém', 'lisbon', 'food', 15, 'est', '1 h', 'The original custard tarts.'),
    ribeira: S('Ribeira & port cellars', 'porto', 'food', 90, 'est', '3 h', 'Tastings across the bridge in Gaia.'),
    ponta: S('Ponta da Piedade by kayak', 'lagos', 'nature', 160, 'est', '2.5 h', 'Sea caves and golden cliffs.'),
    sacred: S('Sacred Valley day', 'cusco', 'history', 260, 'est', 'Full day', 'Pisac and Ollantaytambo.'),
    lagoon: S('Hot pools & northern lights', 'reykjavik', 'nature', 380, 'est', 'Evening', 'Aurora is never guaranteed.'),
    souk: S('Medina souks & a riad dinner', 'marrakech', 'culture', 120, 'est', 'Half day', 'Bargaining is expected.'),
    boats: S('Boat day around the bays', 'paraty', 'nature', 120, 'est', 'Full day', 'Schooners leave from the pier at 10.'),
    centro: S('Centro Histórico walk', 'paraty', 'history', 0, 'conf', '2 h', 'Wear sandals — the stones flood at high tide.')
  };
  AT.cats = { food: 'Food', history: 'Historic', nature: 'Nature', culture: 'Culture' };
  AT.flights = { asia: 6200, europe: 4600, southam: 1800, americas: 3200, africa: 4300, brazil: 180 };
  AT.legs = {
    'tokyo>hakone': 'Odakyu Romancecar · ≈ 85 min', 'hakone>kyoto': 'Shinkansen from Odawara · ≈ 2 h 10',
    'kyoto>osaka': 'JR Special Rapid · ≈ 30 min', 'kyoto>nara': 'Kintetsu line · ≈ 45 min', 'kyoto>kanazawa': 'Thunderbird + Shinkansen · ≈ 2 h 10',
    'kanazawa>osaka': 'Shinkansen + Thunderbird · ≈ 2 h 40', 'tokyo>kyoto': 'Shinkansen · ≈ 2 h 15', 'porto>lisbon': 'Alfa Pendular · ≈ 3 h',
    'lisbon>lagos': 'Train via Tunes · ≈ 4 h', 'buenosaires>colonia': 'Ferry · ≈ 1 h 15', 'colonia>montevideo': 'Bus · ≈ 2 h 45'
  };
  AT.expCats = [
    ['flights', 'Flights'], ['stay', 'Places to sleep'], ['transit', 'Trains & local transport'], ['food', 'Food'],
    ['exp', 'Experiences'], ['docs', 'Insurance & documents'], ['buffer', 'Emergency buffer'], ['other', 'Other']
  ];
  AT.rates = { BRL: 1, USD: 0.18, EUR: 0.165, JPY: 27.5 };
  const fmts = {
    BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    EUR: new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 })
  };
  AT.money = (brl, cur = 'BRL') => fmts[cur].format(Math.round(brl * AT.rates[cur] / (cur === 'JPY' ? 100 : 1)) * (cur === 'JPY' ? 100 : 1)).replace(/\u00a0/g, ' ');

  AT.examples = [
    { id: 'japan10', title: 'Ten days in Japan', short: 'Japan', start: '2027-04-03', stops: [['tokyo', 4], ['hakone', 1], ['kyoto', 3], ['osaka', 2]], blurb: 'A first time abroad, planned around food and very old wood.', tag: 'First time abroad' },
    { id: 'portugal7', title: 'Seven days in Portugal', short: 'Portugal', start: '2027-05-14', stops: [['porto', 2], ['lisbon', 3], ['lagos', 2]], blurb: 'Trains only. Port cellars, tiled stairways, a beach day at the end.', tag: 'By train' },
    { id: 'euro14', title: 'Five capitals by rail', short: 'Central Europe', start: '2027-07-02', stops: [['amsterdam', 3], ['berlin', 3], ['prague', 3], ['vienna', 2], ['budapest', 3]], blurb: 'A backpacking classic — night trains optional, hostels encouraged.', tag: 'Backpacking' },
    { id: 'plata6', title: 'A first trip across the river', short: 'Río de la Plata', start: '2027-03-12', stops: [['buenosaires', 3], ['colonia', 1], ['montevideo', 2]], blurb: 'One border, one ferry, a great deal of empanadas.', tag: 'Close to home' },
    { id: 'paraty2', title: 'A weekend in Paraty', short: 'Paraty', start: '2027-01-22', stops: [['paraty', 2]], blurb: 'Cobblestones and boat days, a bus ride from São Paulo.', tag: 'Budget weekend' }
  ];

  let uid = 1; AT.uid = (p = 'x') => p + (uid++) + Math.random().toString(36).slice(2, 5);

  AT.spotsFor = city => Object.entries(AT.places).filter(([, p]) => p.kind === 'spot' && p.city === city).map(([id]) => id);

  // Build a trip from a list of [cityId, nights]; everything is an estimate until the user confirms.
  AT.buildTrip = (title, start, stopList, opts = {}) => {
    const stops = stopList.map(([city, nights]) => ({ id: AT.uid('s'), city, nights, status: opts.draft ? 'draft' : 'planned', places: AT.spotsFor(city).slice(0, opts.full ? 3 : 0).map(pid => ({ id: AT.uid('p'), pid, day: null, done: false })), notes: [] }));
    const region = AT.places[stopList[0][0]].region;
    const nightsTotal = stopList.reduce((a, s) => a + s[1], 0);
    const exp = [];
    exp.push({ id: AT.uid('e'), label: region === 'brazil' ? 'Bus São Paulo ⇄ Paraty' : 'Flights from São Paulo', cat: 'flights', stop: null, amount: AT.flights[region], state: 'est', src: opts.src || 'user' });
    stops.forEach(s => { const p = AT.places[s.city]; exp.push({ id: AT.uid('e'), label: `${p.name} stay, ${s.nights} night${s.nights > 1 ? 's' : ''}`, cat: 'stay', stop: s.id, amount: p.stay * s.nights, state: 'est', src: opts.src || 'user' }); });
    const foodDay = stops.reduce((a, s) => a + AT.places[s.city].food * s.nights, 0);
    exp.push({ id: AT.uid('e'), label: 'Food & snacks', cat: 'food', stop: null, amount: Math.round(foodDay / 10) * 10, state: 'est', src: opts.src || 'user' });
    exp.push({ id: AT.uid('e'), label: 'Trains, metro & buses', cat: 'transit', stop: null, amount: region === 'asia' ? 1250 : Math.max(120, nightsTotal * 60), state: 'est', src: opts.src || 'user' });
    exp.push({ id: AT.uid('e'), label: 'Travel insurance', cat: 'docs', stop: null, amount: Math.max(90, nightsTotal * 38), state: 'est', src: opts.src || 'user' });
    exp.push({ id: AT.uid('e'), label: 'Emergency buffer', cat: 'buffer', stop: null, amount: Math.max(150, Math.round(nightsTotal * 40 / 50) * 50), state: 'est', src: opts.src || 'user' });
    return { id: AT.uid('t'), title, start, stops, expenses: exp, savings: { saved: 0, monthly: 800 }, checklist: AT.defaultChecklist(region === 'brazil'), created: Date.now() };
  };

  AT.defaultChecklist = (domestic) => {
    const L = (group, label, done = false) => ({ id: AT.uid('c'), group, label, done });
    return [
      ...(domestic ? [L('docs', 'ID card in your bag')] : [L('docs', 'Passport valid 6+ months after you return'), L('docs', 'Check visa rules on the official government site'), L('docs', 'Buy travel insurance')]),
      L('money', 'Tell your bank you’re travelling'), L('money', 'A card without foreign-transaction fees'),
      L('book', 'Flights or transport booked'), L('book', 'First night booked'),
      L('pack', 'Plug adapter'), L('pack', 'Comfortable walking shoes')
    ];
  };

  // The richly-filled demo trip used for new accounts that pick Japan, and for the guided tour.
  AT.demoJapan = () => {
    const t = AT.buildTrip('Ten days in Japan', '2027-04-03', [['tokyo', 4], ['hakone', 1], ['kyoto', 3], ['osaka', 2]]);
    const [tk, hk, ky, os] = t.stops;
    const P = (pid, day, done = false) => ({ id: AT.uid('p'), pid, day, done });
    tk.places = [P('tsukiji', 2, true), P('sensoji', 1), P('yanaka', 3), P('shibuya', 1)];
    hk.places = [P('onsen', 5), P('lakeashi', null)];
    ky.places = [P('inari', 6, true), P('nishiki', 6, true), P('kiyomizu', 7), P('todaiji', null), P('pontocho', null)];
    os.places = [P('dotonbori', 9)];
    tk.notes = [{ id: AT.uid('n'), text: 'Breakfast is tamagoyaki on a stick.' }];
    hk.notes = [{ id: AT.uid('n'), text: 'Onsen night — book early, April fills up.' }];
    t.expenses = [
      { id: AT.uid('e'), label: 'Flights GRU ⇄ Japan, via a Gulf hub', cat: 'flights', stop: null, amount: 6200, state: 'est', src: 'user' },
      { id: AT.uid('e'), label: 'Hotel in Asakusa, 4 nights', cat: 'stay', stop: tk.id, amount: 1180, state: 'est', src: 'user' },
      { id: AT.uid('e'), label: 'Ryokan with onsen, 1 night', cat: 'stay', stop: hk.id, amount: 520, state: 'est', src: 'user' },
      { id: AT.uid('e'), label: 'Ryokan Hanami, 3 nights', cat: 'stay', stop: ky.id, amount: 1120, state: 'conf', src: 'user' },
      { id: AT.uid('e'), label: 'Trains, metro & buses', cat: 'transit', stop: null, amount: 1250, state: 'est', src: 'user' },
      { id: AT.uid('e'), label: 'Food & snacks', cat: 'food', stop: null, amount: 1800, state: 'est', src: 'user' },
      { id: AT.uid('e'), label: 'Temples, cruises & entries', cat: 'exp', stop: null, amount: 850, state: 'est', src: 'user' },
      { id: AT.uid('e'), label: 'Travel insurance', cat: 'docs', stop: null, amount: 380, state: 'paid', src: 'user' },
      { id: AT.uid('e'), label: 'Emergency buffer', cat: 'buffer', stop: null, amount: 400, state: 'est', src: 'user' }
    ];
    t.savings = { saved: 6400, monthly: 1500 };
    const L = (group, label, done = false) => ({ id: AT.uid('c'), group, label, done });
    t.checklist = [
      L('docs', 'Passport valid until after October 2027'), L('docs', 'Check visa rules on the official government site'), L('docs', 'Buy travel insurance', true),
      L('money', 'Tell your bank you’re travelling'), L('money', 'Get some yen in cash for markets'), L('money', 'A card without foreign-transaction fees', true),
      L('book', 'Flights booked'), L('book', 'Kyoto ryokan booked', true), L('book', 'Hakone ryokan booked'),
      L('pack', 'Plug adapter (type A)'), L('pack', 'Comfortable walking shoes', true), L('pack', 'Small towel for the onsen')
    ];
    return t;
  };
  AT.dreams = () => [
    { id: AT.uid('d'), city: 'lisbon', label: 'Lisbon & Porto' },
    { id: AT.uid('d'), city: 'cusco', label: 'Cusco' },
    { id: AT.uid('d'), city: 'reykjavik', label: 'Reykjavík, in winter' }
  ];
})(window.AT);
