/* MVM Browser animated SVG icon pack — core browser controls from the supplied pack. */
(function (global) {
  "use strict";
  const common = '<style>.base{opacity:.45}.comet{stroke-dasharray:7 93;stroke-width:2.6;animation:comet 2.4s linear infinite;filter:drop-shadow(0 0 1.5px currentColor)}@keyframes comet{to{stroke-dashoffset:-100}}.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{50%{transform:scale(1.12)}}.move{transform-box:fill-box;transform-origin:center;animation:move 1.2s ease-in-out infinite}@keyframes move{50%{transform:translateX(-2px)}}.drop{transform-box:fill-box;transform-origin:center;animation:drop 1.2s ease-in-out infinite}@keyframes drop{50%{transform:translateY(2px)}}.blink{animation:blink 1.2s ease-in-out infinite}@keyframes blink{50%{opacity:.2}}@media(prefers-reduced-motion:reduce){*{animation:none!important}.comet{display:none}.base{opacity:1}}</style>';
  const paths = {
    "mvm-back": '<g class="move"><path class="base" d="M20 12H6M11 6l-5 6 5 6"/><path class="comet" pathLength="100" d="M20 12H6M11 6l-5 6 5 6"/></g>',
    "mvm-forward": '<path class="base" d="M4 12h14M13 6l5 6-5 6"/><path class="comet" pathLength="100" d="M4 12h14M13 6l5 6-5 6"/>',
    "mvm-home": '<path class="base" d="M12 3l9 8h-2v9H5v-9H3z"/><path d="M10 20v-5h4v5"/><path class="blink" d="M7.5 13.5h2"/><path class="comet" pathLength="100" d="M12 3l9 8h-2v9H5v-9H3z"/>',
    "mvm-tabs": '<path class="base" d="M4 4h12l4 4v12H4z"/><path class="pulse" d="M9 9h5l-3 3.2 3 3.2H9"/><path class="comet" pathLength="100" d="M4 4h12l4 4v12H4z"/>',
    "mvm-tab-new": '<path class="base" d="M4 4h12l4 4v12H4z"/><path class="pulse" d="M12 9v6M9 12h6"/><path class="comet" pathLength="100" d="M4 4h12l4 4v12H4z"/>',
    "mvm-search": '<path class="base" d="M8 4h6l3 3v6l-3 3H8l-3-3V7z"/><path d="M16 16l5 5M8 10h6"/><path class="comet" pathLength="100" d="M8 4h6l3 3v6l-3 3H8l-3-3V7z"/>',
    "mvm-bookmark": '<path class="base" d="M6 3h12v18l-6-4-6 4z"/><path class="pulse" d="M12 7v4M10 9h4"/><path class="comet" pathLength="100" d="M6 3h12v18l-6-4-6 4z"/>',
    "mvm-download": '<path class="base" d="M4 16v4h16v-4"/><g class="drop"><path d="M12 3v10M8 9l4 4 4-4"/></g><path class="comet" pathLength="100" d="M4 16v4h16v-4"/>',
    "mvm-history": '<path class="base" d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4M12 8v4l3 2"/><path class="comet" pathLength="100" d="M4 12a8 8 0 1 0 2.5-5.8"/>',
    "mvm-shield-safe": '<path class="base" d="M12 2.5l8 3v7l-3 5-5 4-5-4-3-5v-7z"/><path d="M8.5 12l2.5 2.5 4.5-5"/><path class="comet" pathLength="100" d="M12 2.5l8 3v7l-3 5-5 4-5-4-3-5v-7z"/>'
  };
  global.MVM_ICONS = Object.freeze(paths);
  global.mvmIcon = function (name, size) {
    const body = paths[name];
    if (!body) return "";
    const n = Math.max(12, Math.min(96, Number(size) || 24));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + n + '" height="' + n + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' + name + '">' + common + body + '</svg>';
  };
})(window);
