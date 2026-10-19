// トップの検索窓：入力中に候補を出す（↑↓で選択、Enterで移動）
(function () {
  var input = document.querySelector('[data-suggest]');
  var box = document.querySelector('[data-suggest-list]');
  if (!input || !box || !window.Kaedoki) return;
  var items = [], sel = -1;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render() {
    if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = items.map(function (h, i) {
      return '<li><a href="' + h.u + '"' + (i === sel ? ' aria-selected="true"' : '') + '><span class="k">' + esc(h.k) + '</span><span class="s">' + esc(h.s) + '</span></a></li>';
    }).join('');
    box.hidden = false;
  }
  input.addEventListener('input', function () {
    var v = input.value;
    if (Kaedoki.norm(v).length < 2) { items = []; sel = -1; render(); return; }
    Kaedoki.load().then(function (list) {
      var r = Kaedoki.find(v, list);
      items = (r.exact ? [r.exact] : []).concat(r.hits).slice(0, 12);
      sel = -1; render();
    });
  });
  input.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, -1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && sel > -1) { location.href = items[sel].u; e.preventDefault(); }
    else if (e.key === 'Escape') { items = []; render(); }
  });
  document.addEventListener('click', function (e) { if (!box.contains(e.target) && e.target !== input) { box.hidden = true; } });
})();
