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
