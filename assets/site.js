/* Élan Académie — script du site.
   Une seule chose à modifier avant la mise en ligne : CONFIG ci-dessous. */
(function () {
  var CONFIG = {
    whatsapp: "33760206797",             // numéro WhatsApp : indicatif international sans le + ni le 0 (ex. 33760206797 ou 212612345678)
    email: "contact@elanacademie.ma",
    instagram: "elanacademie",
    linkedin: "elan-academie",
    facebook: "elanacademie",
    formEndpoint: ""                     // optionnel : adresse d'un service de formulaire (Formspree, Tally, Google Apps Script). Vide = envoi par WhatsApp.
  };

  function waLink(text) {
    var base = "https://wa.me/" + CONFIG.whatsapp;
    return text ? base + "?text=" + encodeURIComponent(text) : base;
  }
  function pretty(num) {
    // 212612345678 -> +212 6 12 34 56 78 ; 33760206797 -> +33 7 60 20 67 97
    var m = /^(212|33)(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(num);
    return m ? "+" + m[1] + " " + m[2] + " " + m[3] + " " + m[4] + " " + m[5] + " " + m[6] : "+" + num;
  }

  function fill() {
    document.querySelectorAll("[data-wa]").forEach(function (a) {
      a.setAttribute("href", waLink(a.getAttribute("data-wa") || ""));
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
    document.querySelectorAll("[data-wa-number]").forEach(function (el) { el.textContent = pretty(CONFIG.whatsapp); });
    document.querySelectorAll("[data-email]").forEach(function (el) { el.textContent = CONFIG.email; });
    document.querySelectorAll("[data-instagram]").forEach(function (a) { a.setAttribute("href", "https://www.instagram.com/" + CONFIG.instagram + "/"); });
    document.querySelectorAll("[data-linkedin]").forEach(function (a) { a.setAttribute("href", "https://www.linkedin.com/company/" + CONFIG.linkedin + "/"); });
    document.querySelectorAll("[data-facebook]").forEach(function (a) { a.setAttribute("href", "https://www.facebook.com/" + CONFIG.facebook + "/"); });
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  function nav() {
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.querySelector(".nav");
    if (!toggle || !menu) return;
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Fermer" : "Menu";
    });
  }

  function copyText(text, btn) {
    var done = function () { var old = btn.textContent; btn.textContent = "Copié"; setTimeout(function () { btn.textContent = old; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.getElementById("message-apercu");
      if (ta) { ta.focus(); ta.select(); }
    }
  }

  function form() {
    var f = document.getElementById("form-liste");
    if (!f) return;
    var status = document.getElementById("form-status");
    var preview = document.getElementById("message-apercu");
    var openWa = document.getElementById("ouvrir-whatsapp");
    var copyBtn = document.getElementById("copier-message");
    var errBox = document.getElementById("form-erreur");

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.textContent = "";
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var parent = v("parent"), tel = v("telephone"), email = v("email"), enfant = v("enfant"), age = v("age"), interet = v("interet"), quartier = v("quartier"), source = v("source"), message = v("message");
      if (!parent || !tel || !enfant || !age) {
        errBox.textContent = "Il manque votre nom, votre numéro, le prénom ou l'âge de votre enfant.";
        return;
      }
      var ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 7 || ageNum > 18) {
        errBox.textContent = "L'académie accueille les 7-18 ans : indiquez un âge entre 7 et 18.";
        return;
      }
      var lines = [
        "Bonjour, je souhaite inscrire mon enfant sur la liste d'attente d'Élan Académie.",
        "Parent : " + parent,
        "WhatsApp : " + tel,
        email ? "E-mail : " + email : null,
        "Enfant : " + enfant + ", " + ageNum + " ans",
        interet ? "Intérêt : " + interet : null,
        quartier ? "Quartier : " + quartier : null,
        source ? "Comment je vous ai connus : " + source : null,
        message ? "Message : " + message : null
      ].filter(Boolean);
      var text = lines.join("\n");

      var finish = function (sentByForm) {
        f.hidden = true;
        status.hidden = false;
        showModal(sentByForm);
        preview.value = text;
        openWa.setAttribute("href", waLink(text));
        var title = document.getElementById("status-titre");
        if (title) title.textContent = sentByForm ? "C'est noté, " + parent + "." : "Dernière étape : envoyez ce message sur WhatsApp";
        var sub = document.getElementById("status-texte");
        if (sub) sub.textContent = sentByForm
          ? "Votre demande est enregistrée. Vous recevrez une réponse sous 24 h sur WhatsApp. Vous pouvez aussi nous écrire dès maintenant avec le message ci-dessous."
          : "Le bouton ouvre WhatsApp avec le message déjà rempli ; il ne reste qu'à l'envoyer. Si WhatsApp ne s'ouvre pas, copiez le texte et envoyez-le au numéro indiqué.";
        status.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      var APP = window.ELAN_CONFIG || {};
      if (APP.supabaseUrl && APP.supabaseAnonKey) {
        // Enregistre la demande dans la base de l'application (table waitlist), puis propose WhatsApp
        var row = { parent: parent, phone: tel, email: email || null, child: enfant, age: ageNum, interest: interet || null, quartier: quartier || null, source: source || null, message: message || null, page: location.href };
        fetch(APP.supabaseUrl.replace(/\/$/, "") + "/rest/v1/waitlist", { method: "POST", headers: { "Content-Type": "application/json", "apikey": APP.supabaseAnonKey, "Authorization": "Bearer " + APP.supabaseAnonKey, "Prefer": "return=minimal" }, body: JSON.stringify(row) })
          .then(function (r) { finish(r.ok); })
          .catch(function () { finish(false); });
      } else if (CONFIG.formEndpoint) {
        var payload = { parent: parent, telephone: tel, email: email, enfant: enfant, age: ageNum, interet: interet, quartier: quartier, source: source, message: message, page: location.href, date: new Date().toISOString() };
        fetch(CONFIG.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(payload) })
          .then(function (r) { finish(r.ok); })
          .catch(function () { finish(false); });
      } else {
        finish(false);
      }
    });

    if (copyBtn) copyBtn.addEventListener("click", function () { copyText(preview.value, copyBtn); });
  }

  function showModal(saved) {
    var modal = document.getElementById("modal-confirm");
    if (!modal) return;
    var title = document.getElementById("modal-titre"), text = document.getElementById("modal-texte");
    if (title) title.textContent = saved ? "Vos informations ont bien été enregistrées" : "Votre demande est prête";
    if (text) text.textContent = saved
      ? "Merci. Nous vous répondons sous 24 h sur WhatsApp. Vous pouvez aussi nous envoyer votre demande tout de suite avec le bouton WhatsApp."
      : "Il reste à l'envoyer sur WhatsApp : le bouton ouvre la conversation avec le message déjà rempli.";
    modal.hidden = false;
    var close = function () { modal.hidden = true; document.removeEventListener("keydown", onKey); };
    var onKey = function (e) { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    modal.querySelectorAll("[data-modal-close]").forEach(function (b) { b.addEventListener("click", close, { once: true }); });
    var btn = modal.querySelector("button"); if (btn) btn.focus();
  }

  function intervenants() {
    var f = document.getElementById("form-intervenant");
    if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
      var nom = v("int-nom"), metier = v("int-metier"), dispo = v("int-dispo");
      var out = document.getElementById("int-status");
      if (!nom || !metier) { out.hidden = false; out.textContent = "Indiquez votre nom et votre métier."; return; }
      var text = "Bonjour, je suis " + nom + ", " + metier + ". Je peux animer une rencontre métiers d'une heure avec un groupe de 8 enfants" + (dispo ? " (" + dispo + ")" : "") + ".";
      var a = document.getElementById("int-whatsapp");
      a.setAttribute("href", waLink(text));
      out.hidden = false;
      out.textContent = "Merci. Le bouton ci-dessous ouvre WhatsApp avec votre message prêt à envoyer.";
      a.hidden = false;
    });
  }

  function mark() {
    var here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav a").forEach(function (a) {
      var href = a.getAttribute("href");
      if (href === here || (here === "" && href === "index.html")) a.setAttribute("aria-current", "page");
    });
  }

  function init() { fill(); nav(); form(); intervenants(); mark(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
