// 外部の販売サイトへのリンクが押されたら GA4 に送る（site.config.json の ga4Id があるときだけ読み込まれる）
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.host === location.host || typeof gtag !== 'function') return;
  var shop = /amazon\./.test(a.host) ? 'amazon' : /rakuten\./.test(a.host) ? 'rakuten' : 'other';
  var pn = (a.closest('tr,li,.buy') || document).querySelector('.pn');
  gtag('event', 'outbound_shop_click', { shop: shop, part: pn ? pn.textContent.trim() : '', page: location.pathname });
});
