/* Design-only fixture. No data is saved and no exchange rate is real. */
const copy = {
  en: {
    screens: ['Trips', 'Language & region', 'Expense', 'Passport', 'Mobile navigation'],
    brand: 'globetrot',
    notice: 'Illustrative example',
    create: 'Create trip',
    trips: 'Your trips',
    filter: 'All · Active · Traveling · Completed · Archived',
    open: 'Open trip',
    active: 'Active',
    completed: 'Completed',
    name1: 'Japan in spring',
    name2: 'A weekend in Lisbon',
    settings: 'Language & region',
    lang: 'Display language',
    currency: 'Preferred currency',
    home: 'Home country',
    nationality: 'Nationality',
    timezone: 'Time zone',
    units: 'Units',
    unset: 'Not specified',
    language: 'English',
    us: 'US dollar (USD)',
    metric: 'Metric',
    independent: 'Language, currency and country are independent. USD is the default.',
    save: 'Save changes',
    cancel: 'Cancel',
    expense: 'Add an expense',
    name: 'Expense name',
    expname: 'Museum visit',
    category: 'Category',
    categoryvalue: 'Experiences',
    scope: 'Belongs to',
    wholet: 'Whole trip',
    amount: 'Original amount',
    originalcurrency: 'Original currency',
    status: 'Status',
    estimate: '≈ Estimate',
    conversion: 'Conversion preview',
    converted: 'Trip currency amount',
    rate: 'Illustrative rate · 1 USD = 150 JPY',
    source: 'Source: example only · Date: example',
    mode: 'Rate mode',
    live: 'Live',
    locked: 'Locked',
    manual: 'Manual',
    disclaimer: 'Indicative example; not a bank quote.',
    passport: 'Your passport',
    decorative: 'Decorative — not an official document.',
    places: 'Place stamps',
    declared: 'Self-declared',
    visa: 'Trip visa pages',
    visa1: 'Japan in spring · 4 of 9 stamps',
    stamps: 'Trip readiness',
    earned: '✓ Destination added',
    pending: '○ Save 10% of budget',
    view: 'View visa page',
    board: 'Board',
    days: 'Days',
    budget: 'Budget',
    lists: 'Lists',
    more: 'More',
    ask: 'Ask Pip',
    boardtitle: 'Japan in spring',
    prompt: 'Your board, your journey.',
    detail: 'Add places, connect stops and plan at your own pace.',
    privacy: 'Private trip',
    next: 'Add a stop',
    usd: 'USD',
    jpy: 'JPY',
  },
  'pt-BR': {
    screens: ['Viagens', 'Idioma e região', 'Despesa', 'Passaporte', 'Navegação móvel'],
    brand: 'globetrot',
    notice: 'Exemplo ilustrativo',
    create: 'Criar viagem',
    trips: 'Suas viagens',
    filter: 'Todas · Ativas · Em viagem · Concluídas · Arquivadas',
    open: 'Abrir viagem',
    active: 'Ativa',
    completed: 'Concluída',
    name1: 'Japão na primavera',
    name2: 'Um fim de semana em Lisboa',
    settings: 'Idioma e região',
    lang: 'Idioma de exibição',
    currency: 'Moeda preferida',
    home: 'País de residência',
    nationality: 'Nacionalidade',
    timezone: 'Fuso horário',
    units: 'Unidades',
    unset: 'Não informado',
    language: 'Português (Brasil)',
    us: 'Dólar americano (USD)',
    metric: 'Métrico',
    independent: 'Idioma, moeda e país são independentes. A moeda padrão é USD.',
    save: 'Salvar alterações',
    cancel: 'Cancelar',
    expense: 'Adicionar despesa',
    name: 'Nome da despesa',
    expname: 'Visita ao museu',
    category: 'Categoria',
    categoryvalue: 'Experiências',
    scope: 'Pertence a',
    wholet: 'Viagem inteira',
    amount: 'Valor original',
    originalcurrency: 'Moeda original',
    status: 'Status',
    estimate: '≈ Estimativa',
    conversion: 'Prévia da conversão',
    converted: 'Valor na moeda da viagem',
    rate: 'Taxa ilustrativa · 1 USD = 150 JPY',
    source: 'Fonte: apenas exemplo · Data: exemplo',
    mode: 'Modo da taxa',
    live: 'Ao vivo',
    locked: 'Fixada',
    manual: 'Manual',
    disclaimer: 'Exemplo indicativo; não é uma cotação bancária.',
    passport: 'Seu passaporte',
    decorative: 'Decorativo — não é um documento oficial.',
    places: 'Carimbos de lugares',
    declared: 'Declarado por você',
    visa: 'Páginas das viagens',
    visa1: 'Japão na primavera · 4 de 9 carimbos',
    stamps: 'Preparação da viagem',
    earned: '✓ Destino adicionado',
    pending: '○ Economizar 10% do orçamento',
    view: 'Ver página da viagem',
    board: 'Mapa',
    days: 'Dias',
    budget: 'Orçamento',
    lists: 'Listas',
    more: 'Mais',
    ask: 'Perguntar ao Pip',
    boardtitle: 'Japão na primavera',
    prompt: 'Seu mapa, sua viagem.',
    detail: 'Adicione lugares, conecte paradas e planeje no seu ritmo.',
    privacy: 'Viagem privada',
    next: 'Adicionar parada',
    usd: 'USD',
    jpy: 'JPY',
  },
};
const $ = (id) => document.getElementById(id);
const screen = $('screen');
const locale = $('locale');
const theme = $('theme');
const viewport = $('viewport');
const stage = $('stage');
let chosenScreen = 0;

const field = (label, value) =>
  `<div class="field"><span>${label}</span><span class="input">${value}</span></div>`;
const button = (label, cls = '') => `<button type="button" class="btn ${cls}">${label}</button>`;
const nav = (t) =>
  `<nav class="tabbar" aria-label="${t.more}"><span>${t.board}</span><span>${t.days}</span><span>${t.budget}</span><span>${t.lists}</span><span>${t.more}</span></nav><button class="pip" type="button">${t.ask}</button>`;
const trips = (t) =>
  `<div class="title"><h1>${t.trips}</h1>${button(t.create)}</div><p class="filters">${t.filter}</p><div class="grid"><article class="card"><div class="mark">${t.active}</div><h2>${t.name1}</h2><p>Tokyo · Kyoto · Osaka</p>${button(t.open, 'ghost')}</article><article class="card"><div class="mark">${t.completed}</div><h2>${t.name2}</h2><p>Lisboa</p>${button(t.open, 'ghost')}</article></div>`;
const settings = (t) =>
  `<div class="title"><h1>${t.settings}</h1></div><div class="card narrow"><p>${t.independent}</p><div class="formgrid">${field(t.lang, t.language)}${field(t.currency, t.us)}${field(t.home, t.unset)}${field(t.nationality, t.unset)}${field(t.timezone, 'America/Sao_Paulo')}${field(t.units, t.metric)}</div><div class="actions">${button(t.save)}${button(t.cancel, 'ghost')}</div></div>`;
const expense = (t) =>
  `<div class="title"><h1>${t.expense}</h1></div><div class="card narrow"><div class="formgrid">${field(t.name, t.expname)}${field(t.category, t.categoryvalue)}${field(t.scope, t.wholet)}${field(t.status, t.estimate)}${field(t.amount, new Intl.NumberFormat(locale.value).format(3000))}${field(t.originalcurrency, t.jpy)}</div><section class="conversion"><h2>${t.conversion}</h2><strong>${t.converted}: ${new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD' }).format(20)}</strong><p>${t.rate}<br />${t.source}</p><p>${t.disclaimer}</p>${field(t.mode, `${t.live} · ${t.locked} · ${t.manual}`)}</section><div class="actions">${button(t.save)}${button(t.cancel, 'ghost')}</div></div>`;
const passport = (t) =>
  `<div class="title"><h1>${t.passport}</h1></div><p class="disclaimer">${t.decorative}</p><div class="grid"><section class="card"><h2>${t.places}</h2><div class="stamp">TOKYO<br /><small>${t.declared}</small></div></section><section class="card"><h2>${t.visa}</h2><p>${t.visa1}</p><h3>${t.stamps}</h3><p>${t.earned}</p><p>${t.pending}</p>${button(t.view, 'ghost')}</section></div>`;
const board = (t) =>
  `<div class="title"><h1>${t.boardtitle}</h1><span>${t.privacy}</span></div><div class="map"><div class="mapcard"><h2>${t.prompt}</h2><p>${t.detail}</p>${button(t.next)}</div></div>`;
const pages = [trips, settings, expense, passport, board];
function render() {
  const t = copy[locale.value];
  document.documentElement.lang = locale.value;
  const options = t.screens.map((name, i) => `<option value="${i}">${name}</option>`).join('');
  screen.innerHTML = options;
  screen.value = String(chosenScreen);
  const isPhone = viewport.value === 'phone';
  stage.innerHTML = `<div class="frame ${isPhone ? 'phone' : 'desktop'}" data-theme="${theme.value}"><aside class="rail"><strong>${t.brand}</strong><p>${t.trips}</p><p>${t.board}</p><p>${t.budget}</p><p>${t.passport}</p><p>${t.settings}</p></aside><div class="body"><header class="top"><strong>${t.brand}</strong><span>${t.notice}</span></header><div class="content">${pages[chosenScreen](t)}</div>${isPhone ? nav(t) : ''}</div></div>`;
}
screen.addEventListener('change', () => {
  chosenScreen = Number(screen.value);
  render();
});
for (const control of [locale, theme, viewport]) control.addEventListener('change', render);
render();
