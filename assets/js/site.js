// echov4ult — shared behaviors (no frameworks, no trackers)
(function () {
  // Scroll-reveal
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reducedMotion) {
    document.documentElement.classList.add("reveal-ready");
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

  // Mobile navigation
  var navToggle = document.querySelector(".nav-toggle");
  var navMenu = document.getElementById("site-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      var open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      navMenu.classList.toggle("open", !open);
    });
    navMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navToggle.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("open");
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        navToggle.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("open");
        navToggle.focus();
      }
    });
  }

  // Mark active nav link
  var path = location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-links a[href]").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) !== "/") return;
    if (href === "/" ? path === "/" : path.indexOf(href) === 0) a.classList.add("active");
  });

  // Keep the homepage's latest-post panel synced with the canonical blog index.
  var latestPosts = document.querySelector("[data-latest-posts]");
  if (latestPosts && window.fetch && window.DOMParser) {
    fetch("/blog/", { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("Blog index returned " + response.status);
        return response.text();
      })
      .then(function (html) {
        var source = new DOMParser().parseFromString(html, "text/html");
        var allPosts = source.querySelectorAll(".post-list .post-item");
        var posts = Array.prototype.slice.call(allPosts, 0, 3);
        if (posts.length < 3) return;

        var postCount = document.querySelector("[data-post-count]");
        if (postCount) postCount.textContent = allPosts.length + " published notes";

        var fragment = document.createDocumentFragment();
        posts.forEach(function (post, index) {
          var card = document.createElement("a");
          card.className = "transmission-card" + (index === 0 ? " transmission-feature" : "");
          card.href = post.getAttribute("href") || "/blog/";

          if (index === 0) {
            var flag = document.createElement("span");
            flag.className = "latest-flag";
            flag.textContent = "NEWEST SIGNAL";
            card.appendChild(flag);
          }

          var meta = document.createElement("span");
          meta.className = "post-meta";
          meta.textContent = (post.querySelector(".post-meta") || {}).textContent || "BUILD LOG";
          card.appendChild(meta);

          var title = document.createElement("h3");
          title.textContent = (post.querySelector("h3") || {}).textContent || "Read the latest note";
          card.appendChild(title);

          var summary = document.createElement("p");
          summary.textContent = (post.querySelector("p") || {}).textContent || "Open the Build Log for the newest field note.";
          card.appendChild(summary);

          var arrow = document.createElement("span");
          arrow.className = "read-arrow";
          arrow.setAttribute("aria-hidden", "true");
          arrow.textContent = "↗";
          card.appendChild(arrow);
          fragment.appendChild(card);
        });

        latestPosts.replaceChildren(fragment);
      })
      .catch(function () {
        // The three server-rendered cards remain as a resilient fallback.
      });
  }
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
