// Pip — the companion. Built from simple shapes as a stand-in for the commissioned Rive character.
window.AT = window.AT || {};
AT.pip = function (pose = 'idle', size = 96, extra = '') {
  const G = document.documentElement.dataset.brand === 'globetrot';
  const ink = G ? 'var(--line)' : 'var(--ink)', card = 'var(--card)', brass = 'var(--brass)', thread = 'var(--thread)', note = 'var(--note)';
  const hatC = G ? thread : brass, caseC = G ? brass : thread;
  const S = `fill="none" style="stroke:${ink}" stroke-width="${G ? 3.2 : 2.6}" stroke-linecap="round" stroke-linejoin="round"`;
  const look = { research: 'translate(3 3)', draft: 'translate(0 3)', unsure: 'translate(-2 -1)', celebrate: 'translate(0 -1)' }[pose] || '';
  const mouth = pose === 'unsure' ? 'M62 94 L74 93' : pose === 'celebrate' ? 'M59 90 Q68 101 77 90' : 'M61 92 Q68 98 75 92';
  const legs = pose === 'deliver' ? '' : `<path d="M58 116 L56 137 M80 116 L82 137"/><path d="M49 138 h10 M79 138 h10"/>`;
  const caseG = (pose === 'deliver' || pose === 'celebrate') ? '' : `<rect x="98" y="104" width="30" height="24" rx="${G ? 6 : 4}" style="fill:${caseC}"/>${G ? '<circle cx="108" cy="114" r="3.4" style="fill:var(--thread)" stroke-width="1.6"/><rect x="115" y="117" width="9" height="6" rx="1.5" style="fill:var(--mint)" stroke-width="1.6"/>' : ''}<path d="M106 104 v-5 h14 v5"/><path d="M102 92 Q110 98 112 99"/>`;
  const props = {
    research: `<g class="prop"><path d="M84 96 L104 90 L124 96 L144 90 L144 118 L124 124 L104 118 L84 124 Z" style="fill:${note}"/><path d="M104 90 V118 M124 96 V124" stroke-width="1.4"/><path d="M92 108 Q104 100 114 110 T136 104" style="stroke:${thread}" stroke-width="1.6" stroke-dasharray="2 3"/></g>`,
    draft: `<g class="prop"><rect x="86" y="96" width="30" height="22" transform="rotate(-14 101 107)" style="fill:${card}"/><rect x="104" y="98" width="30" height="22" transform="rotate(4 119 109)" style="fill:${note}"/><rect x="120" y="94" width="30" height="22" transform="rotate(16 135 105)" style="fill:${card}"/><circle cx="135" cy="104" r="3" style="fill:${thread};stroke:none"/></g>`,
    deliver: `<path d="M6 132 L156 108 L118 140 Z" style="fill:${card}"/><path d="M118 140 L104 124 L156 108" stroke-width="1.6"/>`,
    celebrate: `<path d="M100 80 Q112 64 116 50" /><rect x="106" y="30" width="22" height="12" rx="2" style="fill:${brass}"/><rect x="113" y="20" width="8" height="10" rx="2" style="fill:${ink}"/><circle cx="34" cy="46" r="2.5" style="fill:${thread};stroke:none"/><circle cx="22" cy="62" r="2" style="fill:${brass};stroke:none"/><circle cx="128" cy="62" r="2" style="fill:${thread};stroke:none"/>`,
    unsure: `<g class="prop"><path d="M88 100 L106 95 L124 100 L124 122 L106 127 L88 122 Z" style="fill:${note}"/><path d="M106 95 V127" stroke-width="1.4"/></g><text x="112" y="44" style="fill:${thread};font:italic 600 30px var(--serif);stroke:none">?</text>`,
    idle: ''
  }[pose] || '';
  const cls = pose === 'deliver' ? 'pip fly' : pose === 'celebrate' ? 'pip cheer' : 'pip';
  return `<svg class="${cls}" viewBox="0 0 160 150" width="${size}" height="${Math.round(size * 150 / 160)}" aria-hidden="true" ${extra}>
  <ellipse cx="70" cy="144" rx="32" ry="4" style="fill:var(--rule)"/>
  <g class="body" ${S}>${pose === 'deliver' ? props : ''}${legs}${caseG}
    ${G ? `<circle cx="68" cy="82" r="39" style="fill:var(--blue)"/><path d="M36 70 Q48 60 60 67 Q67 73 61 80 Q52 86 43 82 Q34 78 36 70 Z M82 94 Q93 88 99 96 Q101 105 92 107 Q82 105 82 94 Z" style="fill:var(--mint)" stroke-width="2.4"/>
    <g style="stroke:none"><ellipse cx="56" cy="80" rx="7.5" ry="8.5" fill="#fff"/><ellipse cx="80" cy="80" rx="7.5" ry="8.5" fill="#fff"/></g>
    <g class="eyes" style="stroke:none;fill:#1D1A35" transform="${look}"><ellipse class="eye" cx="57.5" cy="81.5" rx="3.6" ry="4.4"/><ellipse class="eye" cx="81.5" cy="81.5" rx="3.6" ry="4.4"/></g>` : `<circle cx="68" cy="82" r="38" style="fill:${card}"/>
    <ellipse cx="68" cy="82" rx="16" ry="38" stroke-width="1" opacity=".4"/><path d="M30 82 h76 M36 64 Q68 71 100 64 M36 100 Q68 93 100 100" stroke-width="1" opacity=".4"/>
    <g class="eyes" style="stroke:none;fill:${ink}" transform="${look}"><ellipse class="eye" cx="56" cy="80" rx="3.4" ry="4.4"/><ellipse class="eye" cx="80" cy="80" rx="3.4" ry="4.4"/></g>`}
    ${pose === 'unsure' ? '<path d="M50 70 l10 -2 M76 68 l10 2" stroke-width="2"/>' : ''}
    <path d="${mouth}"${G ? ' style="stroke:#1D1A35"' : ''}/>
    <g class="hat"><ellipse cx="68" cy="46" rx="${G ? 40 : 35}" ry="${G ? 8 : 6.5}" style="fill:${hatC}"/><path d="M${G ? 47 : 50} 45 Q${G ? 47 : 50} 22 68 22 Q${G ? 89 : 86} 22 ${G ? 89 : 86} 45 Z" style="fill:${hatC}"/><path d="M51 38 Q68 ${G ? 44 : 38} 85 38" stroke-width="${G ? 3.5 : 4}" style="stroke:${G ? 'var(--paper)' : ink}"/></g>
    ${pose !== 'deliver' ? props : ''}
  </g></svg>`;
};
AT.pipLines = {
  idle: 'Pip is here if you need a hand.',
  research: 'Pip is unfolding the map…',
  draft: 'Pip is laying out postcards…',
  deliver: 'Pip is flying it over…',
  celebrate: 'Stamped!',
  unsure: 'Pip isn’t sure about that one.'
};
