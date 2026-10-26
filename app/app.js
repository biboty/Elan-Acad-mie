/* Élan Académie — application de suivi (parents, animateurs, administration).
   Base : Supabase (PostgreSQL + authentification). Les droits sont appliqués par la base (RLS), pas par cette page. */
(function () {
  "use strict";
  var C = window.ELAN_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sb = null, session = null, profile = null;

  var LEVELS = { explorateurs: "Explorateurs · 7-9 ans", batisseurs: "Bâtisseurs · 10-12 ans", argumentateurs: "Argumentateurs · 13-15 ans", decideurs: "Décideurs · 16-18 ans", college: "Cours · collège", lycee: "Cours · lycée" };
  var ATELIER_LEVELS = { explorateurs: LEVELS.explorateurs, batisseurs: LEVELS.batisseurs, argumentateurs: LEVELS.argumentateurs, decideurs: LEVELS.decideurs };
  var KINDS = { atelier: "Atelier", cours: "Cours" };
  var CLASSES = ["6e", "5e", "4e", "3e", "2de", "1re", "Terminale"];
  var FAMILY_STATUS = { liste_attente: "Liste d'attente", essai_planifie: "Essai planifié", inscrit: "Inscrit", parti: "Parti" };
  var CHILD_STATUS = { essai: "Essai", inscrit: "Inscrit", parti: "Parti" };
  var WAIT_STATUS = { nouveau: "Nouveau", contacte: "Contacté", essai_planifie: "Essai planifié", inscrit: "Inscrit", sans_suite: "Sans suite" };
  var ROLES = { admin: "Administration", animateur: "Animateur", parent: "Parent" };
  var DAYS = ["samedi", "mercredi", "autre"];
  var SLOT_KINDS = { essai: "Séance d'essai", individuel: "Séance individuelle", rattrapage: "Rattrapage" };
  var DURATIONS = [30, 45, 60, 90, 120];
  var BADGES = ["Programmer un capteur", "Souder", "Imprimer une pièce en 3D", "Présenter sans notes", "Poser une question à un professionnel", "Finir un projet", "Aider un binôme"];

  // ---------------------------------------------------------------- utilitaires
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg, isErr) {
    var t = $("#toast"); t.textContent = msg; t.classList.toggle("err", !!isErr); t.hidden = false;
    clearTimeout(toast._h); toast._h = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 3000);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function monthKey(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function prevMonthKey() { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthKey(d); }
  function monthLabel(key) { if (!key) return ""; var p = key.split("-"); var d = new Date(+p[0], +p[1] - 1, 1); return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }
  function fmtDate(iso) { if (!iso) return ""; var d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso); return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  function fmtDateTime(iso) { if (!iso) return ""; var d = new Date(iso); return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); }
  function levelForAge(age) { age = +age; if (age <= 9) return "explorateurs"; if (age <= 12) return "batisseurs"; if (age <= 15) return "argumentateurs"; return "decideurs"; }
  function waLink(phone, text) { var n = String(phone || "").replace(/\D/g, ""); if (n.indexOf("0") === 0) n = "212" + n.slice(1); return "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : ""); }
  function options(map, selected, withEmpty) {
    var out = withEmpty ? '<option value="">' + esc(withEmpty) + "</option>" : "";
    Object.keys(map).forEach(function (k) { out += '<option value="' + esc(k) + '"' + (k === selected ? " selected" : "") + ">" + esc(map[k]) + "</option>"; });
    return out;
  }
  function optionsFrom(rows, selected, labelFn, withEmpty) {
    var out = withEmpty ? '<option value="">' + esc(withEmpty) + "</option>" : "";
    rows.forEach(function (r) { out += '<option value="' + esc(r.id) + '"' + (r.id === selected ? " selected" : "") + ">" + esc(labelFn(r)) + "</option>"; });
    return out;
  }
  function field(label, inner, hint) { return '<div class="field"><label>' + esc(label) + "</label>" + inner + (hint ? '<span class="hint">' + esc(hint) + "</span>" : "") + "</div>"; }
  function input(name, value, type, attrs) { return '<input name="' + name + '" type="' + (type || "text") + '" value="' + esc(value == null ? "" : value) + '" ' + (attrs || "") + ">"; }
  function textarea(name, value, rows) { return '<textarea name="' + name + '" rows="' + (rows || 4) + '">' + esc(value || "") + "</textarea>"; }
  function readForm(form) { var o = {}; $$("input, select, textarea", form).forEach(function (el) { if (!el.name) return; o[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); }); return o; }
  function nullIfEmpty(v) { return v === "" ? null : v; }
  function roleIs(r) { return profile && profile.role === r; }
  function slug(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function jitsiRoom(name, date) { return "https://meet.jit.si/ElanAcademie-" + slug(name) + (date ? "-" + date.replace(/-/g, "") : ""); }
  function isEmbeddable(url) { return /^https:\/\/(meet\.jit\.si|8x8\.vc)\//.test(url || ""); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function debounce(fn, ms) { var h; var d = function () { clearTimeout(h); var a = arguments; h = setTimeout(function () { fn.apply(null, a); }, ms); }; d.flush = function () { clearTimeout(h); fn(); }; return d; }
  function sessionWhen(s) { return fmtDate(s.session_date) + (s.start_time ? " à " + s.start_time : ""); }
  function isToday(s) { return s.session_date === todayISO(); }
  function fmtTime(iso) { var d = new Date(iso); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function dayKey(d) { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayLabel(key) { var d = new Date(key + "T12:00:00"); var t = todayISO(); var tom = dayKey(new Date(Date.now() + 864e5)); return (key === t ? "Aujourd'hui · " : key === tom ? "Demain · " : "") + d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); }
  function localInput(iso) { if (!iso) return ""; var d = new Date(iso); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function timeSortable(t) { var m = /(\d{1,2})\s*[h:]\s*(\d{0,2})/.exec(t || ""); return m ? pad(+m[1]) + ":" + pad(+(m[2] || 0)) : "00:00"; }
  function slotLabel(sl) { return (SLOT_KINDS[sl.kind] || "Séance") + (sl.subject ? " · " + sl.subject : ""); }
  function pills(text) { return String(text || "").split(/[,;·]/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return '<span class="pill">' + esc(x) + "</span>"; }).join(" "); }
  var ICONS = {
    planning: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
    reserver: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
    creneaux: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    accueil: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
    liste: '<path d="M4 6h16M4 12h10M4 18h7"/>',
    familles: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 18.5a4 4 0 0 1 6 0"/>',
    enfants: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    groupes: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    seances: '<rect x="3.5" y="6" width="13" height="12" rx="2.5"/><path d="m16.5 10 4-2.5v9l-4-2.5"/>',
    retours: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 12h8M8 16h5"/>',
    rencontres: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    equipe: '<circle cx="12" cy="7" r="3"/><path d="M4 20a8 8 0 0 1 16 0"/><path d="M19.5 5.5 21 7l-1.5 1.5"/>',
    compte: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l2.5 2"/>'
  };
  function icon(name) { return '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.compte) + "</svg>"; }

  async function q(promise) {
    var res = await promise;
    if (res.error) { toast(res.error.message || "Erreur", true); throw res.error; }
    return res.data;
  }

  // ---------------------------------------------------------------- démarrage et authentification
  function show(id) { ["view-config", "view-auth", "view-app"].forEach(function (v) { $("#" + v).hidden = v !== id; }); var top = $("#btn-login-top"); if (top) top.hidden = id !== "view-auth"; }

  async function init() {
    if (!C.supabaseUrl || !C.supabaseAnonKey || !window.supabase) { show("view-config"); return; }
    sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
    bindAuth();
    sb.auth.onAuthStateChange(function (event, s) {
      session = s;
      if (event === "PASSWORD_RECOVERY") { show("view-auth"); showAuthForm("reset"); return; }
      if (event === "TOKEN_REFRESHED") return;
      if (s) { if (!profile) loadProfile().then(route); }
      else { profile = null; $("#user-box").hidden = true; show("view-auth"); }
    });
    window.addEventListener("hashchange", route);
  }

  function showAuthForm(which) {
    var card = $("#auth-card"); card.hidden = false;
    $("#form-login").hidden = which !== "login";
    $("#form-reset").hidden = which !== "reset";
    if (card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" });
    var f = which === "reset" ? $("#reset-password") : $("#login-email"); if (f) setTimeout(function () { f.focus(); }, 300);
  }

  function bindAuth() {
    $$("[data-auth]").forEach(function (t) { t.addEventListener("click", function () { showAuthForm(t.getAttribute("data-auth")); }); });
    $("#btn-auth-close").addEventListener("click", function () { $("#auth-card").hidden = true; window.scrollTo({ top: 0, behavior: "smooth" }); });
    $("#form-login").addEventListener("submit", async function (e) {
      e.preventDefault(); $("#login-error").textContent = "";
      var r = await sb.auth.signInWithPassword({ email: $("#login-email").value.trim(), password: $("#login-password").value });
      if (r.error) $("#login-error").textContent = r.error.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect." : r.error.message;
    });
    $("#btn-forgot").addEventListener("click", async function () {
      var email = $("#login-email").value.trim();
      if (!email) { $("#login-error").textContent = "Indiquez votre e-mail, puis cliquez à nouveau."; return; }
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      $("#auth-info").textContent = r.error ? r.error.message : "Un e-mail pour choisir un nouveau mot de passe a été envoyé à " + email + ".";
    });
    $("#form-reset").addEventListener("submit", async function (e) {
      e.preventDefault(); $("#reset-error").textContent = "";
      var r = await sb.auth.updateUser({ password: $("#reset-password").value });
      if (r.error) { $("#reset-error").textContent = r.error.message; return; }
      toast("Mot de passe enregistré."); showAuthForm("login"); loadProfile().then(route);
    });
    $("#btn-logout").addEventListener("click", async function () { await sb.auth.signOut(); location.hash = ""; });
  }

  async function loadProfile() {
    var uid = session.user.id;
    var r = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (r.error) { toast(r.error.message, true); profile = null; return; }
    profile = r.data;
    if (!profile) {
      var ins = await sb.from("profiles").insert({ id: uid, email: session.user.email, full_name: (session.user.user_metadata || {}).full_name || "", role: "parent" }).select().single();
      profile = ins.data || { id: uid, email: session.user.email, role: "parent", full_name: "" };
    }
    $("#user-name").textContent = profile.full_name || session.user.email;
    $("#user-role").textContent = ROLES[profile.role] || profile.role;
    $("#user-box").hidden = false;
  }

  // ---------------------------------------------------------------- navigation
  var NAV = {
    admin: [["accueil", "Tableau de bord"], ["liste", "Liste d'attente"], ["familles", "Familles"], ["enfants", "Enfants"], ["groupes", "Groupes"], ["seances", "Séances"], ["creneaux", "Créneaux"], ["retours", "Retours mensuels"], ["rencontres", "Rencontres métiers"], ["equipe", "Équipe"], ["compte", "Mon compte"]],
    animateur: [["seances", "Mes séances"], ["creneaux", "Mes créneaux"], ["enfants", "Mes enfants"], ["retours", "Retours mensuels"], ["rencontres", "Rencontres métiers"], ["compte", "Mon compte"]],
    parent: [["enfants", "Mes enfants"], ["planning", "Planning"], ["reserver", "Réserver"], ["rencontres", "Rencontres métiers"], ["compte", "Mon compte"]]
  };
  var VIEWS = {};

  function route() {
    if (!session || !profile) return;
    show("view-app");
    var items = NAV[profile.role] || NAV.parent;
    var hash = (location.hash || "").replace("#", "");
    var token = hash.split("/")[0];
    var known = (items.some(function (i) { return i[0] === token; }) || token === "enfant" || token === "seance") && typeof VIEWS[token] === "function";
    if (!known) { token = items[0][0]; hash = token; }
    $("#app-nav").innerHTML = '<div class="nav-inner">' + items.map(function (i) { return '<a href="#' + i[0] + '"' + (i[0] === token || (token === "enfant" && i[0] === "enfants") || (token === "seance" && i[0] === "seances") || (token === "rencontre" && i[0] === "rencontres") ? ' class="active"' : "") + ">" + icon(i[0]) + "<span>" + esc(i[1]) + "</span></a>"; }).join("") + '<a class="nav-ext" href="../index.html">' + icon("accueil") + "<span>Accueil du site</span></a></div>";
    var fn = VIEWS[token];
    var arg = hash.split("/")[1];
    $("#app-content").innerHTML = '<p class="muted">Chargement…</p>';
    Promise.resolve(fn(arg)).then(function (html) { if (typeof html === "string") $("#app-content").innerHTML = html; bindContent(); }).catch(function (e) { $("#app-content").innerHTML = '<div class="empty">Impossible de charger cette page. ' + esc(e.message || "") + "</div>"; });
  }

  function bindContent() {
    var root = $("#app-content");
    $$("[data-toggle]", root).forEach(function (b) { b.addEventListener("click", function () { var t = $("#" + b.getAttribute("data-toggle")); if (!t) return; t.hidden = !t.hidden; if (!t.hidden) { if (t.scrollIntoView) t.scrollIntoView({ behavior: "smooth", block: "nearest" }); var f = $("input, select, textarea", t); if (f) f.focus(); } }); });
  }

  function pageHead(title, sub, actions) { return '<div class="page-head"><div><h1>' + esc(title) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (actions || "") + "</div>"; }

  // ---------------------------------------------------------------- chargements communs
  async function loadChildrenWithProgress(filter) {
    var qb = sb.from("children").select("*, families(id, parent_name, phone, email, quartier, status), groups:groups!children_group_id_fkey(id, name, kind, level, day, start_time, animateur_id), course_group:groups!children_course_group_id_fkey(id, name, kind, level, day, start_time, animateur_id)").order("first_name");
    if (filter) qb = filter(qb);
    var kids = await q(qb);
    var prog = await q(sb.from("child_progress").select("*"));
    var map = {}; prog.forEach(function (p) { map[p.child_id] = p; });
    kids.forEach(function (k) { k.progress = map[k.id] || { sessions_done: 0, sessions_missed: 0, sessions_remaining: k.sessions_planned, sessions_planned: k.sessions_planned, course_done: 0, course_missed: 0, course_remaining: k.course_sessions_planned, course_sessions_planned: k.course_sessions_planned }; });
    return kids;
  }
  function bar(label, done, remaining, planned) {
    var pct = planned ? Math.min(100, Math.round(100 * done / planned)) : 0;
    return '<div class="progress-block"><div class="muted-sm" style="margin-bottom:4px">' + esc(label) + '</div><div class="progress"><i style="width:' + pct + '%"></i></div><div class="progress-label"><span>' + done + " séance" + (done > 1 ? "s" : "") + " faite" + (done > 1 ? "s" : "") + "</span><span>" + remaining + " restante" + (remaining > 1 ? "s" : "") + " sur " + planned + "</span></div></div>";
  }
  function progressHtml(k) {
    var p = k.progress, out = "";
    if (k.group_id || p.sessions_done) out += bar("Ateliers", p.sessions_done, p.sessions_remaining, p.sessions_planned || k.sessions_planned || C.sessionsPlanned || 32);
    if (k.course_group_id || p.course_done) out += bar("Cours", p.course_done || 0, p.course_remaining == null ? (k.course_sessions_planned || 30) : p.course_remaining, p.course_sessions_planned || k.course_sessions_planned || 30);
    return out || '<p class="muted-sm">Pas encore de groupe.</p>';
  }
  function groupLabel(g, prefix) { return g ? (prefix || "") + g.name + (g.day ? " · " + g.day + (g.start_time ? " " + g.start_time : "") : "") : ""; }
  function childRow(k, showFamily) {
    var meta = [LEVELS[k.level] || "", k.school_class ? "Classe de " + k.school_class : "", k.groups ? groupLabel(k.groups, "Atelier ") : "", k.course_group ? groupLabel(k.course_group, "Cours ") : "", (!k.groups && !k.course_group) ? "Sans groupe" : "", CHILD_STATUS[k.status] || ""];
    if (showFamily && k.families) meta.push("Famille " + k.families.parent_name);
    return '<div class="row-card"><div><div class="title">' + esc(k.first_name) + (k.age ? " · " + k.age + " ans" : "") + '</div><div class="meta">' + meta.filter(Boolean).map(esc).join(" · ") + "</div>" + progressHtml(k) + '</div><div class="actions"><a class="btn btn-secondary btn-sm" href="#enfant/' + k.id + '">Fiche</a></div></div>';
  }

  // ---------------------------------------------------------------- ADMIN : tableau de bord
  VIEWS.accueil = async function () {
    var fams = await q(sb.from("families").select("id, status"));
    var kids = await loadChildrenWithProgress();
    var wait = await q(sb.from("waitlist").select("id, status, created_at"));
    var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    var sessions = await q(sb.from("sessions").select("id, session_date, start_time, meeting_url, groups(name, kind)").gte("session_date", todayISO()).lte("session_date", weekEnd.toISOString().slice(0, 10)).order("session_date").order("start_time"));
    var inscrits = kids.filter(function (k) { return k.status === "inscrit"; });
    var late = inscrits.filter(function (k) { return (k.progress.last_report_month || "") < prevMonthKey() && ((k.progress.sessions_done || 0) + (k.progress.course_done || 0)) > 0; });
    var count = function (arr, st) { return arr.filter(function (x) { return x.status === st; }).length; };
    var html = pageHead("Tableau de bord", "Où en est l'académie aujourd'hui.");
    html += '<div class="stat-grid">' +
      '<div class="stat"><strong>' + count(wait, "nouveau") + "</strong><span>demandes à rappeler sur la liste d'attente</span></div>" +
      '<div class="stat"><strong>' + count(fams, "essai_planifie") + "</strong><span>familles avec un essai planifié</span></div>" +
      '<div class="stat"><strong>' + inscrits.length + "</strong><span>enfants inscrits</span></div>" +
      '<div class="stat"><strong>' + sessions.length + "</strong><span>séances dans les 7 prochains jours</span></div>" +
      '<div class="stat' + (late.length ? " warn" : "") + '"><strong>' + late.length + "</strong><span>retours mensuels en retard</span></div></div>";
    html += '<div class="detail-grid"><div class="card"><h3>Retours mensuels en retard</h3>' + (late.length ? '<div class="list">' + late.map(function (k) { return '<div class="row-card"><div><div class="title">' + esc(k.first_name) + '</div><div class="meta">Dernier retour : ' + (k.progress.last_report_month ? esc(monthLabel(k.progress.last_report_month)) : "aucun") + '</div></div><div class="actions"><a class="btn btn-secondary btn-sm" href="#retours">Écrire</a></div></div>'; }).join("") + "</div>" : '<p class="muted">Aucun. Chaque enfant inscrit a reçu son retour du mois dernier.</p>') + "</div>";
    html += '<div class="card"><h3>Séances des 7 prochains jours</h3>' + (sessions.length ? '<div class="list">' + sessions.map(function (s) { return sessionRow(s, true); }).join("") + "</div>" : '<p class="muted">Aucune séance planifiée pour la semaine. Les animateurs les planifient depuis « Mes séances ».</p>') + "</div></div>";
    return html;
  };

  // ---------------------------------------------------------------- ADMIN : liste d'attente
  VIEWS.liste = async function () {
    var rows = await q(sb.from("waitlist").select("*").order("created_at", { ascending: false }));
    var html = pageHead("Liste d'attente", rows.length + " demande" + (rows.length > 1 ? "s" : "") + " reçue" + (rows.length > 1 ? "s" : "") + " par le site.");
    if (!rows.length) return html + '<div class="empty">Aucune demande pour l\'instant. Le formulaire du site enverra chaque inscription ici.</div>';
    html += '<div class="list">' + rows.map(function (r) {
      var meta = [fmtDate(r.created_at), r.child ? r.child + (r.age ? ", " + r.age + " ans" : "") : "", r.interest, r.quartier, r.source ? "via " + r.source : ""].filter(Boolean).map(esc).join(" · ");
      return '<div class="row-card" data-id="' + r.id + '"><div><div class="title">' + esc(r.parent) + ' · <a href="' + waLink(r.phone, "Bonjour " + r.parent + ", merci pour votre demande d'inscription à Élan Académie.") + '" target="_blank" rel="noopener">' + esc(r.phone) + "</a>" + (r.email ? ' · <span class="muted-sm">' + esc(r.email) + "</span>" : "") + '</div><div class="meta">' + meta + "</div>" + (r.message ? '<p class="muted-sm" style="margin-top:6px">« ' + esc(r.message) + " »</p>" : "") + '</div><div class="actions"><select class="status" data-wait-status="' + r.id + '">' + options(WAIT_STATUS, r.status) + "</select>" + (r.status !== "inscrit" && r.status !== "sans_suite" ? '<button class="btn btn-primary btn-sm" type="button" data-wait-create="' + r.id + '">Créer la famille</button>' : "") + "</div></div>";
    }).join("") + "</div>";
    setTimeout(function () {
      $$("[data-wait-status]").forEach(function (sel) { sel.addEventListener("change", async function () { await q(sb.from("waitlist").update({ status: sel.value }).eq("id", sel.getAttribute("data-wait-status"))); toast("Statut enregistré."); }); });
      $$("[data-wait-create]").forEach(function (b) { b.addEventListener("click", async function () {
        var r = rows.find(function (x) { return x.id === b.getAttribute("data-wait-create"); });
        var fam = await q(sb.from("families").insert({ parent_name: r.parent, phone: r.phone, email: nullIfEmpty(r.email), quartier: nullIfEmpty(r.quartier), status: "essai_planifie", notes: r.message || null }).select().single());
        if (r.child) await q(sb.from("children").insert({ family_id: fam.id, first_name: r.child, age: r.age || null, level: r.age ? levelForAge(r.age) : null, status: "essai" }));
        await q(sb.from("waitlist").update({ status: "essai_planifie" }).eq("id", r.id));
        toast("Famille créée : " + r.parent + "."); location.hash = "familles";
      }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- ADMIN : familles
  function familyForm(f) {
    f = f || {};
    return '<form class="form" data-family-form="' + (f.id || "") + '"><div class="row">' + field("Nom du parent", input("parent_name", f.parent_name, "text", "required")) + field("WhatsApp", input("phone", f.phone, "tel")) + "</div><div class=\"row\">" + field("E-mail", input("email", f.email, "email"), "Sert à relier le compte parent à cette famille.") + field("Quartier", input("quartier", f.quartier)) + field("Statut", '<select name="status">' + options(FAMILY_STATUS, f.status || "liste_attente") + "</select>") + "</div>" + field("Notes", textarea("notes", f.notes, 2)) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>';
  }
  function childForm(k, groups, familyId) {
    k = k || {};
    var ateliers = groups.filter(function (g) { return g.kind !== "cours"; }), cours = groups.filter(function (g) { return g.kind === "cours"; });
    return '<form class="form" data-child-form="' + (k.id || "") + '" data-family="' + (familyId || k.family_id) + '"><div class="row">' + field("Prénom", input("first_name", k.first_name, "text", "required")) + field("Âge", input("age", k.age, "number", 'min="5" max="20"')) + field("Niveau d'atelier", '<select name="level">' + options(ATELIER_LEVELS, k.level, "Choisir") + "</select>") + field("Classe (cours)", '<select name="school_class"><option value="">Choisir</option>' + CLASSES.map(function (c) { return '<option' + (k.school_class === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select>") + "</div><div class=\"row\">" + field("Groupe d'atelier", '<select name="group_id">' + optionsFrom(ateliers, k.group_id, function (g) { return g.name + " · " + (LEVELS[g.level] || g.level); }, "Pas d'atelier") + "</select>") + field("Séances d'atelier prévues", input("sessions_planned", k.sessions_planned || C.sessionsPlanned || 32, "number", 'min="1"')) + "</div><div class=\"row\">" + field("Groupe de cours", '<select name="course_group_id">' + optionsFrom(cours, k.course_group_id, function (g) { return g.name + " · " + (LEVELS[g.level] || g.level); }, "Pas de cours") + "</select>") + field("Séances de cours prévues", input("course_sessions_planned", k.course_sessions_planned || 30, "number", 'min="1"')) + field("Statut", '<select name="status">' + options(CHILD_STATUS, k.status || "essai") + "</select>") + "</div>" + field("Notes", textarea("notes", k.notes, 2)) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>';
  }
  function bindFamilyForms() {
    $$("[data-family-form]").forEach(function (f) { f.addEventListener("submit", async function (e) {
      e.preventDefault(); var v = readForm(f); var id = f.getAttribute("data-family-form");
      var payload = { parent_name: v.parent_name, phone: nullIfEmpty(v.phone), email: nullIfEmpty(v.email), quartier: nullIfEmpty(v.quartier), status: v.status, notes: nullIfEmpty(v.notes) };
      if (!payload.parent_name) { toast("Le nom du parent est obligatoire.", true); return; }
      if (id) await q(sb.from("families").update(payload).eq("id", id)); else await q(sb.from("families").insert(payload));
      toast("Famille enregistrée."); route();
    }); });
    $$("[data-child-form]").forEach(function (f) { f.addEventListener("submit", async function (e) {
      e.preventDefault(); var v = readForm(f); var id = f.getAttribute("data-child-form");
      var payload = { family_id: f.getAttribute("data-family"), first_name: v.first_name, age: v.age ? +v.age : null, level: nullIfEmpty(v.level), school_class: nullIfEmpty(v.school_class), group_id: nullIfEmpty(v.group_id), sessions_planned: +v.sessions_planned || 32, course_group_id: nullIfEmpty(v.course_group_id), course_sessions_planned: +v.course_sessions_planned || 30, status: v.status, notes: nullIfEmpty(v.notes) };
      if (!payload.first_name) { toast("Le prénom est obligatoire.", true); return; }
      if (id) await q(sb.from("children").update(payload).eq("id", id)); else await q(sb.from("children").insert(payload));
      toast("Enfant enregistré."); route();
    }); });
  }
  VIEWS.familles = async function () {
    var fams = await q(sb.from("families").select("*, children(id, first_name, age, level, status, group_id)").order("created_at", { ascending: false }));
    var groups = await q(sb.from("groups").select("*").eq("active", true).order("name"));
    var html = pageHead("Familles", fams.length + " famille" + (fams.length > 1 ? "s" : "") + ".", '<button class="btn btn-primary" type="button" data-toggle="new-family">Nouvelle famille</button>');
    html += '<div class="inline-form" id="new-family" hidden><h3>Nouvelle famille</h3>' + familyForm() + "</div>";
    html += '<div class="toolbar"><input type="search" id="fam-search" placeholder="Rechercher un parent, un enfant, un quartier"><select id="fam-status"><option value="">Tous les statuts</option>' + options(FAMILY_STATUS) + "</select></div>";
    html += '<div class="list" id="fam-list">' + fams.map(function (f) {
      var kids = (f.children || []).map(function (k) { return esc(k.first_name) + (k.age ? " (" + k.age + ")" : ""); }).join(", ");
      return '<div class="row-card" data-fam-row data-text="' + esc((f.parent_name + " " + (f.quartier || "") + " " + kids).toLowerCase()) + '" data-status="' + f.status + '"><div><div class="title">' + esc(f.parent_name) + ' <span class="pill' + (f.status === "inscrit" ? " pill-green" : "") + '">' + esc(FAMILY_STATUS[f.status]) + '</span></div><div class="meta">' + [f.phone ? '<a href="' + waLink(f.phone) + '" target="_blank" rel="noopener">' + esc(f.phone) + "</a>" : "", f.email ? esc(f.email) : "", f.quartier ? esc(f.quartier) : "", kids ? "Enfants : " + kids : "Aucun enfant saisi"].filter(Boolean).join(" · ") + '</div><div id="fam-' + f.id + '" hidden><div class="inline-form" style="margin-top:12px">' + familyForm(f) + '<h4 style="margin-top:18px">Ajouter un enfant</h4>' + childForm(null, groups, f.id) + "</div></div></div>" + '<div class="actions">' + (f.children || []).map(function (k) { return '<a class="btn btn-secondary btn-sm" href="#enfant/' + k.id + '">' + esc(k.first_name) + "</a>"; }).join("") + '<button class="btn btn-secondary btn-sm" type="button" data-toggle="fam-' + f.id + '">Modifier</button></div></div>';
    }).join("") + "</div>";
    setTimeout(function () {
      bindFamilyForms();
      var filter = function () { var s = $("#fam-search").value.toLowerCase(), st = $("#fam-status").value; $$("[data-fam-row]").forEach(function (r) { r.hidden = (s && r.getAttribute("data-text").indexOf(s) < 0) || (st && r.getAttribute("data-status") !== st); }); };
      $("#fam-search").addEventListener("input", filter); $("#fam-status").addEventListener("change", filter);
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Enfants (admin : tous ; animateur : ses groupes ; parent : les siens)
  VIEWS.enfants = async function () {
    var kids = await loadChildrenWithProgress();
    if (roleIs("parent")) {
      if (!profile.family_id) return pageHead("Mes enfants") + '<div class="empty">Votre compte n\'est pas encore relié à une famille. Écrivez-nous sur WhatsApp avec l\'adresse e-mail de ce compte et nous faisons le lien dans la journée.</div>';
      if (!kids.length) return pageHead("Mes enfants") + '<div class="empty">Aucun enfant n\'est encore inscrit sous votre famille.</div>';
      var out = pageHead("Mes enfants", "Le parcours de chacun, mis à jour après chaque séance.");
      var gids = []; kids.forEach(function (k) { if (k.group_id) gids.push(k.group_id); if (k.course_group_id) gids.push(k.course_group_id); });
      if (gids.length) {
        var next = await q(sb.from("sessions").select("*, groups(name, kind)").in("group_id", gids).gte("session_date", todayISO()).order("session_date").order("start_time").limit(1));
        var nb = await q(sb.from("bookings").select("*, slots(*)").eq("status", "confirme").gte("slots.starts_at", new Date().toISOString()));
        nb = nb.filter(function (b) { return b.slots && new Date(b.slots.starts_at) >= new Date(); }).sort(function (a, b) { return a.slots.starts_at < b.slots.starts_at ? -1 : 1; });
        if (nb.length && (!next.length || dayKey(nb[0].slots.starts_at) + "T" + fmtTime(nb[0].slots.starts_at) < next[0].session_date + "T" + timeSortable(next[0].start_time))) { var bk = nb[0], kid = kids.find(function (k) { return k.id === bk.child_id; }) || {}; out += '<div class="hero-card"><div><p class="eyebrow">' + (dayKey(bk.slots.starts_at) === todayISO() ? "Aujourd'hui" : "Prochaine séance") + '</p><h2>' + esc(dayLabel(dayKey(bk.slots.starts_at)).replace(/^.*· /, "") + " à " + fmtTime(bk.slots.starts_at)) + '</h2><p class="muted">' + esc(slotLabel(bk.slots) + " · " + (kid.first_name || "")) + (bk.slots.mode === "visio" ? " · en ligne" : " · en présentiel") + '</p></div><div class="btn-row">' + (bk.slots.meeting_url ? launchBtn(bk.slots, "btn-primary", "Rejoindre la séance") : "") + '<a class="btn btn-secondary" href="#planning">Planning</a></div></div>'; next = []; }
        if (next.length) { var n = next[0]; var who = kids.filter(function (k) { return k.group_id === n.group_id || k.course_group_id === n.group_id; }).map(function (k) { return k.first_name; }).join(" et "); out += '<div class="hero-card"><div><p class="eyebrow">' + (isToday(n) ? "Aujourd'hui" : "Prochaine séance") + '</p><h2>' + esc(sessionWhen(n)) + '</h2><p class="muted">' + esc((KINDS[(n.groups || {}).kind] || "Atelier") + " " + ((n.groups || {}).name || "") + " · " + who) + (n.meeting_url ? " · en ligne" : " · en présentiel") + '</p></div><div class="btn-row">' + (n.meeting_url ? launchBtn(n, "btn-primary", "Rejoindre le cours") : "") + '<a class="btn btn-secondary" href="#seance/' + n.id + '">Détails</a></div></div>'; }
      }
      for (var i = 0; i < kids.length; i++) out += await childDetailHtml(kids[i]);
      return out;
    }
    var groups = await q(sb.from("groups").select("id, name").order("name"));
    var html = pageHead(roleIs("admin") ? "Enfants" : "Mes enfants", kids.length + " enfant" + (kids.length > 1 ? "s" : "") + ".");
    html += '<div class="toolbar"><input type="search" id="kid-search" placeholder="Rechercher un prénom"><select id="kid-group"><option value="">Tous les groupes</option>' + optionsFrom(groups, "", function (g) { return g.name; }) + '</select><select id="kid-status"><option value="">Tous les statuts</option>' + options(CHILD_STATUS) + "</select></div>";
    html += '<div class="list">' + (kids.length ? kids.map(function (k) { return '<div data-kid-row data-text="' + esc(k.first_name.toLowerCase()) + '" data-group="' + (k.group_id || "") + " " + (k.course_group_id || "") + '" data-status="' + k.status + '">' + childRow(k, roleIs("admin")) + "</div>"; }).join("") : '<div class="empty">Aucun enfant. Créez d\'abord une famille, puis ajoutez ses enfants.</div>') + "</div>";
    setTimeout(function () {
      var filter = function () { var s = $("#kid-search").value.toLowerCase(), g = $("#kid-group").value, st = $("#kid-status").value; $$("[data-kid-row]").forEach(function (r) { r.hidden = (s && r.getAttribute("data-text").indexOf(s) < 0) || (g && r.getAttribute("data-group").indexOf(g) < 0) || (st && r.getAttribute("data-status") !== st); }); };
      ["#kid-search", "#kid-group", "#kid-status"].forEach(function (id) { $(id).addEventListener("input", filter); $(id).addEventListener("change", filter); });
    }, 0);
    return html;
  };

  async function childDetailHtml(k) {
    var att = await q(sb.from("attendance").select("present, note, session_id, sessions(session_date, start_time, summary)").eq("child_id", k.id));
    att.sort(function (a, b) { return (b.sessions ? b.sessions.session_date : "") < (a.sessions ? a.sessions.session_date : "") ? -1 : 1; });
    var projects = await q(sb.from("projects").select("*").eq("child_id", k.id).order("created_at", { ascending: false }));
    var reports = await q(sb.from("monthly_reports").select("*").eq("child_id", k.id).order("month", { ascending: false }));
    var badges = await q(sb.from("badges").select("*").eq("child_id", k.id).order("awarded_at", { ascending: false }));
    var canEdit = roleIs("admin") || roleIs("animateur");
    var html = '<div class="card"><div class="page-head"><div><p class="eyebrow">' + esc(LEVELS[k.level] || "Enfant") + "</p><h2>" + esc(k.first_name) + (k.age ? " · " + k.age + " ans" : "") + (k.school_class ? " · " + esc(k.school_class) : "") + '</h2><p>' + esc([k.groups ? groupLabel(k.groups, "Atelier ") : "", k.course_group ? groupLabel(k.course_group, "Cours ") : ""].filter(Boolean).join(" · ") || "Pas encore de groupe") + (roleIs("admin") && k.families ? " · Famille " + esc(k.families.parent_name) : "") + "</p></div>" + (canEdit ? '<span class="pill' + (k.status === "inscrit" ? " pill-green" : "") + '">' + esc(CHILD_STATUS[k.status]) + "</span>" : "") + "</div>";
    var missed = (k.progress.sessions_missed || 0) + (k.progress.course_missed || 0);
    html += progressHtml(k) + (missed ? '<p class="muted-sm" style="margin-top:6px">' + missed + " absence" + (missed > 1 ? "s" : "") + "</p>" : "");
    html += '<div class="detail-grid" style="margin-top:12px">';
    // projets et badges
    html += '<div><h3>Projets et démos</h3>' + (projects.length ? '<div class="list" style="margin-top:8px">' + projects.map(function (p) { return '<div class="row-card"><div><div class="title">' + esc(p.title) + ' <span class="pill' + (p.status === "presente" ? " pill-green" : "") + '">' + (p.status === "presente" ? "Présenté" : "En cours") + '</span></div><div class="meta">' + [p.term, p.demo_date ? "Démo le " + fmtDate(p.demo_date) : ""].filter(Boolean).map(esc).join(" · ") + (p.link ? ' · <a href="' + esc(p.link) + '" target="_blank" rel="noopener">voir</a>' : "") + "</div></div>" + (canEdit && p.status !== "presente" ? '<div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-project-done="' + p.id + '">Marquer présenté</button></div>' : "") + "</div>"; }).join("") + "</div>" : '<p class="muted">Aucun projet encore. Le premier commence à la première séance du trimestre.</p>');
    if (canEdit) html += '<button class="btn btn-secondary btn-sm" type="button" data-toggle="proj-' + k.id + '" style="margin-top:10px">Ajouter un projet</button><div id="proj-' + k.id + '" hidden><form class="form inline-form" data-project-form="' + k.id + '" style="margin-top:10px">' + field("Titre du projet", input("title", "", "text", "required")) + '<div class="row">' + field("Trimestre", input("term", "", "text", 'placeholder="Trimestre 1"')) + field("Date de la démo", input("demo_date", "", "date")) + "</div>" + field("Lien (photos, vidéo)", input("link", "", "url")) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Ajouter</button></div></form></div>';
    html += '<h3 style="margin-top:20px">Badges</h3><div class="badge-list" style="margin-top:8px">' + (badges.length ? badges.map(function (b) { return '<span class="pill pill-green">' + esc(b.name) + "</span>"; }).join("") : '<span class="muted">Aucun badge pour l\'instant.</span>') + "</div>";
    if (canEdit) html += '<form class="form" data-badge-form="' + k.id + '" style="margin-top:10px"><div class="row"><div class="field"><select name="name">' + BADGES.map(function (b) { return "<option>" + esc(b) + "</option>"; }).join("") + '</select></div><div class="btn-row"><button class="btn btn-secondary btn-sm" type="submit">Attribuer</button></div></div></form>';
    html += "</div>";
    // retours et présences
    html += '<div><h3>Retours mensuels</h3>' + (reports.length ? reports.map(function (r) { return '<p class="eyebrow" style="margin-top:10px">' + esc(monthLabel(r.month)) + '</p><div class="report-box">' + esc(r.body) + "</div>"; }).join("") : '<p class="muted">Le premier retour écrit arrive à la fin du premier mois de séances.</p>');
    html += '<h3 style="margin-top:20px">Séances</h3>' + (att.length ? '<div class="list" style="margin-top:8px">' + att.slice(0, 12).map(function (a) { return '<div class="row-card"><div><div class="title">' + esc(fmtDate(a.sessions ? a.sessions.session_date : "")) + ' <span class="pill' + (a.present ? " pill-green" : "") + '">' + (a.present ? "Présent" : "Absent") + '</span></div><div class="meta">' + esc([a.note, a.sessions && a.sessions.summary].filter(Boolean).join(" · ")) + '</div></div><div class="actions"><a class="btn btn-secondary btn-sm" href="#seance/' + a.session_id + '">Voir</a></div></div>'; }).join("") + "</div>" : '<p class="muted">Aucune séance enregistrée pour l\'instant.</p>');
    html += "</div></div>";
    if (roleIs("admin")) {
      var groups = await q(sb.from("groups").select("*").eq("active", true).order("name"));
      html += '<button class="btn btn-secondary btn-sm" type="button" data-toggle="edit-' + k.id + '" style="margin-top:16px;align-self:flex-start">Modifier la fiche</button><div id="edit-' + k.id + '" hidden><div class="inline-form" style="margin-top:10px">' + childForm(k, groups, k.family_id) + "</div></div>";
    }
    html += "</div>";
    setTimeout(function () {
      bindFamilyForms();
      $$('[data-project-form="' + k.id + '"]').forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); if (!v.title) return; await q(sb.from("projects").insert({ child_id: k.id, title: v.title, term: nullIfEmpty(v.term), demo_date: nullIfEmpty(v.demo_date), link: nullIfEmpty(v.link) })); toast("Projet ajouté."); route(); }); });
      $$("[data-project-done]").forEach(function (b) { b.addEventListener("click", async function () { await q(sb.from("projects").update({ status: "presente" }).eq("id", b.getAttribute("data-project-done"))); toast("Projet marqué comme présenté."); route(); }); });
      $$('[data-badge-form="' + k.id + '"]').forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); await q(sb.from("badges").insert({ child_id: k.id, name: v.name })); toast("Badge attribué."); route(); }); });
    }, 0);
    return html;
  }
  VIEWS.enfant = async function (id) {
    if (!id) { location.hash = "enfants"; return ""; }
    var kids = await loadChildrenWithProgress(function (qb) { return qb.eq("id", id); });
    if (!kids.length) return '<div class="empty">Cet enfant n\'existe pas ou vous n\'y avez pas accès.</div>';
    return '<p><a href="#enfants">← Retour à la liste</a></p>' + await childDetailHtml(kids[0]);
  };

  // ---------------------------------------------------------------- ADMIN : groupes
  VIEWS.groupes = async function () {
    var groups = await q(sb.from("groups").select("*, children:children!children_group_id_fkey(id), course_children:children!children_course_group_id_fkey(id)").order("name"));
    var team = await q(sb.from("profiles").select("id, full_name, email, role").eq("role", "animateur").order("full_name"));
    var animLabel = function (id) { var a = team.find(function (t) { return t.id === id; }); return a ? (a.full_name || a.email) : "Sans animateur"; };
    var form = function (g) { g = g || {}; return '<form class="form" data-group-form="' + (g.id || "") + '"><div class="row">' + field("Nom du groupe", input("name", g.name, "text", 'required placeholder="Bâtisseurs samedi 10 h"')) + field("Type", '<select name="kind">' + options(KINDS, g.kind || "atelier") + "</select>") + field("Niveau", '<select name="level">' + options(LEVELS, g.level || "batisseurs") + "</select>", "Ateliers : Explorateurs à Décideurs. Cours : collège ou lycée.") + "</div><div class=\"row\">" + field("Jour", '<select name="day">' + DAYS.map(function (d) { return '<option value="' + d + '"' + (g.day === d ? " selected" : "") + ">" + d + "</option>"; }).join("") + "</select>") + field("Heure de début", input("start_time", g.start_time, "text", 'placeholder="10 h"')) + field("Animateur", '<select name="animateur_id">' + optionsFrom(team, g.animateur_id, function (t) { return t.full_name || t.email; }, "À attribuer") + "</select>") + "</div>" + field("Lien de visio permanent", input("meeting_url", g.meeting_url, "url", 'placeholder="https://meet.google.com/… (facultatif)"'), "Repris automatiquement sur chaque séance en ligne de ce groupe. Laissez vide pour un groupe en présentiel.") + field("Groupe actif", '<label class="muted-sm"><input type="checkbox" name="active"' + (g.active !== false ? " checked" : "") + "> Les groupes inactifs disparaissent des listes</label>") + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>'; };
    var html = pageHead("Groupes", "Un groupe = un niveau, un jour, un animateur, 8 enfants au maximum.", '<button class="btn btn-primary" type="button" data-toggle="new-group">Nouveau groupe</button>');
    html += '<div class="inline-form" id="new-group" hidden><h3>Nouveau groupe</h3>' + form() + "</div>";
    if (!team.length) html += '<p class="notice">Aucun animateur pour l\'instant : l\'animateur crée son compte sur cette page, puis vous lui donnez le rôle « Animateur » dans l\'onglet Équipe.</p>';
    html += '<div class="list">' + (groups.length ? groups.map(function (g) { var n = (g.kind === "cours" ? (g.course_children || []) : (g.children || [])).length; var max = g.kind === "cours" ? 6 : 8; return '<div class="row-card"><div><div class="title">' + esc(g.name) + ' <span class="pill' + (g.kind === "cours" ? "" : " pill-green") + '">' + esc(KINDS[g.kind] || "Atelier") + "</span>" + (g.active ? "" : ' <span class="pill">Inactif</span>') + (n >= max ? ' <span class="pill">Complet</span>' : "") + '</div><div class="meta">' + [LEVELS[g.level], g.day ? g.day + (g.start_time ? " " + g.start_time : "") : "", animLabel(g.animateur_id), n + " enfant" + (n > 1 ? "s" : "") + " sur " + max].filter(Boolean).map(esc).join(" · ") + '</div><div id="grp-' + g.id + '" hidden><div class="inline-form" style="margin-top:12px">' + form(g) + '</div></div></div><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-toggle="grp-' + g.id + '">Modifier</button></div></div>'; }).join("") : '<div class="empty">Aucun groupe. Commencez par un atelier Bâtisseurs (10-12 ans), un atelier Argumentateurs (13-15 ans) et un groupe de cours collège.</div>') + "</div>";
    setTimeout(function () {
      $$("[data-group-form]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); var id = f.getAttribute("data-group-form"); var payload = { name: v.name, kind: v.kind || "atelier", level: v.level, day: v.day, start_time: nullIfEmpty(v.start_time), animateur_id: nullIfEmpty(v.animateur_id), meeting_url: nullIfEmpty(v.meeting_url), active: !!v.active }; if (!payload.name) return; if (id) await q(sb.from("groups").update(payload).eq("id", id)); else await q(sb.from("groups").insert(payload)); toast("Groupe enregistré."); route(); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Séances (admin et animateur)
  function launchBtn(s, cls, label) { return s.meeting_url ? '<a class="btn ' + (cls || "btn-primary") + ' btn-sm" href="' + esc(s.meeting_url) + '" target="_blank" rel="noopener">' + esc(label || "Lancer le cours") + "</a>" : ""; }
  function sessionRow(s, upcoming) {
    var g = s.groups || {};
    return '<div class="row-card' + (isToday(s) ? " row-today" : "") + '"><div><div class="title">' + esc(sessionWhen(s)) + (isToday(s) ? ' <span class="pill pill-green">Aujourd\'hui</span>' : "") + '</div><div class="meta">' + esc((KINDS[g.kind] || "Atelier") + " " + (g.name || "")) + (s.meeting_url ? " · En ligne" : " · En présentiel") + (!upcoming && s.summary ? " · " + esc(s.summary) : "") + '</div></div><div class="actions">' + (upcoming ? launchBtn(s) : "") + '<a class="btn btn-secondary btn-sm" href="#seance/' + s.id + '">' + (upcoming ? "Salle de classe" : "Ouvrir") + "</a></div></div>";
  }
  VIEWS.seances = async function () {
    var groups = await q(sb.from("groups").select("*, children:children!children_group_id_fkey(id), course_children:children!children_course_group_id_fkey(id)").eq("active", true).order("name"));
    var sessions = await q(sb.from("sessions").select("*, groups(name, kind)").order("session_date", { ascending: false }).limit(80));
    var today = todayISO();
    var upcoming = sessions.filter(function (s) { return s.session_date >= today; }).sort(function (a, b) { return (a.session_date + (a.start_time || "")) < (b.session_date + (b.start_time || "")) ? -1 : 1; });
    var past = sessions.filter(function (s) { return s.session_date < today; });
    var sub = "Planifiez la séance, lancez la visio depuis la salle de classe, prenez vos notes pendant le cours, cochez les présents.";
    if (!groups.length) return pageHead(roleIs("admin") ? "Séances" : "Mes séances", sub, roleIs("admin") ? '<a class="btn btn-primary" href="#groupes">Créer un groupe</a>' : "") + '<div class="empty">' + (roleIs("admin") ? "Pour planifier une séance, il faut d'abord un groupe actif (un niveau, un jour, un animateur). Créez-le dans l'onglet Groupes, puis revenez ici." : "Aucun groupe ne vous est attribué pour l'instant. L'administration vous en attribuera un.") + "</div>";
    var html = pageHead(roleIs("admin") ? "Séances" : "Mes séances", sub, '<button class="btn btn-primary" type="button" data-toggle="new-session">Planifier une séance</button>');
    html += '<div class="inline-form" id="new-session" hidden><h3>Nouvelle séance</h3><form class="form" id="form-session"><div class="row">' + field("Groupe", '<select name="group_id">' + optionsFrom(groups, "", function (g) { return (KINDS[g.kind] || "Atelier") + " · " + g.name + " · " + (g.kind === "cours" ? (g.course_children || []) : (g.children || [])).length + " enfants"; }) + "</select>") + field("Date", input("session_date", today, "date", "required")) + field("Heure", input("start_time", "", "text", 'placeholder="10 h 00"')) + "</div>" + field("Lien de visio", '<div class="input-row">' + input("meeting_url", "", "url", 'placeholder="https://meet.google.com/… ou vide pour une séance en présentiel"') + '<button class="btn btn-secondary btn-sm" type="button" id="btn-make-room">Créer une salle</button></div>', "Vide : le lien permanent du groupe est repris s'il existe. « Créer une salle » génère une salle Jitsi gratuite, sans compte pour les familles.") + '<div class="btn-row"><button class="btn btn-primary" type="submit">Ouvrir la salle de classe</button></div></form></div>';
    var todays = upcoming.filter(isToday);
    if (todays.length) html += '<div class="hero-card"><div><p class="eyebrow">Aujourd\'hui</p><h2>' + esc(todays[0].start_time ? "Cours à " + todays[0].start_time : "Cours du jour") + " · " + esc((todays[0].groups || {}).name || "") + '</h2><p class="muted">' + (todays[0].meeting_url ? "Lancez la visio, puis prenez vos notes dans la salle de classe. Les familles ont le bouton « Rejoindre » dans leur espace." : "Séance en présentiel. Ouvrez la salle de classe pour la feuille de présence et vos notes.") + '</p></div><div class="btn-row">' + launchBtn(todays[0], "btn-primary", "Lancer le cours") + '<a class="btn btn-secondary" href="#seance/' + todays[0].id + '">Salle de classe</a></div></div>';
    html += '<h3>À venir</h3><div class="list">' + (upcoming.length ? upcoming.map(function (s) { return sessionRow(s, true); }).join("") : '<div class="empty">Aucune séance planifiée. Cliquez sur « Planifier une séance ».</div>') + "</div>";
    html += '<h3>Passées</h3><div class="list">' + (past.length ? past.map(function (s) { return sessionRow(s, false); }).join("") : '<div class="empty">Aucune séance passée.</div>') + "</div>";
    setTimeout(function () {
      var f = $("#form-session");
      $("#btn-make-room").addEventListener("click", function () { var g = groups.find(function (x) { return x.id === f.group_id.value; }); f.meeting_url.value = jitsiRoom(g ? g.name : "cours", f.session_date.value); f.meeting_url.focus(); });
      f.addEventListener("submit", async function (e) {
        e.preventDefault(); var v = readForm(f);
        var existing = await q(sb.from("sessions").select("id").eq("group_id", v.group_id).eq("session_date", v.session_date).maybeSingle());
        if (existing) { location.hash = "seance/" + existing.id; return; }
        var g = groups.find(function (x) { return x.id === v.group_id; }) || {};
        var payload = { group_id: v.group_id, session_date: v.session_date, start_time: nullIfEmpty(v.start_time) || g.start_time || null, meeting_url: nullIfEmpty(v.meeting_url) || g.meeting_url || null, animateur_id: session.user.id };
        var s = await q(sb.from("sessions").insert(payload).select().single());
        location.hash = "seance/" + s.id;
      });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Salle de classe (une séance : visio, notes, présences)
  VIEWS.seance = async function (id) {
    if (!id) { location.hash = "seances"; return ""; }
    var s = await q(sb.from("sessions").select("*, groups(id, name, kind, level, meeting_url)").eq("id", id).single());
    var kids = await q(sb.from("children").select("id, first_name, status").or("group_id.eq." + s.group_id + ",course_group_id.eq." + s.group_id).neq("status", "parti").order("first_name"));
    var att = await q(sb.from("attendance").select("*").eq("session_id", id));
    var byKid = {}; att.forEach(function (a) { byKid[a.child_id] = a; });
    var canEdit = roleIs("admin") || roleIs("animateur");
    var g = s.groups || {};
    var sub = (KINDS[g.kind] || "Atelier") + " " + (g.name || "") + " · " + (LEVELS[g.level] || "") + (s.start_time ? " · " + s.start_time : "");
    var html = '<p><a href="#seances">← Toutes les séances</a></p>' + pageHead((canEdit ? "Salle de classe · " : "Séance du ") + fmtDate(s.session_date), sub, (s.meeting_url ? '<div class="btn-row">' + launchBtn(s, "btn-primary", canEdit ? "Lancer le cours" : "Rejoindre le cours") + "</div>" : ""));
    html += '<div class="classroom"><div class="classroom-main">';
    // visio
    html += '<div class="card visio-card"><div class="page-head"><h3>Visio</h3>' + (s.meeting_url ? '<span class="pill pill-green">En ligne</span>' : '<span class="pill">En présentiel</span>') + "</div>";
    if (s.meeting_url) {
      html += '<p class="muted-sm">' + esc(s.meeting_url) + '</p><div class="btn-row">' + launchBtn(s, "btn-primary", canEdit ? "Lancer le cours" : "Rejoindre le cours") + '<button class="btn btn-secondary btn-sm" type="button" id="btn-copy-link">Copier le lien</button>' + (isEmbeddable(s.meeting_url) ? '<button class="btn btn-secondary btn-sm" type="button" id="btn-embed">Afficher la visio ici</button>' : "") + "</div>" + (isEmbeddable(s.meeting_url) ? '<div class="visio-frame" id="visio-frame" hidden></div>' : '<p class="muted-sm">La visio s\'ouvre dans un nouvel onglet ; gardez cette page ouverte à côté pour les notes et les présences.</p>');
      if (canEdit) html += '<details class="muted-sm"><summary>Changer le lien</summary><form class="form" id="form-link" style="margin-top:10px"><div class="input-row">' + input("meeting_url", s.meeting_url, "url") + '<button class="btn btn-secondary btn-sm" type="submit">Enregistrer</button></div></form></details>';
    } else if (canEdit) {
      html += '<p class="muted-sm">Pas de lien de visio. Pour un cours en ligne, collez un lien Google Meet ou Zoom, ou créez une salle gratuite.</p><form class="form" id="form-link"><div class="input-row">' + input("meeting_url", "", "url", 'placeholder="https://meet.google.com/…"') + '<button class="btn btn-secondary btn-sm" type="button" id="btn-make-room">Créer une salle</button><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>';
    } else {
      html += '<p class="muted-sm">Séance en présentiel.</p>';
    }
    html += "</div>";
    // notes pendant le cours (équipe)
    if (canEdit) html += '<div class="card notes-card"><div class="page-head"><h3>Notes pendant le cours</h3><span class="muted-sm" id="notes-state">' + (s.notes ? "Enregistré" : "Rien pour l'instant") + '</span></div><div class="btn-row chips"><button class="btn btn-secondary btn-sm" type="button" data-stamp>Horodater</button><button class="btn btn-secondary btn-sm" type="button" data-insert="Devoirs : ">Devoirs</button><button class="btn btn-secondary btn-sm" type="button" data-insert="À revoir : ">À revoir</button><button class="btn btn-secondary btn-sm" type="button" data-insert="Question : ">Question</button><button class="btn btn-secondary btn-sm" type="button" data-insert="Bravo : ">Bravo</button></div><textarea id="session-notes" rows="14" placeholder="Ce qui est fait, les questions posées, les devoirs donnés, ce qui a bloqué… Enregistré automatiquement pendant que vous écrivez. Visible par l\'équipe, pas par les familles.">' + esc(s.notes || "") + "</textarea></div>";
    html += "</div><aside class=\"classroom-side\">";
    // présences
    html += '<div class="card"><div class="page-head"><h3>Présences</h3><span class="muted-sm" id="att-state"></span></div><form class="form" id="form-attendance"><div class="check-list">' + (kids.length ? kids.map(function (k) { var a = byKid[k.id]; return '<label class="check-row" data-kid="' + k.id + '"><input type="checkbox" name="present-' + k.id + '"' + (!a || a.present ? " checked" : "") + (canEdit ? "" : " disabled") + '><span class="title">' + esc(k.first_name) + '</span><input type="text" name="note-' + k.id + '" value="' + esc(a ? a.note || "" : "") + '" placeholder="Note pour ' + esc(k.first_name) + ' (visible par ses parents)"' + (canEdit ? "" : " disabled") + "></label>"; }).join("") : '<div class="empty">Aucun enfant dans ce groupe.</div>') + "</div></form></div>";
    // résumé pour les parents
    html += '<div class="card"><h3>Résumé pour les familles</h3><form class="form" id="form-summary"><div class="field">' + textarea("summary", s.summary, 5) + "</div>" + (canEdit ? '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer le résumé</button><button class="btn btn-secondary btn-sm" type="button" id="btn-delete-session">Supprimer la séance</button></div>' : "") + "</form></div>";
    html += "</aside></div>";
    setTimeout(function () {
      if ($("#btn-copy-link")) $("#btn-copy-link").addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(s.meeting_url).then(function () { toast("Lien copié."); }); });
      if ($("#btn-embed")) $("#btn-embed").addEventListener("click", function () { var fr = $("#visio-frame"); if (!fr.innerHTML) fr.innerHTML = '<iframe src="' + esc(s.meeting_url) + '" allow="camera; microphone; display-capture; fullscreen; autoplay" allowfullscreen title="Visio"></iframe>'; fr.hidden = !fr.hidden; $("#btn-embed").textContent = fr.hidden ? "Afficher la visio ici" : "Masquer la visio"; });
      if (!canEdit) { $$("#form-summary textarea").forEach(function (t) { t.disabled = true; }); return; }
      if ($("#btn-make-room")) $("#btn-make-room").addEventListener("click", function () { $("#form-link").meeting_url.value = jitsiRoom(g.name || "cours", s.session_date); });
      if ($("#form-link")) $("#form-link").addEventListener("submit", async function (e) { e.preventDefault(); var url = $("#form-link").meeting_url.value.trim() || null; await q(sb.from("sessions").update({ meeting_url: url }).eq("id", id)); toast(url ? "Lien enregistré." : "Lien retiré."); route(); });
      // notes : enregistrement automatique
      var ta = $("#session-notes"), st = $("#notes-state");
      var saveNotes = debounce(async function () { st.textContent = "Enregistrement…"; var r = await sb.from("sessions").update({ notes: nullIfEmpty(ta.value) }).eq("id", id); st.textContent = r.error ? "Non enregistré : " + r.error.message : "Enregistré à " + nowHM(); }, 1200);
      ta.addEventListener("input", function () { st.textContent = "Modifié…"; saveNotes(); });
      window.addEventListener("beforeunload", function () { saveNotes.flush(); });
      var insertAt = function (text) { var a = ta.selectionStart, b = ta.selectionEnd, v = ta.value; var prefix = (a === 0 || v[a - 1] === "\n") ? "" : "\n"; ta.value = v.slice(0, a) + prefix + text + v.slice(b); ta.selectionStart = ta.selectionEnd = a + prefix.length + text.length; ta.focus(); st.textContent = "Modifié…"; saveNotes(); };
      $$("[data-stamp]").forEach(function (b) { b.addEventListener("click", function () { insertAt("[" + nowHM() + "] "); }); });
      $$("[data-insert]").forEach(function (b) { b.addEventListener("click", function () { insertAt("[" + nowHM() + "] " + b.getAttribute("data-insert")); }); });
      // présences : chaque changement est enregistré tout de suite
      var attState = $("#att-state");
      var saveRow = debounce(async function () {
        var v = readForm($("#form-attendance"));
        var rows = kids.map(function (k) { return { session_id: id, child_id: k.id, present: !!v["present-" + k.id], note: nullIfEmpty(v["note-" + k.id] || "") }; });
        if (!rows.length) return;
        var r = await sb.from("attendance").upsert(rows, { onConflict: "session_id,child_id" });
        attState.textContent = r.error ? "Non enregistré : " + r.error.message : rows.filter(function (x) { return x.present; }).length + " présent" + (rows.filter(function (x) { return x.present; }).length > 1 ? "s" : "") + " · enregistré à " + nowHM();
      }, 600);
      $$("#form-attendance input").forEach(function (el) { el.addEventListener(el.type === "checkbox" ? "change" : "input", function () { attState.textContent = "Enregistrement…"; saveRow(); }); });
      $("#form-attendance").addEventListener("submit", function (e) { e.preventDefault(); saveRow.flush(); });
      $("#form-summary").addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(e.target); await q(sb.from("sessions").update({ summary: nullIfEmpty(v.summary) }).eq("id", id)); saveRow.flush(); toast("Résumé enregistré. Les familles le voient dans la fiche de leur enfant."); });
      $("#btn-delete-session").addEventListener("click", async function () {
        var b = $("#btn-delete-session"); if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Confirmer la suppression"; return; }
        await q(sb.from("sessions").delete().eq("id", id)); toast("Séance supprimée."); location.hash = "seances";
      });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Retours mensuels (admin et animateur)
  VIEWS.retours = async function () {
    var month = (location.hash.split("/")[1]) || prevMonthKey();
    var kids = await loadChildrenWithProgress(function (qb) { return qb.neq("status", "parti"); });
    var reports = await q(sb.from("monthly_reports").select("*").eq("month", month));
    var byKid = {}; reports.forEach(function (r) { byKid[r.child_id] = r; });
    var months = []; for (var i = -1; i < 11; i++) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(monthKey(d)); }
    var template = "Ce que " + "{prenom}" + " a appris ce mois-ci :\n\nOù il progresse :\n\nOù il bloque encore :\n\nCe que vous pouvez faire à la maison :\n";
    var html = pageHead("Retours mensuels", "Un texte par enfant et par mois, envoyé aux parents. Ils le lisent dans leur espace.");
    html += '<div class="toolbar"><label for="month-pick" class="muted-sm">Mois</label><select id="month-pick">' + months.map(function (m) { return '<option value="' + m + '"' + (m === month ? " selected" : "") + ">" + esc(monthLabel(m)) + "</option>"; }).join("") + "</select></div>";
    html += '<div class="list">' + (kids.length ? kids.map(function (k) { var r = byKid[k.id]; return '<div class="row-card"><div><div class="title">' + esc(k.first_name) + ' <span class="pill' + (r ? " pill-green" : "") + '">' + (r ? "Écrit" : "À écrire") + '</span></div><div class="meta">' + esc([k.groups ? "Atelier " + k.groups.name : "", k.course_group ? "Cours " + k.course_group.name : ""].filter(Boolean).join(" · ") || "Sans groupe") + " · " + ((k.progress.sessions_done || 0) + (k.progress.course_done || 0)) + " séances faites</div>" + (r ? '<div class="report-box" style="margin-top:8px">' + esc(r.body) + "</div>" : "") + '<div id="rep-' + k.id + '" hidden><form class="form inline-form" data-report-form="' + k.id + '" style="margin-top:10px">' + field("Retour de " + monthLabel(month), textarea("body", r ? r.body : template.replace("{prenom}", k.first_name), 8)) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form></div></div><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-toggle="rep-' + k.id + '">' + (r ? "Modifier" : "Écrire") + "</button></div></div>"; }).join("") : '<div class="empty">Aucun enfant.</div>') + "</div>";
    setTimeout(function () {
      $("#month-pick").addEventListener("change", function () { location.hash = "retours/" + $("#month-pick").value; });
      $$("[data-report-form]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); if (!v.body) return; await q(sb.from("monthly_reports").upsert({ child_id: f.getAttribute("data-report-form"), month: month, body: v.body, author_id: session.user.id }, { onConflict: "child_id,month" })); toast("Retour enregistré."); route(); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- PARENT : planning (séances de groupe + réservations)
  VIEWS.planning = async function () {
    if (!roleIs("parent")) { location.hash = "seances"; return ""; }
    var kids = await q(sb.from("children").select("id, first_name, group_id, course_group_id").order("first_name"));
    if (!kids.length) return pageHead("Planning") + '<div class="empty">Votre compte n\'est pas encore relié à une famille. Écrivez-nous sur WhatsApp avec l\'adresse e-mail de ce compte.</div>';
    var gids = []; kids.forEach(function (k) { if (k.group_id) gids.push(k.group_id); if (k.course_group_id) gids.push(k.course_group_id); });
    var since = dayKey(new Date(Date.now() - 30 * 864e5));
    var sessions = gids.length ? await q(sb.from("sessions").select("*, groups(name, kind)").in("group_id", gids).gte("session_date", since).order("session_date")) : [];
    var bookings = await q(sb.from("bookings").select("*, slots(*)").eq("status", "confirme"));
    var anims = await q(sb.from("animateurs").select("*")); var animName = function (id) { var a = anims.find(function (x) { return x.id === id; }); return a ? a.full_name : ""; };
    var events = [];
    sessions.forEach(function (s) { var who = kids.filter(function (k) { return k.group_id === s.group_id || k.course_group_id === s.group_id; }).map(function (k) { return k.first_name; }).join(", "); events.push({ key: s.session_date + "T" + timeSortable(s.start_time), day: s.session_date, time: s.start_time || "", title: (KINDS[(s.groups || {}).kind] || "Atelier") + " " + ((s.groups || {}).name || ""), sub: who + (s.meeting_url ? " · en ligne" : " · en présentiel"), url: s.meeting_url, href: "#seance/" + s.id, done: !!s.summary }); });
    bookings.forEach(function (b) { if (!b.slots) return; var k = kids.find(function (x) { return x.id === b.child_id; }) || {}; events.push({ key: dayKey(b.slots.starts_at) + "T" + fmtTime(b.slots.starts_at), day: dayKey(b.slots.starts_at), time: fmtTime(b.slots.starts_at), title: slotLabel(b.slots), sub: (k.first_name || "") + " · avec " + animName(b.slots.animateur_id) + (b.slots.mode === "visio" ? " · en ligne" : " · en présentiel") + " · " + b.slots.duration_min + " min", url: b.slots.meeting_url, href: "#reserver", note: b.note }); });
    events.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    var today = todayISO(); var upcoming = events.filter(function (e) { return e.day >= today; }), past = events.filter(function (e) { return e.day < today; }).reverse();
    var row = function (e, up) { return '<div class="row-card' + (e.day === today ? " row-today" : "") + '"><div><div class="title">' + (e.time ? '<span class="time">' + esc(e.time) + "</span> " : "") + esc(e.title) + '</div><div class="meta">' + esc(e.sub) + (e.note ? " · " + esc(e.note) : "") + '</div></div><div class="actions">' + (up && e.url ? launchBtn({ meeting_url: e.url }, "btn-primary", "Rejoindre") : "") + '<a class="btn btn-secondary btn-sm" href="' + e.href + '">Détails</a></div></div>'; };
    var byDay = function (list, up) { var out = "", last = ""; list.forEach(function (e) { if (e.day !== last) { out += '<h3 class="day-head">' + esc(dayLabel(e.day)) + "</h3>"; last = e.day; } out += row(e, up); }); return out; };
    var html = pageHead("Planning", "Les séances de groupe et les séances réservées, pour tous vos enfants.", '<a class="btn btn-primary" href="#reserver">Réserver une séance</a>');
    html += '<div class="list">' + (upcoming.length ? byDay(upcoming, true) : '<div class="empty">Rien de planifié pour l\'instant. Les séances de groupe apparaissent dès que l\'animateur les planifie ; vous pouvez aussi réserver une séance d\'essai ou individuelle.</div>') + "</div>";
    if (past.length) html += '<h3>30 derniers jours</h3><div class="list">' + byDay(past.slice(0, 20), false) + "</div>";
    return html;
  };

  // ---------------------------------------------------------------- PARENT : réserver une séance avec un animateur
  VIEWS.reserver = async function () {
    if (!roleIs("parent")) { location.hash = "creneaux"; return ""; }
    var kids = await q(sb.from("children").select("id, first_name, status").neq("status", "parti").order("first_name"));
    if (!kids.length) return pageHead("Réserver une séance") + '<div class="empty">Votre compte n\'est pas encore relié à une famille. Écrivez-nous sur WhatsApp avec l\'adresse e-mail de ce compte.</div>';
    var nowIso = new Date().toISOString();
    var anims = await q(sb.from("animateurs").select("*").order("full_name"));
    var slots = await q(sb.from("slots").select("*").gte("starts_at", nowIso).order("starts_at"));
    var counts = await q(sb.rpc("slot_counts")); var booked = {}; (counts || []).forEach(function (c) { booked[c.slot_id] = c.booked; });
    var mine = await q(sb.from("bookings").select("*, slots(*)").order("created_at", { ascending: false }));
    var kidName = function (id) { var k = kids.find(function (x) { return x.id === id; }); return k ? k.first_name : ""; };
    var html = pageHead("Réserver une séance", "Une séance d'essai, une séance individuelle ou un rattrapage avec un animateur. La réservation est confirmée tout de suite ; vous pouvez l'annuler jusqu'à l'heure de la séance.");
    var active = mine.filter(function (b) { return b.status === "confirme" && b.slots && b.slots.starts_at >= nowIso; });
    var old = mine.filter(function (b) { return !(b.status === "confirme" && b.slots && b.slots.starts_at >= nowIso); });
    html += '<div class="card"><h3>Mes réservations</h3>' + (active.length ? '<div class="list">' + active.map(function (b) { var a = anims.find(function (x) { return x.id === b.slots.animateur_id; }); return '<div class="row-card' + (dayKey(b.slots.starts_at) === todayISO() ? " row-today" : "") + '"><div><div class="title">' + esc(dayLabel(dayKey(b.slots.starts_at)) + " à " + fmtTime(b.slots.starts_at)) + ' <span class="pill pill-green">Confirmée</span></div><div class="meta">' + esc(slotLabel(b.slots) + " · " + kidName(b.child_id) + " · avec " + (a ? a.full_name : "l'animateur") + (b.slots.mode === "visio" ? " · en ligne" : " · en présentiel") + " · " + b.slots.duration_min + " min") + (b.slots.note ? " · " + esc(b.slots.note) : "") + '</div></div><div class="actions">' + (b.slots.meeting_url ? launchBtn(b.slots, "btn-primary", "Rejoindre") : "") + '<button class="btn btn-secondary btn-sm" type="button" data-cancel-booking="' + b.id + '">Annuler</button></div></div>'; }).join("") + "</div>" : '<p class="muted">Aucune séance réservée pour l\'instant.</p>');
    if (old.length) html += '<details class="muted-sm" style="margin-top:8px"><summary>Séances passées ou annulées (' + old.length + ')</summary><div class="list" style="margin-top:10px">' + old.slice(0, 15).map(function (b) { return '<div class="row-card"><div><div class="title">' + esc(b.slots ? dayLabel(dayKey(b.slots.starts_at)) + " à " + fmtTime(b.slots.starts_at) : "") + ' <span class="pill">' + (b.status === "annule" ? "Annulée" : "Passée") + '</span></div><div class="meta">' + esc((b.slots ? slotLabel(b.slots) : "") + " · " + kidName(b.child_id)) + (b.note ? '</div><div class="report-box" style="margin-top:6px">' + esc(b.note) : "") + "</div></div></div>"; }).join("") + "</div></details>";
    html += "</div>";
    var pick = kids.length > 1 ? '<select name="child_id">' + optionsFrom(kids, "", function (k) { return k.first_name; }) + "</select>" : '<input type="hidden" name="child_id" value="' + kids[0].id + '">';
    html += '<h3>Les animateurs et leurs créneaux</h3><div class="anim-grid">' + (anims.length ? anims.map(function (a) {
      var mySlots = slots.filter(function (sl) { return sl.animateur_id === a.id; });
      var initials = (a.full_name || "?").split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 2).toUpperCase();
      var body = '<div class="anim-head"><div class="avatar">' + esc(initials) + '</div><div><div class="title">' + esc(a.full_name || "Animateur") + '</div><div class="badge-list" style="margin-top:4px">' + (pills(a.subjects) || '<span class="muted-sm">Matières à préciser</span>') + "</div></div></div>" + (a.bio ? '<p class="muted-sm">' + esc(a.bio) + "</p>" : "");
      body += mySlots.length ? '<div class="slot-list">' + mySlots.map(function (sl) {
        var n = booked[sl.id] || 0, left = sl.capacity - n;
        var already = active.find(function (b) { return b.slot_id === sl.id; });
        return '<div class="slot"><div><div class="title"><span class="time">' + esc(fmtTime(sl.starts_at)) + "</span> " + esc(dayLabel(dayKey(sl.starts_at))) + '</div><div class="meta">' + esc(slotLabel(sl) + " · " + sl.duration_min + " min" + (sl.mode === "visio" ? " · en ligne" : " · en présentiel") + " · " + (left > 0 ? left + " place" + (left > 1 ? "s" : "") : "complet")) + (sl.note ? " · " + esc(sl.note) : "") + "</div></div>" + (already ? '<span class="pill pill-green">Réservé pour ' + esc(kidName(already.child_id)) + "</span>" : left > 0 ? '<form class="book-form" data-book="' + sl.id + '">' + pick + '<button class="btn btn-primary btn-sm" type="submit">Réserver</button></form>' : '<span class="pill">Complet</span>') + "</div>";
      }).join("") + "</div>" : '<p class="muted-sm">Pas de créneau publié pour l\'instant.</p>';
      return '<div class="card anim-card">' + body + "</div>";
    }).join("") : '<div class="empty">Aucun animateur n\'a encore publié de créneau. Revenez bientôt ou écrivez-nous sur WhatsApp.</div>') + "</div>";
    setTimeout(function () {
      $$("[data-book]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); var r = await sb.from("bookings").insert({ slot_id: f.getAttribute("data-book"), child_id: v.child_id }); if (r.error) { toast(/complet|passé/i.test(r.error.message) ? r.error.message.replace(/^.*?:\s*/, "") : "Réservation impossible : " + r.error.message, true); return; } toast("Réservation confirmée pour " + kidName(v.child_id) + "."); route(); }); });
      $$("[data-cancel-booking]").forEach(function (b) { b.addEventListener("click", async function () { if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Confirmer l'annulation"; return; } await q(sb.from("bookings").update({ status: "annule" }).eq("id", b.getAttribute("data-cancel-booking"))); toast("Réservation annulée."); route(); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- ANIMATEUR et ADMIN : créneaux publiés et réservations reçues
  VIEWS.creneaux = async function () {
    if (roleIs("parent")) { location.hash = "reserver"; return ""; }
    var team = roleIs("admin") ? await q(sb.from("profiles").select("id, full_name, email, role").in("role", ["animateur", "admin"]).order("full_name")) : [profile];
    var since = new Date(Date.now() - 14 * 864e5).toISOString();
    var qb = sb.from("slots").select("*, bookings(*, children(first_name, families(parent_name, phone)))").gte("starts_at", since).order("starts_at");
    if (!roleIs("admin")) qb = qb.eq("animateur_id", profile.id);
    var slots = await q(qb);
    var animName = function (id) { var a = team.find(function (t) { return t.id === id; }); return a ? (a.full_name || a.email) : "Animateur"; };
    var form = function (sl) { sl = sl || {}; return '<form class="form" data-slot-form="' + (sl.id || "") + '"><div class="row">' + (roleIs("admin") ? field("Animateur", '<select name="animateur_id">' + optionsFrom(team, sl.animateur_id || profile.id, function (t) { return t.full_name || t.email; }) + "</select>") : "") + field("Date et heure", input("starts_at", localInput(sl.starts_at), "datetime-local", "required")) + field("Durée", '<select name="duration_min">' + DURATIONS.map(function (d) { return '<option value="' + d + '"' + ((sl.duration_min || 60) === d ? " selected" : "") + ">" + d + " min</option>"; }).join("") + "</select>") + "</div><div class=\"row\">" + field("Type", '<select name="kind">' + options(SLOT_KINDS, sl.kind || "individuel") + "</select>") + field("Matière ou thème", input("subject", sl.subject, "text", 'placeholder="Mathématiques 4e, Robotique, Prise de parole"')) + field("Places", input("capacity", sl.capacity || 1, "number", 'min="1" max="8"')) + "</div><div class=\"row\">" + field("Mode", '<select name="mode"><option value="visio"' + (sl.mode !== "presentiel" ? " selected" : "") + '>En ligne</option><option value="presentiel"' + (sl.mode === "presentiel" ? " selected" : "") + ">En présentiel</option></select>") + field("Lien de visio", '<div class="input-row">' + input("meeting_url", sl.meeting_url, "url", 'placeholder="https://meet.google.com/…"') + '<button class="btn btn-secondary btn-sm" type="button" data-make-room>Créer une salle</button></div>') + "</div>" + field("Note visible par les familles", input("note", sl.note, "text", 'placeholder="Apporter le cahier, lien envoyé la veille…"')) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">' + (sl.id ? "Enregistrer" : "Publier le créneau") + "</button></div></form>"; };
    var html = pageHead(roleIs("admin") ? "Créneaux" : "Mes créneaux", "Publiez des créneaux (séance d'essai, individuelle, rattrapage) : les familles les réservent depuis leur espace, vous voyez qui vient.", '<button class="btn btn-primary" type="button" data-toggle="new-slot">Publier un créneau</button>');
    html += '<div class="inline-form" id="new-slot" hidden><h3>Nouveau créneau</h3>' + form() + "</div>";
    if (!(profile.subjects && profile.bio)) html += '<p class="notice">Complétez votre fiche (matières, présentation) dans <a href="#compte">Mon compte</a> : les familles la voient avant de réserver.</p>';
    var nowIso = new Date().toISOString();
    var upcoming = slots.filter(function (sl) { return sl.starts_at >= nowIso; }), past = slots.filter(function (sl) { return sl.starts_at < nowIso; }).reverse();
    var row = function (sl) {
      var bks = (sl.bookings || []).filter(function (b) { return b.status === "confirme"; });
      var isPast = sl.starts_at < nowIso;
      return '<div class="row-card' + (dayKey(sl.starts_at) === todayISO() ? " row-today" : "") + '"><div><div class="title"><span class="time">' + esc(fmtTime(sl.starts_at)) + "</span> " + esc(dayLabel(dayKey(sl.starts_at))) + " · " + esc(slotLabel(sl)) + ' <span class="pill' + (bks.length >= sl.capacity ? "" : " pill-green") + '">' + bks.length + " / " + sl.capacity + '</span></div><div class="meta">' + esc([roleIs("admin") ? animName(sl.animateur_id) : "", sl.duration_min + " min", sl.mode === "visio" ? (sl.meeting_url ? "En ligne" : "En ligne · lien manquant") : "En présentiel", sl.note].filter(Boolean).join(" · ")) + "</div>" +
        (bks.length ? '<div class="list" style="margin-top:10px">' + bks.map(function (b) { var c = b.children || {}, f = c.families || {}; return '<div class="booking"><div><strong>' + esc(c.first_name || "Enfant") + "</strong>" + (f.parent_name ? ' <span class="muted-sm">· ' + esc(f.parent_name) + (f.phone ? ' · <a href="' + waLink(f.phone) + '" target="_blank" rel="noopener">' + esc(f.phone) + "</a>" : "") + "</span>" : "") + '</div><form class="input-row" data-booking-note="' + b.id + '">' + input("note", b.note, "text", 'placeholder="Mot pour les parents après la séance"') + '<button class="btn btn-secondary btn-sm" type="submit">Enregistrer</button>' + (isPast ? "" : '<button class="btn btn-secondary btn-sm" type="button" data-cancel-booking="' + b.id + '">Annuler</button>') + "</form></div>"; }).join("") + "</div>" : '<p class="muted-sm" style="margin-top:6px">Personne n\'a encore réservé.</p>') +
        '<div id="slot-' + sl.id + '" hidden><div class="inline-form" style="margin-top:12px">' + form(sl) + "</div></div></div>" +
        '<div class="actions">' + (!isPast && sl.meeting_url ? launchBtn(sl, "btn-primary", "Lancer") : "") + '<button class="btn btn-secondary btn-sm" type="button" data-toggle="slot-' + sl.id + '">Modifier</button>' + (bks.length ? "" : '<button class="btn btn-secondary btn-sm" type="button" data-delete-slot="' + sl.id + '">Supprimer</button>') + "</div></div>";
    };
    html += '<h3>À venir</h3><div class="list">' + (upcoming.length ? upcoming.map(row).join("") : '<div class="empty">Aucun créneau publié. Cliquez sur « Publier un créneau » : une séance d\'essai de 45 minutes en ligne est un bon début.</div>') + "</div>";
    if (past.length) html += '<h3>14 derniers jours</h3><div class="list">' + past.map(row).join("") + "</div>";
    setTimeout(function () {
      $$("[data-make-room]").forEach(function (b) { b.addEventListener("click", function () { var f = b.closest("form"); f.meeting_url.value = jitsiRoom((profile.full_name || "seance") + "-" + (f.starts_at.value || "").slice(0, 10), ""); }); });
      $$("[data-slot-form]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); var id = f.getAttribute("data-slot-form"); if (!v.starts_at) { toast("Indiquez la date et l'heure.", true); return; } var payload = { animateur_id: v.animateur_id || profile.id, starts_at: new Date(v.starts_at).toISOString(), duration_min: +v.duration_min || 60, kind: v.kind, subject: nullIfEmpty(v.subject), capacity: Math.min(8, Math.max(1, +v.capacity || 1)), mode: v.mode, meeting_url: nullIfEmpty(v.meeting_url), note: nullIfEmpty(v.note) }; if (id) await q(sb.from("slots").update(payload).eq("id", id)); else await q(sb.from("slots").insert(payload)); toast(id ? "Créneau enregistré." : "Créneau publié : les familles peuvent le réserver."); route(); }); });
      $$("[data-booking-note]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); await q(sb.from("bookings").update({ note: nullIfEmpty(v.note) }).eq("id", f.getAttribute("data-booking-note"))); toast("Mot enregistré : les parents le voient dans leur espace."); }); });
      $$("[data-cancel-booking]").forEach(function (b) { b.addEventListener("click", async function () { if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Confirmer"; return; } await q(sb.from("bookings").update({ status: "annule" }).eq("id", b.getAttribute("data-cancel-booking"))); toast("Réservation annulée. Prévenez la famille."); route(); }); });
      $$("[data-delete-slot]").forEach(function (b) { b.addEventListener("click", async function () { if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Confirmer"; return; } await q(sb.from("slots").delete().eq("id", b.getAttribute("data-delete-slot"))); toast("Créneau supprimé."); route(); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Rencontres métiers (tous)
  VIEWS.rencontres = async function () {
    var meetings = await q(sb.from("meetings").select("*, meeting_attendance(child_id)").order("meeting_at", { ascending: false }));
    var kids = roleIs("admin") ? await q(sb.from("children").select("id, first_name, status").neq("status", "parti").order("first_name")) : (roleIs("parent") ? await q(sb.from("children").select("id, first_name").order("first_name")) : []);
    var form = function (m) { m = m || {}; var dt = m.meeting_at ? new Date(m.meeting_at) : null; var local = dt ? dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()) + "T" + pad(dt.getHours()) + ":" + pad(dt.getMinutes()) : ""; return '<form class="form" data-meeting-form="' + (m.id || "") + '"><div class="row">' + field("Titre", input("title", m.title, "text", 'required placeholder="Une journée d\'ingénieure en génie civil"')) + field("Intervenant", input("pro_name", m.pro_name)) + field("Métier", input("job", m.job)) + "</div><div class=\"row\">" + field("Date et heure", input("meeting_at", local, "datetime-local")) + field("Mode", '<select name="mode"><option value="visio"' + (m.mode !== "presentiel" ? " selected" : "") + '>En visio</option><option value="presentiel"' + (m.mode === "presentiel" ? " selected" : "") + ">En présentiel</option></select>") + "</div>" + field("Notes (lien visio, questions préparées)", textarea("notes", m.notes, 3)) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>'; };
    var html = pageHead("Rencontres métiers", roleIs("parent") ? "Les prochaines rencontres et celles auxquelles vos enfants ont participé." : "Une rencontre par mois : un professionnel, 45 minutes, les questions des enfants.", roleIs("admin") ? '<button class="btn btn-primary" type="button" data-toggle="new-meeting">Nouvelle rencontre</button>' : "");
    if (roleIs("admin")) html += '<div class="inline-form" id="new-meeting" hidden><h3>Nouvelle rencontre</h3>' + form() + "</div>";
    var now = Date.now();
    html += '<div class="list">' + (meetings.length ? meetings.map(function (m) {
      var ids = (m.meeting_attendance || []).map(function (a) { return a.child_id; });
      var upcoming = m.meeting_at && new Date(m.meeting_at).getTime() > now;
      var mine = roleIs("parent") ? kids.filter(function (k) { return ids.indexOf(k.id) >= 0; }).map(function (k) { return k.first_name; }) : [];
      var body = '<div><div class="title">' + esc(m.title) + (upcoming ? ' <span class="pill pill-green">À venir</span>' : "") + '</div><div class="meta">' + [m.pro_name ? esc(m.pro_name) + (m.job ? ", " + esc(m.job) : "") : "", m.meeting_at ? esc(fmtDateTime(m.meeting_at)) : "Date à confirmer", m.mode === "presentiel" ? "En présentiel" : "En visio", roleIs("parent") ? (mine.length ? "Participation : " + esc(mine.join(", ")) : "") : ids.length + " enfant" + (ids.length > 1 ? "s" : "") + " inscrit" + (ids.length > 1 ? "s" : "")].filter(Boolean).join(" · ") + "</div>" + (m.notes && !roleIs("parent") ? '<p class="muted-sm" style="margin-top:6px">' + esc(m.notes) + "</p>" : "");
      if (roleIs("admin")) body += '<div id="meet-' + m.id + '" hidden><div class="inline-form" style="margin-top:12px">' + form(m) + '<h4 style="margin-top:16px">Enfants inscrits</h4><form class="form" data-meeting-att="' + m.id + '"><div class="check-list">' + kids.map(function (k) { return '<label class="check-row" style="grid-template-columns:auto 1fr"><input type="checkbox" name="k-' + k.id + '"' + (ids.indexOf(k.id) >= 0 ? " checked" : "") + '><span>' + esc(k.first_name) + "</span></label>"; }).join("") + '</div><div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer les participants</button></div></form></div></div>';
      body += "</div>";
      return '<div class="row-card">' + body + (roleIs("admin") ? '<div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-toggle="meet-' + m.id + '">Modifier</button></div>' : "") + "</div>";
    }).join("") : '<div class="empty">Aucune rencontre planifiée pour l\'instant.</div>') + "</div>";
    setTimeout(function () {
      $$("[data-meeting-form]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); var id = f.getAttribute("data-meeting-form"); var payload = { title: v.title, pro_name: nullIfEmpty(v.pro_name), job: nullIfEmpty(v.job), meeting_at: v.meeting_at ? new Date(v.meeting_at).toISOString() : null, mode: v.mode, notes: nullIfEmpty(v.notes) }; if (!payload.title) return; if (id) await q(sb.from("meetings").update(payload).eq("id", id)); else await q(sb.from("meetings").insert(payload)); toast("Rencontre enregistrée."); route(); }); });
      $$("[data-meeting-att]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var id = f.getAttribute("data-meeting-att"); var v = readForm(f); var chosen = kids.filter(function (k) { return v["k-" + k.id]; }).map(function (k) { return { meeting_id: id, child_id: k.id }; }); await q(sb.from("meeting_attendance").delete().eq("meeting_id", id)); if (chosen.length) await q(sb.from("meeting_attendance").insert(chosen)); toast("Participants enregistrés."); route(); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- ADMIN : équipe (rôles et liaison des comptes)
  VIEWS.equipe = async function () {
    var people = await q(sb.from("profiles").select("*").order("created_at", { ascending: false }));
    var fams = await q(sb.from("families").select("id, parent_name, email").order("parent_name"));
    var html = pageHead("Équipe et comptes", "Les accès sont créés par vous, jamais par les familles. Vous choisissez ici le rôle de chaque compte ; un parent est relié automatiquement à sa famille quand les e-mails correspondent.");
    html += '<div class="notice"><strong>Créer un accès</strong> : <a href="https://supabase.com/dashboard/project/' + (C.supabaseUrl || "").replace(/^https:\/\/([^.]+)\..*$/, "$1") + '/auth/users" target="_blank" rel="noopener">Supabase › Authentication › Users</a> › « Add user » › « Create new user » : l\'e-mail de la fiche famille, un mot de passe provisoire, case « Auto confirm user » cochée. Le compte apparaît ici en quelques secondes ; envoyez l\'e-mail et le mot de passe au parent sur WhatsApp, il le changera dans « Mon compte ».</div>';
    html += '<div class="list">' + people.map(function (p) { return '<div class="row-card"><div><div class="title">' + esc(p.full_name || "Sans nom") + ' <span class="pill' + (p.role === "admin" ? " pill-green" : "") + '">' + esc(ROLES[p.role]) + '</span></div><div class="meta">' + esc(p.email || "") + (p.phone ? " · " + esc(p.phone) : "") + " · depuis le " + esc(fmtDate(p.created_at)) + '</div></div><div class="actions"><select class="status" data-role="' + p.id + '"' + (p.id === profile.id ? " disabled" : "") + ">" + options(ROLES, p.role) + '</select><select class="status" data-family-link="' + p.id + '">' + optionsFrom(fams, p.family_id, function (f) { return f.parent_name + (f.email ? " · " + f.email : ""); }, "Aucune famille") + "</select></div></div>"; }).join("") + "</div>";
    setTimeout(function () {
      $$("[data-role]").forEach(function (sel) { sel.addEventListener("change", async function () { await q(sb.from("profiles").update({ role: sel.value }).eq("id", sel.getAttribute("data-role"))); toast("Rôle enregistré."); }); });
      $$("[data-family-link]").forEach(function (sel) { sel.addEventListener("change", async function () { await q(sb.from("profiles").update({ family_id: nullIfEmpty(sel.value) }).eq("id", sel.getAttribute("data-family-link"))); toast("Compte relié."); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Mon compte (animateur et parent)
  VIEWS.compte = async function () {
    var html = pageHead("Mon compte");
    var team = roleIs("admin") || roleIs("animateur");
    html += '<div class="detail-grid"><form class="form card" id="form-profile">' + field("Nom", input("full_name", profile.full_name)) + field("WhatsApp", input("phone", profile.phone, "tel")) + field("E-mail", input("email", profile.email, "email", "disabled")) + (team ? '<h3 style="margin-top:8px">Ma fiche, vue par les familles</h3>' + field("Matières", input("subjects", profile.subjects, "text", 'placeholder="Mathématiques collège, Physique lycée, Robotique"'), "Séparées par des virgules. Affichées sur la page Réserver.") + field("Présentation", textarea("bio", profile.bio, 3), "Deux ou trois phrases : votre parcours, ce que vous aimez faire avec les enfants.") : "") + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>';
    html += '<form class="form card" id="form-password"><h3>Changer le mot de passe</h3>' + field("Nouveau mot de passe", input("password", "", "password", 'minlength="8" autocomplete="new-password"'), "8 caractères au minimum.") + '<div class="btn-row"><button class="btn btn-secondary btn-sm" type="submit">Mettre à jour</button></div></form></div>';
    setTimeout(function () {
      $("#form-profile").addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(e.target); var payload = { full_name: v.full_name, phone: nullIfEmpty(v.phone) }; if (team) { payload.subjects = nullIfEmpty(v.subjects || ""); payload.bio = nullIfEmpty(v.bio || ""); } await q(sb.from("profiles").update(payload).eq("id", profile.id)); profile.full_name = v.full_name; profile.subjects = payload.subjects; profile.bio = payload.bio; $("#user-name").textContent = v.full_name || profile.email; toast("Compte enregistré."); });
      $("#form-password").addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(e.target); if ((v.password || "").length < 8) { toast("8 caractères au minimum.", true); return; } var r = await sb.auth.updateUser({ password: v.password }); if (r.error) toast(r.error.message, true); else { toast("Mot de passe mis à jour."); e.target.reset(); } });
    }, 0);
    return html;
  };

  init();
})();
