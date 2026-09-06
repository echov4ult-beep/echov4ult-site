(function () {
  var form = document.getElementById("ugc-project-form");
  if (!form) return;
  var sections = Array.from(form.querySelectorAll(".form-section[data-step]")),
    index = 0,
    token =
      location.hash.slice(1) ||
      sessionStorage.getItem("ugc-project-token") ||
      "",
    csrf = "",
    revision = 0,
    status = document.getElementById("project-status"),
    projectRef = document.getElementById("project-ref"),
    bar = document.getElementById("progress-bar"),
    stepLabel = document.getElementById("step-label"),
    back = document.getElementById("step-back"),
    next = document.getElementById("step-next"),
    save = document.getElementById("save-draft"),
    submit = document.getElementById("submit-brief");
  if (token) {
    sessionStorage.setItem("ugc-project-token", token);
    history.replaceState(null, "", location.pathname + location.search);
  }
  form
    .querySelectorAll(".field > label:not([for])")
    .forEach(function (label, n) {
      var input = label.parentElement.querySelector("input,select,textarea");
      if (input) {
        if (!input.id) input.id = "project-field-" + n;
        label.htmlFor = input.id;
      }
    });
  function track(name) {
    if (window.goatcounter && typeof window.goatcounter.count === "function")
      window.goatcounter.count({
        path: "ugc-form/" + name,
        title: "UGC form " + name,
        event: true,
      });
  }
  function show(i) {
    index = Math.max(0, Math.min(sections.length - 1, i));
    sections.forEach(function (s, n) {
      s.hidden = n !== index;
    });
    back.hidden = index === 0;
    next.hidden = index === sections.length - 1;
    submit.hidden = index !== sections.length - 1;
    stepLabel.textContent = "Step " + (index + 1) + " of " + sections.length;
    bar.style.width = ((index + 1) / sections.length) * 100 + "%";
    if (index === sections.length - 1) review();
    sections[index].querySelector("legend").focus({ preventScroll: true });
    scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  function checked(name) {
    return Array.from(
      form.querySelectorAll('[name="' + name + '"]:checked'),
    ).map(function (x) {
      return x.value;
    });
  }
  function bool(name) {
    return Boolean(form.querySelector('[name="' + name + '"]:checked'));
  }
  function data() {
    var fd = new FormData(form),
      o = {};
    for (var pair of fd.entries()) {
      if (o[pair[0]] !== undefined) continue;
      o[pair[0]] = pair[1];
    }
    [
      "paidUsage",
      "whitelistingRequest",
      "sparkAdsRequest",
      "metaPartnershipRequest",
      "rawFootageRequested",
      "exclusivityRequested",
      "perpetualUseRequested",
      "portfolioPermission",
      "caseStudyPermission",
      "confidentialityRequired",
      "temporaryPromotion",
      "realProductRequired",
      "productReturnRequired",
      "existingAssetsAvailable",
      "handsOnlyAcceptable",
      "voiceoverAcceptable",
      "assetRightsConfirmed",
      "finalConsent",
    ].forEach(function (k) {
      o[k] = bool(k);
    });
    o.publishingPlatforms = checked("publishingPlatforms");
    o.assetLinks = String(fd.get("assetLinks") || "")
      .split("\n")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    o.claims = [1, 2, 3]
      .map(function (n) {
        return {
          claim: String(fd.get("claim" + n) || "").trim(),
          source: String(fd.get("claimSource" + n) || "").trim(),
        };
      })
      .filter(function (x) {
        return x.claim || x.source;
      });
    return o;
  }
  function fill(o) {
    Object.keys(o || {}).forEach(function (k) {
      var els = form.querySelectorAll('[name="' + CSS.escape(k) + '"]');
      els.forEach(function (el) {
        if (el.type === "checkbox" || el.type === "radio")
          el.checked = Array.isArray(o[k])
            ? o[k].includes(el.value)
            : Boolean(o[k]) &&
              (!el.value || el.value === "yes" || o[k] === el.value);
        else if (typeof o[k] !== "object") el.value = o[k] ?? "";
      });
    });
    (o.claims || []).forEach(function (c, i) {
      var n = i + 1;
      if (form.elements["claim" + n])
        form.elements["claim" + n].value = c.claim || "";
      if (form.elements["claimSource" + n])
        form.elements["claimSource" + n].value = c.source || "";
    });
    if (Array.isArray(o.assetLinks) && form.elements.assetLinks)
      form.elements.assetLinks.value = o.assetLinks.join("\n");
    conditions();
  }
  function conditions() {
    var d = data();
    document.querySelectorAll("[data-show]").forEach(function (el) {
      var rule = el.dataset.show.split(":"),
        actual = d[rule[0]],
        expected = (rule[1] || "").split(","),
        visible = Array.isArray(actual)
          ? expected.some(function (value) {
              return actual.includes(value);
            })
          : expected.includes(String(actual)) ||
            (actual === true && expected.includes("true"));
      el.hidden = !visible;
      el.querySelectorAll("[data-conditional-required]").forEach(
        function (input) {
          input.required = visible;
        },
      );
    });
  }
  function currentValid() {
    var controls = Array.from(
      sections[index].querySelectorAll("input,select,textarea"),
    ).filter(function (x) {
      return !x.closest("[hidden]");
    });
    for (var control of controls)
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    return true;
  }
  function review() {
    var d = data(),
      list = document.getElementById("review-list"),
      items = [
        ["Client", d.brandName || d.legalCompanyName],
        ["Product", d.productName],
        ["Objective", d.campaignObjective],
        ["Production", d.productionMethod],
        ["Deliverables", (d.videoCount || "") + " · " + (d.videoLength || "")],
        ["Usage", (d.usageKind || "") + " · " + (d.usageDuration || "")],
        ["Claims", String((d.claims || []).length) + " submitted with sources"],
        ["Assets", String((d.assetLinks || []).length) + " reference links"],
      ];
    list.innerHTML = items
      .map(function (x) {
        return (
          '<div class="review-row"><b>' +
          escapeHtml(x[0]) +
          "</b><span>" +
          escapeHtml(x[1] || "Not provided") +
          "</span></div>"
        );
      })
      .join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  async function security() {
    var r = await fetch("/api/ugc/csrf", { credentials: "same-origin" });
    if (!r.ok)
      throw new Error(
        "Secure project intake is not configured. Contact EchoVault for a new link.",
      );
    csrf = (await r.json()).token;
  }
  async function request(path, method, payload) {
    if (!csrf && method !== "GET") await security();
    var r = await fetch(path, {
        method: method,
        credentials: "same-origin",
        headers: Object.assign(
          { "X-UGC-Project-Token": token },
          method === "GET"
            ? {}
            : { "Content-Type": "application/json", "X-UGC-CSRF": csrf },
        ),
        body: method === "GET" ? undefined : JSON.stringify(payload),
      }),
      result = await r.json();
    if (!r.ok) {
      var e = new Error(result.error || "The request failed.");
      e.fields = result.fields || {};
      throw e;
    }
    return result;
  }
  async function load() {
    if (token.length < 32) {
      status.className = "form-status error";
      status.textContent = "This project link is missing or invalid.";
      form.hidden = true;
      return;
    }
    try {
      var result = await request(
        "/api/ugc/projects/current",
        "GET",
      );
      projectRef.textContent = result.projectRef;
      revision = Number(result.revision || 0);
      fill(result.draft);
      form.hidden = false;
      track("private-intake-opened");
      show(0);
    } catch (e) {
      status.className = "form-status error";
      status.textContent = e.message;
      form.hidden = true;
    }
  }
  async function saveDraft() {
    save.disabled = true;
    status.className = "form-status";
    status.textContent = "Saving securely…";
    try {
      var result = await request(
        "/api/ugc/projects/current",
        "PATCH",
        Object.assign(data(), { expectedRevision: revision }),
      );
      revision = Number(result.revision);
      status.textContent =
        "Draft saved " +
        new Date(result.savedAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }) +
        ". This browser stores no copy.";
    } catch (e) {
      status.className = "form-status error";
      status.textContent = e.message;
    } finally {
      save.disabled = false;
    }
  }
  form.addEventListener("change", conditions);
  next.addEventListener("click", function () {
    if (currentValid()) show(index + 1);
    else track("validation-failure");
  });
  back.addEventListener("click", function () {
    show(index - 1);
  });
  save.addEventListener("click", saveDraft);
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!form.reportValidity()) {
      track("validation-failure");
      return;
    }
    submit.disabled = true;
    status.className = "form-status";
    status.textContent = "Submitting brief for review…";
    try {
      var result = await request(
        "/api/ugc/projects/current/complete",
        "POST",
        Object.assign(data(), { expectedRevision: revision }),
      );
      track("private-intake-completed");
      location.assign(result.redirect || "/ugc/project/complete/");
    } catch (err) {
      status.className = "form-status error";
      status.textContent = err.message;
      track("validation-failure");
      var first = Object.keys(err.fields || {})[0];
      if (first) {
        for (var i = 0; i < sections.length; i++)
          if (sections[i].querySelector('[name="' + CSS.escape(first) + '"]')) {
            show(i);
            break;
          }
      }
    } finally {
      submit.disabled = false;
    }
  });
  load();
})();
