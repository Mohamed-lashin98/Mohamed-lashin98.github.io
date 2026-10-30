(function () {
  "use strict";

  var T = { heading: "عنوان القسم", sub: "عنوان فرعي", para: "فقرة", card: "بطاقة", quote: "اقتباس", image: "صورة", contact: "تواصل" };
  var TIMELINE = { journey: 1, experience: 1 };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }
  // Text -> paragraphs and bullet lists ("- " at line start)
  function rich(text) {
    if (!text) return "";
    var html = "", list = [], para = [];
    function flushPara() { if (para.length) { html += "<p>" + para.map(inline).join("<br>") + "</p>"; para = []; } }
    function flushList() { if (list.length) { html += "<ul>" + list.map(function (l) { return "<li>" + inline(l) + "</li>"; }).join("") + "</ul>"; list = []; } }
    String(text).replace(/\r/g, "").split("\n").forEach(function (line) {
      var t = line.trim();
      if (!t) { flushPara(); flushList(); return; }
      var m = t.match(/^[-•*]\s+(.*)$/);
      if (m) { flushPara(); list.push(m[1]); } else { flushList(); para.push(t); }
    });
    flushPara(); flushList();
    return html;
  }
  // Google Drive share links -> direct image links
  function imgUrl(u) {
    u = String(u || "").trim();
    var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
    if (m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1600";
    // "/images/x.jpg" from the CMS -> relative, so it works under any sub-folder
    return u.replace(/^\/(?!\/)/, "");
  }

  // ---------- model ----------
  function str(v) { return v == null ? "" : String(v).trim(); }
  function toItems(rows) {
    return rows.map(function (r) {
      return {
        section: str(r[0]), type: str(r[1]), title: str(r[2]), subtitle: str(r[3]),
        text: str(r[4]), image: str(r[5]), nav: str(r[6]), show: str(r[7])
      };
    }).filter(function (it) {
      return it.section && it.type && !/^(لا|no|0)$/i.test(it.show);
    });
  }
  function group(items) {
    var order = [], map = {};
    items.forEach(function (it) {
      if (!map[it.section]) { map[it.section] = { id: it.section, head: null, rows: [] }; order.push(map[it.section]); }
      if (it.type === T.heading && !map[it.section].head) map[it.section].head = it;
      else map[it.section].rows.push(it);
    });
    return order;
  }

  // ---------- render ----------
  function renderHero(s) {
    var h = s.head || {};
    var img = h.image ? '<div class="hero-photo"><img src="' + esc(imgUrl(h.image)) + '" alt="' + esc(h.title) + '"></div>' : "";
    return '<section id="' + esc(s.id) + '" class="hero"><div class="wrap hero-in">' +
      '<div class="hero-text"><span class="eyebrow">بورتفوليو</span>' +
      "<h1>" + inline(h.title) + "</h1>" +
      (h.subtitle ? '<p class="lead">' + inline(h.subtitle) + "</p>" : "") +
      (h.text ? '<p class="loc">' + inline(h.text) + "</p>" : "") +
      '<div class="cta"><a class="btn primary" href="#contact">تواصل معي</a><a class="btn ghost" href="#project">شاهد المشروع</a></div>' +
      "</div>" + img + "</div></section>";
  }

  function renderBody(s) {
    var out = "", buf = [], imgs = [], kind = "";
    var timeline = !!TIMELINE[s.id];
    function flush() {
      if (kind === "card" && buf.length) {
        out += timeline
          ? '<ol class="timeline">' + buf.map(function (c, i) {
              return '<li class="tl-item"><span class="tl-dot">' + (i + 1) + '</span><div class="card">' + cardInner(c) + "</div></li>";
            }).join("") + "</ol>"
          : '<div class="grid' + (buf.length === 1 ? " one" : "") + '">' + buf.map(function (c) { return '<article class="card">' + cardInner(c) + "</article>"; }).join("") + "</div>";
      }
      if (kind === "image" && imgs.length) {
        out += '<div class="gallery' + (imgs.length === 1 ? " single" : "") + '">' + imgs.map(function (c) {
          var src = esc(imgUrl(c.image));
          return '<figure><button class="ph" data-src="' + src + '" data-cap="' + esc(c.title) + '"><img loading="lazy" src="' + src + '" alt="' + esc(c.title) + '"></button>' +
            (c.title || c.subtitle ? "<figcaption>" + inline(c.title) + (c.subtitle ? "<small>" + inline(c.subtitle) + "</small>" : "") + "</figcaption>" : "") + "</figure>";
        }).join("") + "</div>";
      }
      if (kind === "contact" && buf.length) {
        out += '<div class="contact-box">' + buf.map(function (c) {
          var v = c.text, html = inline(v);
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) html = '<a href="mailto:' + esc(v) + '">' + esc(v) + "</a>";
          else if (/^https?:\/\//.test(v)) html = '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + "</a>";
          else if (/^\+?[\d\s-]{7,}$/.test(v)) html = '<a href="tel:' + esc(v.replace(/\s|-/g, "")) + '" dir="ltr">' + esc(v) + "</a>";
          return '<div class="ci"><span>' + inline(c.title) + "</span><b>" + html + "</b></div>";
        }).join("") + "</div>";
      }
      buf = []; imgs = []; kind = "";
    }
    s.rows.forEach(function (r) {
      var k = r.type === T.card ? "card" : r.type === T.image ? "image" : r.type === T.contact ? "contact" : "other";
      if (k !== kind) flush();
      kind = k;
      if (k === "card" || k === "contact") buf.push(r);
      else if (k === "image") { if (r.image) imgs.push(r); }
      else {
        if (r.type === T.sub) out += '<h3 class="sub">' + inline(r.title) + "</h3>" + rich(r.text);
        else if (r.type === T.quote) out += '<blockquote class="quote">' + inline(r.text || r.title) + "</blockquote>";
        else out += '<div class="prose">' + (r.title ? "<h3>" + inline(r.title) + "</h3>" : "") + rich(r.text) + "</div>";
        kind = "";
      }
    });
    flush();
    return out;
  }
  function cardInner(c) {
    return (c.image ? '<img class="card-img" loading="lazy" src="' + esc(imgUrl(c.image)) + '" alt="">' : "") +
      (c.title ? "<h4>" + inline(c.title) + "</h4>" : "") +
      (c.subtitle ? '<p class="meta">' + inline(c.subtitle) + "</p>" : "") + rich(c.text);
  }

  function renderSection(s, idx) {
    if (s.id === "hero") return renderHero(s);
    var h = s.head || {};
    return '<section id="' + esc(s.id) + '" class="sec sec-' + esc(s.id) + (idx % 2 ? " alt" : "") + '"><div class="wrap">' +
      '<header class="sec-head">' + (h.title ? "<h2>" + inline(h.title) + "</h2>" : "") +
      (h.subtitle ? '<p class="sec-sub">' + inline(h.subtitle) + "</p>" : "") + "</header>" +
      (h.text ? '<div class="prose intro">' + rich(h.text) + "</div>" : "") +
      renderBody(s) + "</div></section>";
  }

  function render(rows) {
    var sections = group(toItems(rows));
    if (!sections.length) return false;
    document.getElementById("main").innerHTML = sections.map(renderSection).join("");
    document.getElementById("nav").innerHTML = sections.filter(function (s) { return s.head && s.head.nav; })
      .map(function (s) { return '<a href="#' + esc(s.id) + '">' + esc(s.head.nav) + "</a>"; }).join("");
    var hero = sections.filter(function (s) { return s.id === "hero"; })[0];
    if (hero && hero.head) {
      document.getElementById("brand").textContent = hero.head.title;
      document.getElementById("footer").textContent = "© " + new Date().getFullYear() + " " + hero.head.title;
    }
    return true;
  }

  // ---------- interactions ----------
  var nav = document.getElementById("nav"), btn = document.getElementById("menuBtn");
  btn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
  nav.addEventListener("click", function (e) { if (e.target.tagName === "A") { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });

  var lb = document.getElementById("lightbox");
  document.getElementById("main").addEventListener("click", function (e) {
    var b = e.target.closest(".ph");
    if (!b) return;
    document.getElementById("lbImg").src = b.dataset.src;
    document.getElementById("lbCap").textContent = b.dataset.cap || "";
    lb.hidden = false;
  });
  function closeLb() { lb.hidden = true; }
  lb.addEventListener("click", function (e) { if (e.target !== document.getElementById("lbImg")) closeLb(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLb(); });

  // ---------- load ----------
  // Content lives in data/<section>.json (edited from /admin); content.js is the offline fallback
  var SECTIONS = ["hero", "journey", "skills", "project", "tools", "philosophy", "reflections", "experience", "qualifications", "gallery", "contact"];
  function toRows(id, d) {
    var hide = d.show === false ? "لا" : "نعم";
    var rows = [[id, T.heading, d.title, d.subtitle, d.text, d.image, d.nav, hide]];
    (d.blocks || []).forEach(function (b) {
      rows.push([id, b.type, b.title, b.subtitle, b.text, b.image, "", d.show === false || b.show === false ? "لا" : "نعم"]);
    });
    return rows;
  }
  Promise.all(SECTIONS.map(function (id) {
    return fetch("data/" + id + ".json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(id + " " + r.status);
      return r.json();
    }).then(function (d) { return toRows(id, d); });
  })).then(function (parts) {
    var hash = location.hash;
    if (render([].concat.apply([], parts)) && hash) { var el = document.querySelector(hash); if (el) el.scrollIntoView(); }
  }).catch(function (err) {
    console.warn("تعذر تحميل ملفات المحتوى، تم عرض المحتوى المحفوظ.", err);
    render(window.FALLBACK_ROWS || []);
  });
})();
