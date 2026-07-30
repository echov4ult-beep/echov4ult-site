// echov4ult — shared behaviors (no frameworks, no trackers)
(function () {
  // Scroll-reveal
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  // Mark active nav link
  var path = location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-links a[href]").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) !== "/") return;
    if (href === "/" ? path === "/" : path.indexOf(href) === 0) a.classList.add("active");
  });
})();

// GoatCounter analytics — cookie-free, no personal data collected.
// count.js skips localhost automatically, so dev previews don't pollute counts.
(function () {
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = "https://echov4ult.goatcounter.com/count";
  document.body.appendChild(s);
})();
