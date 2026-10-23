// 共通：型番の正規化と検索インデックス
(function () {
  var cache = null;
  function norm(s) {
    return (s || '').normalize('NFKC').toUpperCase()
      .replace(/[ー‐-―−－]/g, '-')
      .replace(/\(.*?\)/g, '').replace(/-(W|T|H|K|B|C|S|N|A|R|TM|WK)$/, '')
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
    var PFX = /^(HD|KI|KC|FU|FP|F)/;
    var b2 = b.replace(PFX, '');
    var exact = null, loose = [], starts = [], contains = [];
    list.forEach(function (it) {
      var kb = bare(it.k), kb2 = kb.replace(PFX, '');
      if (kb === b) exact = exact || it;
      else if (PFX.test(kb) && kb2 === b2 && b2.length >= 4) loose.push(it);
      else if (kb.indexOf(b) === 0 || kb2.indexOf(b2) === 0) starts.push(it);
      else if (kb.indexOf(b) > -1 || (b2.length >= 3 && kb.indexOf(b2) > -1)) contains.push(it);
    });
    // 頭の記号を省いた入力（例：S50）は、当てはまる型番が1つのときだけ直接開く
    if (!exact && loose.length === 1) exact = loose[0];
    return { exact: exact, hits: (exact ? [] : loose).concat(starts, contains) };
  }
  window.Kaedoki = { norm: norm, load: load, find: find };

  // 検索ページではヘッダーの入力欄に検索語を残す
  var q = new URLSearchParams(location.search).get('q');
  var box = document.getElementById('q');
  if (q && box) box.value = q;
})();
