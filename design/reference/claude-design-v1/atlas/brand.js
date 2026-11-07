// Brand switch: <html data-brand="globetrot"> swaps copy, storage and a few drawings. Default is Atlas & Thread.
window.AT = window.AT || {};
(function () {
  const G = document.documentElement.dataset.brand === 'globetrot';
  AT.B = G ? {
    id: 'globetrot', key: 'globetrot-v1', name: 'Globetrot',
    wm: sz => `<span class="wm gwm" style="font-size:${sz}px">gl<span class="o"></span>betrot</span>`,
    mini: '<span class="gwm" style="font-size:22px">g<span class="o"></span></span>',
    next: 'Next stamps', night: 'Red-eye mode: deep indigo and the same stamp colours, made for evening planning.',
    authH: 'Your first <em>stamp</em> is closer than you think.', inked: 'stamped onto your trip'
  } : {
    id: 'atlas', key: 'atlas-thread-v1', name: 'Atlas & Thread',
    wm: sz => `<span class="wm" style="font-size:${sz}px">Atlas <em>&amp;</em> Thread</span>`,
    mini: 'A<em>&amp;</em>T', next: 'Next knots', night: 'Night Atlas is designed for evenings, not inverted.',
    authH: 'Someday<br>has <em style="color:var(--thread)">coordinates.</em>', inked: 'inked onto your board'
  };
})();
