// 機種ページ：使用月数・年数を変えてフィルター代を試算
(function () {
  document.querySelectorAll('[data-calc]').forEach(function (el) {
    var d = el.dataset;
    var m = el.querySelector('[data-months]'), y = el.querySelector('[data-years]'), out = el.querySelector('[data-out]');
    function yen(n) { return '¥' + n.toLocaleString('ja-JP'); }
    function run() {
      var months = +m.value, years = +y.value;
      var seasons = years * months / 6;
      var careN = Math.ceil(seasons / +d.careLife);
      var care = careN * +d.carePrice;
      var filters = Math.ceil(months / +d.dispLife) * years;
      var packs = Math.ceil(filters / +d.dispPack);
      var disp = packs * +d.dispPrice;
      var washes = months * years;
      out.innerHTML = 'お手入れタイプ <strong class="price">' + yen(care) + '</strong>（' + careN + '個・クエン酸洗浄 約' + washes + '回）　' +
        '使い捨てタイプ <strong class="price">' + yen(disp) + '</strong>（' + packs + '箱）<br>差額 ' + yen(Math.abs(disp - care)) +
        (disp > care ? '：洗浄1回あたり約' + yen(Math.round((disp - care) / washes)) + 'で手間を省く計算です。' : '');
    }
    m.addEventListener('change', run); y.addEventListener('change', run); run();
  });
})();
