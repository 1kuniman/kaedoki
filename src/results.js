// 検索結果ページ：完全一致なら機種ページへ移動、それ以外は候補を一覧表示
(function () {
  var out = document.querySelector('[data-search-results]');
  if (!out || !window.Kaedoki) return;
  var q = new URLSearchParams(location.search).get('q') || '';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  if (!q.trim()) { out.innerHTML = '<p>型番または部品番号を入力してください。</p>'; return; }
  Kaedoki.load().then(function (list) {
    var r = Kaedoki.find(q, list);
    if (r.exact) { location.replace(r.exact.u); return; }
    if (!r.hits.length) {
      out.innerHTML = '<p>「' + esc(q) + '」に一致する型番は見つかりませんでした。</p>' +
        '<ul class="notes"><li>本体シールの型番を末尾まで入力してください（例：HD-RXT524E4）。</li>' +
        '<li>収録しているのは現在ダイニチの加湿器、シャープ・パナソニックの加湿空気清浄機です。</li>' +
        '<li>メーカーの部品供給が終わった古い機種は掲載していません。</li></ul>' +
        '<p><a href="/dainichi/">ダイニチの機種一覧</a>・<a href="/sharp/">シャープ</a>・<a href="/panasonic/">パナソニック</a>の機種一覧から探す</p>';
      return;
    }
    var hits = r.hits.slice(0, 60);
    out.innerHTML = '<p>「' + esc(q) + '」の候補：' + r.hits.length + '件' + (r.hits.length > 60 ? '（先頭60件を表示）' : '') + '</p>' +
      '<ul class="result-list">' + hits.map(function (h) {
        return '<li><a class="k" href="' + h.u + '">' + esc(h.k) + '</a><span class="s">' + (h.t === 'p' ? '部品：' : '') + esc(h.s) + '</span></li>';
      }).join('') + '</ul>';
  }).catch(function () { out.innerHTML = '<p>検索データを読み込めませんでした。<a href="/dainichi/">機種一覧</a>から探してください。</p>'; });
})();
