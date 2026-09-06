(function () {
  var form = document.getElementById("ugc-inquiry-form");
  if (!form) return;
  var status = document.getElementById("form-status"),
    submit = form.querySelector("[type=submit]"),
    csrf = "",
    idempotency = (
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random()
    ).replaceAll("-", "");
  function track(name) {
    if (window.goatcounter && typeof window.goatcounter.count === "function")
      window.goatcounter.count({
        path: "ugc-form/" + name,
        title: "UGC form " + name,
        event: true,
      });
  }
  function error(name, message) {
    var field = form.elements[name],
      node = document.getElementById(name + "-error");
    if (field && field.setAttribute) field.setAttribute("aria-invalid", "true");
    if (node) node.textContent = message;
  }
  function clearErrors() {
    form.querySelectorAll("[aria-invalid=true]").forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
    form.querySelectorAll(".field-error").forEach(function (el) {
      el.textContent = "";
    });
  }
  function values(name) {
    return Array.from(
      form.querySelectorAll('[name="' + name + '"]:checked'),
    ).map(function (el) {
      return el.value;
    });
  }
  function payload() {
    var fd = new FormData(form);
    return {
      name: fd.get("name"),
      email: fd.get("email"),
      company: fd.get("company"),
      companyUrl: fd.get("companyUrl"),
      phone: fd.get("phone"),
      preferredContact: fd.get("preferredContact"),
      productName: fd.get("productName"),
      productUrl: fd.get("productUrl"),
      contentTypes: values("contentTypes"),
      videoCount: fd.get("videoCount"),
      completionWindow: fd.get("completionWindow"),
      budget: fd.get("budget"),
      usageLocations: values("usageLocations"),
      usageKind: fd.get("usageKind"),
      objective: fd.get("objective"),
      notes: fd.get("notes"),
      consent: fd.get("consent") === "yes",
      marketingConsent: fd.get("marketingConsent") === "yes",
      botField: fd.get("botField"),
    };
  }
  async function security() {
    var response = await fetch("/api/ugc/csrf", { credentials: "same-origin" });
    if (!response.ok)
      throw new Error(
        "The secure inquiry service is not available yet. Email echov4ult@gmail.com instead.",
      );
    csrf = (await response.json()).token;
  }
  form.addEventListener("focusin", function () {
    if (!form.dataset.started) {
      form.dataset.started = "1";
      track("inquiry-started");
    }
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearErrors();
    if (!form.reportValidity()) {
      track("validation-failure");
      return;
    }
    var data = payload();
    if (!data.contentTypes.length) {
      error("contentTypes", "Choose at least one content type.");
      track("validation-failure");
      return;
    }
    if (!data.usageLocations.length) {
      error("usageLocations", "Choose at least one usage location.");
      track("validation-failure");
      return;
    }
    submit.disabled = true;
    status.className = "form-status";
    status.textContent = "Sending securely…";
    try {
      if (!csrf) await security();
      var response = await fetch("/api/ugc/inquiries", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-UGC-CSRF": csrf,
            "Idempotency-Key": idempotency,
          },
          body: JSON.stringify(data),
        }),
        result = await response.json();
      if (!response.ok) {
        Object.keys(result.fields || {}).forEach(function (key) {
          error(key, result.fields[key]);
        });
        throw new Error(result.error || "The inquiry could not be submitted.");
      }
      form.dataset.completed = "1";
      track("inquiry-completed");
      location.assign(result.redirect || "/ugc/thank-you/");
    } catch (err) {
      status.className = "form-status error";
      status.textContent = err.message || "The inquiry could not be submitted.";
      track("validation-failure");
    } finally {
      submit.disabled = false;
    }
  });
  window.addEventListener("pagehide", function () {
    if (form.dataset.started && !form.dataset.completed)
      track("inquiry-abandoned");
  });
})();
