/* Ricons - Video hướng dẫn IT
 * Đọc videos.json và dựng trang chủ (index.html) + trang xem video (video.html).
 * Không cần build, không cần thư viện. Chỉ cần một máy chủ web tĩnh.
 */
(function () {
  'use strict';

  var PLAY = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#1A1A1A"/></svg>';
  var ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';
  var FILE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  var SEARCH = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  var state = { data: null, cats: {}, videos: [], settings: {} };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Bỏ dấu tiếng Việt để tìm "mat khau" ra "mật khẩu"
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  }
  function toSec(t) {
    var parts = String(t || '0').split(':'), s = 0, i;
    for (i = 0; i < parts.length; i++) { s = s * 60 + (parseInt(parts[i], 10) || 0); }
    return s;
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^(https?|mailto):/i.test(u)) { return '#'; }
    return u || '#';
  }
  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function isNew(v) {
    if (!v.date) { return false; }
    var days = (state.settings.newDays || 30);
    var t = new Date(v.date + 'T00:00:00').getTime();
    return !isNaN(t) && (Date.now() - t) / 864e5 <= days;
  }
  function catName(v) { return (state.cats[v.categoryId] || {}).name || ''; }
  function thumbClass(v) { var c = state.cats[v.categoryId]; return 't' + (((c && c._i) || 0) % 4); }
  function videoHref(v) { return 'video.html?id=' + encodeURIComponent(v.id); }

  function load() {
    return fetch('videos.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    });
  }

  function prepare(data) {
    var cats = data.categories || [];
    state.data = data;
    state.settings = data.settings || {};
    state.cats = {};
    cats.forEach(function (c, i) { c._i = i; state.cats[c.id] = c; });
    state.catList = cats;
    state.videos = (data.videos || []).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id));
    });
    state.videos.forEach(function (v) {
      v._search = norm([
        v.title, v.description, (v.keywords || []).join(' '), catName(v),
        (v.transcript || []).map(function (l) { return l.text; }).join(' ')
      ].join(' '));
    });
    $all('[data-feedback]').forEach(function (a) { a.setAttribute('href', safeUrl(state.settings.feedbackUrl)); });
  }

  /* ---------- Thẻ video ---------- */
  function thumbHtml(v) {
    return '<div class="thumb ' + thumbClass(v) + '">' +
      (v.thumbnail ? '<img src="' + esc(safeUrl(v.thumbnail)) + '" alt="" loading="lazy">' : '') +
      '<span class="badge cat">' + esc(catName(v)) + '</span>' +
      (isNew(v) ? '<span class="badge new">MỚI</span>' : '') +
      '<span class="play">' + PLAY + '</span>' +
      '<span class="badge dur">' + esc(v.duration) + '</span></div>';
  }
  function cardHtml(v) {
    return '<a class="vcard" href="' + esc(videoHref(v)) + '">' + thumbHtml(v) +
      '<div class="vbody"><div class="vtitle">' + esc(v.title) + '</div>' +
      '<div class="vdesc">' + esc(v.description) + '</div></div>' +
      '<div class="vmeta"><span>' + esc(v.id) + '</span><span>XEM VIDEO →</span></div></a>';
  }

  /* ---------- Trang chủ ---------- */
  function initHome() {
    var params = new URLSearchParams(location.search);
    var st = { q: (params.get('q') || '').trim(), cat: params.get('cat') || '', all: params.get('all') === '1' };
    var input = $('#q');
    input.value = st.q;

    function sync() {
      var p = new URLSearchParams();
      if (st.q) { p.set('q', st.q); }
      if (st.cat) { p.set('cat', st.cat); }
      if (st.all) { p.set('all', '1'); }
      try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : '') + location.hash); } catch (e) { /* file:// */ }
    }
    function refresh() { renderToc(st); renderVideos(st); }

    renderFeatured();
    refresh();

    $('#search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      st.q = input.value.trim(); st.all = false;
      sync(); refresh();
      $('#videos').scrollIntoView();
    });
    $all('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = b.getAttribute('data-q');
        st.q = input.value; st.all = false;
        sync(); refresh();
        $('#videos').scrollIntoView();
      });
    });
    $('#videos').addEventListener('click', function (e) {
      var t = e.target.closest('[data-clear],[data-all]');
      if (!t) { return; }
      if (t.hasAttribute('data-all')) { st.all = true; }
      var what = t.getAttribute('data-clear');
      if (what === 'q') { st.q = ''; input.value = ''; }
      if (what === 'cat') { st.cat = ''; }
      sync(); refresh();
    });
  }

  function renderFeatured() {
    var v = state.videos[0], box = $('#featured');
    if (!v) { box.hidden = true; return; }
    box.outerHTML =
      '<a class="sheet" id="featured" href="' + esc(videoHref(v)) + '">' +
      '<div class="sheet-head"><span>Bản vẽ số ' + esc(v.id) + '</span><b>' + (isNew(v) ? 'Mới nhất' : 'Nổi bật') + '</b></div>' +
      '<div class="thumb ' + thumbClass(v) + '">' +
      (v.thumbnail ? '<img src="' + esc(safeUrl(v.thumbnail)) + '" alt="">' : '') +
      '<span class="play">' + PLAY + '</span><span class="badge dur">' + esc(v.duration) + '</span></div>' +
      '<div class="cells"><div><small>Danh mục</small><strong>' + esc(catName(v)) + '</strong></div>' +
      '<div><small>Thời lượng</small><strong>' + esc(v.duration) + '</strong></div>' +
      '<div><small>Đăng ngày</small><strong>' + esc(fmtDate(v.date) || '—') + '</strong></div></div>' +
      '<div class="sheet-foot"><span class="t">' + esc(v.title) + '</span><span class="arrow">' + ARROW + '</span></div></a>';
  }

  function renderToc(st) {
    var counts = {};
    state.videos.forEach(function (v) { counts[v.categoryId] = (counts[v.categoryId] || 0) + 1; });
    $('#toc-note').textContent = state.catList.length + ' nhóm sự cố · chọn nhóm bạn đang gặp';
    $('#toc').innerHTML = state.catList.map(function (c) {
      return '<a href="index.html?cat=' + encodeURIComponent(c.id) + '#videos"' + (st.cat === c.id ? ' aria-current="true"' : '') + '>' +
        '<span class="code">' + esc(c.id) + '</span>' +
        '<span class="txt"><span class="name">' + esc(c.name) + '</span><span class="hint">' + esc(c.hint) + '</span></span>' +
        '<span class="count">' + (counts[c.id] || 0) + ' VIDEO</span></a>';
    }).join('');
  }

  function renderVideos(st) {
    var words = norm(st.q).split(/\s+/).filter(Boolean);
    var filtering = !!(st.q || st.cat);
    var list = state.videos.filter(function (v) {
      if (st.cat && v.categoryId !== st.cat) { return false; }
      return words.every(function (w) { return v._search.indexOf(w) !== -1; });
    });
    var shown = (filtering || st.all) ? list : list.slice(0, 8);
    var html = '<div class="head-row"><h2 class="title">' +
      (filtering ? 'Kết quả <span class="red">(' + list.length + ')</span>' : 'Video <span class="red">mới</span>') + '</h2>' +
      '</div>';

    if (filtering) {
      html += '<div class="filters">';
      if (st.cat) { html += '<button type="button" class="chip" data-clear="cat">Danh mục: ' + esc((state.cats[st.cat] || {}).name || st.cat) + ' ✕</button>'; }
      if (st.q) { html += '<button type="button" class="chip" data-clear="q">Từ khoá: ' + esc(st.q) + ' ✕</button>'; }
      html += '</div>';
    }

    if (!shown.length) {
      html += '<div class="empty">Chưa có video phù hợp. <a href="' + esc(safeUrl(state.settings.feedbackUrl)) + '" data-feedback>Gửi đề xuất cho phòng CNTT →</a></div>';
    } else {
      html += '<div class="vgrid">' + shown.map(cardHtml).join('') + '</div>';
    }
    if (!filtering && !st.all && list.length > shown.length) {
      html += '<div class="more"><button type="button" class="btn" data-all="1">Xem tất cả ' + list.length + ' video</button></div>';
    }
    $('#vgrid-wrap').innerHTML = html;
  }

  /* ---------- Trang xem video ---------- */
  function playerHtml(v) {
    var id = String(v.vimeoId || '');
    if (/^\d+$/.test(id)) {
      var src = 'https://player.vimeo.com/video/' + id + '?' +
        (v.vimeoHash ? 'h=' + encodeURIComponent(v.vimeoHash) + '&' : '') + 'title=0&byline=0&portrait=0&dnt=1';
      return '<iframe id="vimeo" src="' + esc(src) + '" title="' + esc(v.title) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    }
    return '<div class="ph">Video này chưa được gắn ID Vimeo (trường "vimeoId" trong videos.json).</div>';
  }

  function initVideo() {
    var id = new URLSearchParams(location.search).get('id');
    var v = state.videos.filter(function (x) { return x.id === id; })[0];
    var root = $('#video-root');

    if (!v) {
      root.innerHTML = '<div class="wrap"><div class="notfound">Không tìm thấy video này. <a href="index.html">← Về trang chủ</a></div></div>';
      return;
    }
    document.title = v.title + ' · Video hướng dẫn IT · Ricons';

    var cat = state.cats[v.categoryId];
    var main = '';
    main += '<div class="player-box"><div class="player" id="player">' + playerHtml(v) + '</div>' +
      '<div class="cells"><div><small>Mã video</small><strong>' + esc(v.id) + '</strong></div>' +
      '<div><small>Danh mục</small><strong>' + esc(catName(v)) + '</strong></div>' +
      '<div><small>Thời lượng</small><strong>' + esc(v.duration) + '</strong></div>' +
      '<div><small>Đăng ngày</small><strong>' + esc(fmtDate(v.date) || '—') + '</strong></div></div></div>';
    main += '<h1 class="vtitle-h">' + esc(v.title) + '</h1>';
    if (v.description) { main += '<p class="vdesc-lg">' + esc(v.description) + '</p>'; }

    if ((v.chapters || []).length) {
      main += '<section class="sec"><h2 class="sec-h">Các chương trong video</h2>' +
        v.chapters.map(function (c) {
          return '<a class="row" href="#player" data-t="' + esc(c.t) + '"><span class="t">' + esc(c.t) + '</span><span class="x">' + esc(c.title) + '</span></a>';
        }).join('') + '</section>';
    }
    if ((v.transcript || []).length) {
      main += '<section class="sec tr"><h2 class="sec-h">Bản ghi lời thoại</h2>' +
        '<div class="tsearch">' + SEARCH + '<input type="search" id="tq" aria-label="Tìm trong bản ghi" placeholder="Tìm trong bản ghi, ví dụ: đăng nhập"></div>' +
        '<div id="tlines">' + v.transcript.map(function (l) {
          return '<div class="row" data-n="' + esc(norm(l.text)) + '"><a class="t" href="#player" data-t="' + esc(l.t) + '">' + esc(l.t) + '</a><span class="x">' + esc(l.text) + '</span></div>';
        }).join('') + '</div></section>';
    }
    if ((v.attachments || []).length) {
      main += '<section class="sec"><h2 class="sec-h">Tệp đính kèm</h2><div class="files">' +
        v.attachments.map(function (a) {
          return '<a class="file" href="' + esc(safeUrl(a.url)) + '" target="_blank" rel="noopener"><span class="ico">' + FILE + '</span>' +
            '<span><span class="n">' + esc(a.name) + '</span><span class="k">' + esc(a.type || 'Tệp') + ' · Mở / Tải về</span></span></a>';
        }).join('') + '</div></section>';
    }
    main += '<section class="feedback" id="fb"><h2>Video này có hữu ích không?</h2><div class="acts">' +
      '<button type="button" class="btn red sm" id="fb-yes">Có, đã giải quyết được</button>' +
      '<a class="btn sm" data-feedback href="' + esc(safeUrl(state.settings.feedbackUrl)) + '" target="_blank" rel="noopener">Chưa, tôi cần hỗ trợ</a></div>' +
      '<p>Nếu chưa giải quyết được, phòng CNTT sẽ nhận yêu cầu của bạn qua form hỗ trợ.</p></section>';

    var rel = state.videos.filter(function (x) { return x.id !== v.id; });
    rel.sort(function (a, b) { return (b.categoryId === v.categoryId) - (a.categoryId === v.categoryId); });
    rel = rel.slice(0, 4);
    var side = rel.length ? '<h2 class="side-h">Video liên quan</h2><div class="rel-list">' + rel.map(function (r) {
      return '<a class="rel" href="' + esc(videoHref(r)) + '"><div class="thumb ' + thumbClass(r) + '">' +
        (r.thumbnail ? '<img src="' + esc(safeUrl(r.thumbnail)) + '" alt="" loading="lazy">' : '') +
        '<span class="play">' + PLAY + '</span><span class="badge dur">' + esc(r.duration) + '</span></div>' +
        '<div class="tx"><span class="tt">' + esc(r.title) + '</span><span class="mm">' + esc(r.id) + ' · ' + esc(catName(r)) + '</span></div></a>';
    }).join('') + '</div>' : '';

    root.innerHTML = '<div class="wrap">' +
      '<nav class="crumbs" aria-label="Đường dẫn"><a href="index.html">Trang chủ</a><span aria-hidden="true">/</span>' +
      '<a href="index.html?cat=' + encodeURIComponent(v.categoryId) + '#videos">' + esc(cat ? cat.id + ' ' + cat.name : v.categoryId) + '</a><span aria-hidden="true">/</span>' +
      '<span class="red">' + esc(v.id) + '</span></nav>' +
      '<div class="vlayout"><div class="vmain">' + main + '</div><aside class="vside">' + side + '</aside></div></div>';

    // Nhảy tới mốc thời gian bằng Vimeo Player SDK
    var iframe = $('#vimeo'), player = null;
    if (iframe && window.Vimeo && window.Vimeo.Player) { player = new window.Vimeo.Player(iframe); }
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-t]');
      if (!a) { return; }
      e.preventDefault();
      if (player) {
        player.setCurrentTime(toSec(a.getAttribute('data-t'))).then(function () { return player.play(); }).catch(function () {});
      }
      $('#player').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    var tq = $('#tq');
    if (tq) {
      tq.addEventListener('input', function () {
        var words = norm(tq.value).split(/\s+/).filter(Boolean);
        $all('#tlines .row').forEach(function (row) {
          var n = row.getAttribute('data-n');
          row.style.display = words.every(function (w) { return n.indexOf(w) !== -1; }) ? '' : 'none';
        });
      });
    }
    $('#fb-yes').addEventListener('click', function () {
      $('#fb').innerHTML = '<h2>Cảm ơn bạn đã phản hồi!</h2><p>Chúc bạn làm việc hiệu quả.</p>';
    });
  }

  /* ---------- Khởi động ---------- */
  function showError(err) {
    var host = $('#vgrid-wrap') || $('#video-root') || document.body;
    var msg = '<div class="errbox"><strong>Không tải được videos.json.</strong><br>' +
      'Nếu bạn mở trực tiếp file index.html bằng cách bấm đúp thì trình duyệt sẽ chặn. ' +
      'Hãy chạy preview.bat (xem README.md) hoặc đưa thư mục lên máy chủ web.<br><small>' + esc(err && err.message) + '</small></div>';
    if (host === document.body) { host.insertAdjacentHTML('beforeend', msg); } else { host.innerHTML = msg; }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page');
    load().then(function (data) {
      prepare(data);
      if (page === 'home') { initHome(); }
      if (page === 'video') { initVideo(); }
    }).catch(showError);
  });
})();
