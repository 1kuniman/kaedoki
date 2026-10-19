// 共通：型番の正規化と検索インデックス
(function () {
  var cache = null;
  function norm(s) {
    return (s || '').normalize('NFKC').toUpperCase()
      .replace(/[ー‐-―−－]/g, '-')
      .replace(/\(.*?\)/g, '').replace(/-[A-Z]{1,2}$/, '')
      .replace(/\s+/g, '');
  }
  function bare(s) { return norm(s).replace(/-/g, ''); }
  function load() {
    if (!cache) cache = fetch('/search-index.json').then(function (r) { return r.json(); });
    return cache;
  }
  function find(q, list) {
    var b = bare(q);
    if (!b) return { exact: null, hits: [] };
    var PFX = /^(HD|KI|KC)/;
    var b2 = b.replace(PFX, '');
    var exact = null, starts = [], contains = [];
    list.forEach(function (it) {
      var kb = bare(it.k), kb2 = kb.replace(PFX, '');
      if (kb === b || (PFX.test(kb) && kb2 === b2 && b2.length >= 4)) exact = exact || it;
      else if (kb.indexOf(b) === 0 || kb2.indexOf(b2) === 0) starts.push(it);
      else if (kb.indexOf(b) > -1 || (b2.length >= 3 && kb.indexOf(b2) > -1)) contains.push(it);
    });
    return { exact: exact, hits: starts.concat(contains) };
  }
  window.Kaedoki = { norm: norm, load: load, find: find };

  // 検索ページではヘッダーの入力欄に検索語を残す
  var q = new URLSearchParams(location.search).get('q');
  var box = document.getElementById('q');
  if (q && box) box.value = q;
})();
