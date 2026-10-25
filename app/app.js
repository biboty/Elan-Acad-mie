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

  async function q(promise) {
    var res = await promise;
    if (res.error) { toast(res.error.message || "Erreur", true); throw res.error; }
    return res.data;
  }

  // ---------------------------------------------------------------- démarrage et authentification
  function show(id) { ["view-config", "view-auth", "view-app"].forEach(function (v) { $("#" + v).hidden = v !== id; }); }

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
    $("#auth-card").hidden = false;
    $("#form-login").hidden = which !== "login";
    $("#form-signup").hidden = which !== "signup";
    $("#form-reset").hidden = which !== "reset";
    $$(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === which); });
  }

  function bindAuth() {
    $$(".tab, [data-auth]").forEach(function (t) { t.addEventListener("click", function () { showAuthForm(t.getAttribute("data-tab") || t.getAttribute("data-auth")); var card = $("#auth-card"); if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" }); }); });
    $("#form-login").addEventListener("submit", async function (e) {
      e.preventDefault(); $("#login-error").textContent = "";
      var r = await sb.auth.signInWithPassword({ email: $("#login-email").value.trim(), password: $("#login-password").value });
      if (r.error) $("#login-error").textContent = r.error.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect." : r.error.message;
    });
    $("#form-signup").addEventListener("submit", async function (e) {
      e.preventDefault(); $("#signup-error").textContent = "";
      var email = $("#signup-email").value.trim(), pwd = $("#signup-password").value, name = $("#signup-name").value.trim();
      if (!name || !email || pwd.length < 8) { $("#signup-error").textContent = "Nom, e-mail et un mot de passe de 8 caractères au minimum."; return; }
      var r = await sb.auth.signUp({ email: email, password: pwd, options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname } });
      if (r.error) { $("#signup-error").textContent = r.error.message; return; }
      if (!r.data.session) { $("#auth-info").textContent = "Compte créé. Ouvrez l'e-mail de confirmation que nous venons d'envoyer à " + email + ", puis connectez-vous."; showAuthForm("login"); }
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
    admin: [["accueil", "Tableau de bord"], ["liste", "Liste d'attente"], ["familles", "Familles"], ["enfants", "Enfants"], ["groupes", "Groupes"], ["seances", "Séances"], ["retours", "Retours mensuels"], ["rencontres", "Rencontres métiers"], ["equipe", "Équipe"], ["compte", "Mon compte"]],
    animateur: [["seances", "Mes séances"], ["enfants", "Mes enfants"], ["retours", "Retours mensuels"], ["rencontres", "Rencontres métiers"], ["compte", "Mon compte"]],
    parent: [["enfants", "Mes enfants"], ["rencontres", "Rencontres métiers"], ["compte", "Mon compte"]]
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
    $("#app-nav").innerHTML = '<div class="wrap">' + items.map(function (i) { return '<a href="#' + i[0] + '"' + (i[0] === token || (token === "enfant" && i[0] === "enfants") || (token === "seance" && i[0] === "seances") || (token === "rencontre" && i[0] === "rencontres") ? ' class="active"' : "") + ">" + esc(i[1]) + "</a>"; }).join("") + "</div>";
    var fn = VIEWS[token];
    var arg = hash.split("/")[1];
    $("#app-content").innerHTML = '<p class="muted">Chargement…</p>';
    Promise.resolve(fn(arg)).then(function (html) { if (typeof html === "string") $("#app-content").innerHTML = html; bindContent(); }).catch(function (e) { $("#app-content").innerHTML = '<div class="empty">Impossible de charger cette page. ' + esc(e.message || "") + "</div>"; });
  }

  function bindContent() {
    var root = $("#app-content");
    $$("[data-toggle]", root).forEach(function (b) { b.addEventListener("click", function () { var t = $("#" + b.getAttribute("data-toggle")); t.hidden = !t.hidden; if (!t.hidden) { var f = $("input, select, textarea", t); if (f) f.focus(); } }); });
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
    var sessions = await q(sb.from("sessions").select("id, session_date, groups(name)").gte("session_date", todayISO()).lte("session_date", weekEnd.toISOString().slice(0, 10)).order("session_date"));
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
    html += '<div class="card"><h3>Séances des 7 prochains jours</h3>' + (sessions.length ? '<div class="list">' + sessions.map(function (s) { return '<div class="row-card"><div><div class="title">' + esc(fmtDate(s.session_date)) + '</div><div class="meta">Groupe ' + esc(s.groups ? s.groups.name : "") + '</div></div><div class="actions"><a class="btn btn-secondary btn-sm" href="#seance/' + s.id + '">Ouvrir</a></div></div>'; }).join("") + "</div>" : '<p class="muted">Aucune séance créée pour la semaine. Les animateurs les créent le jour même depuis « Mes séances ».</p>') + "</div></div>";
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
    var att = await q(sb.from("attendance").select("present, note, session_id, sessions(session_date, summary)").eq("child_id", k.id));
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
    html += '<h3 style="margin-top:20px">Séances</h3>' + (att.length ? '<div class="list" style="margin-top:8px">' + att.slice(0, 12).map(function (a) { return '<div class="row-card"><div><div class="title">' + esc(fmtDate(a.sessions ? a.sessions.session_date : "")) + ' <span class="pill' + (a.present ? " pill-green" : "") + '">' + (a.present ? "Présent" : "Absent") + '</span></div><div class="meta">' + esc(a.note || (a.sessions && a.sessions.summary) || "") + "</div></div></div>"; }).join("") + "</div>" : '<p class="muted">Aucune séance enregistrée pour l\'instant.</p>');
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
    var form = function (g) { g = g || {}; return '<form class="form" data-group-form="' + (g.id || "") + '"><div class="row">' + field("Nom du groupe", input("name", g.name, "text", 'required placeholder="Bâtisseurs samedi 10 h"')) + field("Type", '<select name="kind">' + options(KINDS, g.kind || "atelier") + "</select>") + field("Niveau", '<select name="level">' + options(LEVELS, g.level || "batisseurs") + "</select>", "Ateliers : Explorateurs à Décideurs. Cours : collège ou lycée.") + "</div><div class=\"row\">" + field("Jour", '<select name="day">' + DAYS.map(function (d) { return '<option value="' + d + '"' + (g.day === d ? " selected" : "") + ">" + d + "</option>"; }).join("") + "</select>") + field("Heure de début", input("start_time", g.start_time, "text", 'placeholder="10 h"')) + field("Animateur", '<select name="animateur_id">' + optionsFrom(team, g.animateur_id, function (t) { return t.full_name || t.email; }, "À attribuer") + "</select>") + "</div>" + field("Groupe actif", '<label class="muted-sm"><input type="checkbox" name="active"' + (g.active !== false ? " checked" : "") + "> Les groupes inactifs disparaissent des listes</label>") + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>'; };
    var html = pageHead("Groupes", "Un groupe = un niveau, un jour, un animateur, 8 enfants au maximum.", '<button class="btn btn-primary" type="button" data-toggle="new-group">Nouveau groupe</button>');
    html += '<div class="inline-form" id="new-group" hidden><h3>Nouveau groupe</h3>' + form() + "</div>";
    if (!team.length) html += '<p class="notice">Aucun animateur pour l\'instant : l\'animateur crée son compte sur cette page, puis vous lui donnez le rôle « Animateur » dans l\'onglet Équipe.</p>';
    html += '<div class="list">' + (groups.length ? groups.map(function (g) { var n = (g.kind === "cours" ? (g.course_children || []) : (g.children || [])).length; var max = g.kind === "cours" ? 6 : 8; return '<div class="row-card"><div><div class="title">' + esc(g.name) + ' <span class="pill' + (g.kind === "cours" ? "" : " pill-green") + '">' + esc(KINDS[g.kind] || "Atelier") + "</span>" + (g.active ? "" : ' <span class="pill">Inactif</span>') + (n >= max ? ' <span class="pill">Complet</span>' : "") + '</div><div class="meta">' + [LEVELS[g.level], g.day ? g.day + (g.start_time ? " " + g.start_time : "") : "", animLabel(g.animateur_id), n + " enfant" + (n > 1 ? "s" : "") + " sur " + max].filter(Boolean).map(esc).join(" · ") + '</div><div id="grp-' + g.id + '" hidden><div class="inline-form" style="margin-top:12px">' + form(g) + '</div></div></div><div class="actions"><button class="btn btn-secondary btn-sm" type="button" data-toggle="grp-' + g.id + '">Modifier</button></div></div>'; }).join("") : '<div class="empty">Aucun groupe. Commencez par un atelier Bâtisseurs (10-12 ans), un atelier Argumentateurs (13-15 ans) et un groupe de cours collège.</div>') + "</div>";
    setTimeout(function () {
      $$("[data-group-form]").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(f); var id = f.getAttribute("data-group-form"); var payload = { name: v.name, kind: v.kind || "atelier", level: v.level, day: v.day, start_time: nullIfEmpty(v.start_time), animateur_id: nullIfEmpty(v.animateur_id), active: !!v.active }; if (!payload.name) return; if (id) await q(sb.from("groups").update(payload).eq("id", id)); else await q(sb.from("groups").insert(payload)); toast("Groupe enregistré."); route(); }); });
    }, 0);
    return html;
  };

  // ---------------------------------------------------------------- Séances (admin et animateur)
  VIEWS.seances = async function () {
    var groups = await q(sb.from("groups").select("*, children:children!children_group_id_fkey(id), course_children:children!children_course_group_id_fkey(id)").eq("active", true).order("name"));
    var sessions = await q(sb.from("sessions").select("*, groups(name, kind)").order("session_date", { ascending: false }).limit(60));
    var html = pageHead(roleIs("admin") ? "Séances" : "Mes séances", "Créez la séance du jour, cochez les présents, notez ce qui s'est passé.");
    if (!groups.length) return html + '<div class="empty">' + (roleIs("admin") ? "Aucun groupe actif. Créez-en un dans l'onglet Groupes." : "Aucun groupe ne vous est attribué pour l'instant. L'administration vous en attribuera un.") + "</div>";
    html += '<div class="card"><h3>Nouvelle séance</h3><form class="form" id="form-session"><div class="row">' + field("Groupe", '<select name="group_id">' + optionsFrom(groups, "", function (g) { return (KINDS[g.kind] || "Atelier") + " · " + g.name + " · " + (g.kind === "cours" ? (g.course_children || []) : (g.children || [])).length + " enfants"; }) + "</select>") + field("Date", input("session_date", todayISO(), "date", "required")) + '</div><div class="btn-row"><button class="btn btn-primary" type="submit">Ouvrir la feuille de présence</button></div></form></div>';
    html += '<h3>Séances passées</h3><div class="list">' + (sessions.length ? sessions.map(function (s) { return '<div class="row-card"><div><div class="title">' + esc(fmtDate(s.session_date)) + " · " + esc(s.groups ? (KINDS[s.groups.kind] || "Atelier") + " " + s.groups.name : "") + '</div><div class="meta">' + esc(s.summary || "Pas de résumé") + '</div></div><div class="actions"><a class="btn btn-secondary btn-sm" href="#seance/' + s.id + '">Ouvrir</a></div></div>'; }).join("") : '<div class="empty">Aucune séance enregistrée.</div>') + "</div>";
    setTimeout(function () {
      $("#form-session").addEventListener("submit", async function (e) {
        e.preventDefault(); var v = readForm(e.target);
        var existing = await q(sb.from("sessions").select("id").eq("group_id", v.group_id).eq("session_date", v.session_date).maybeSingle());
        if (existing) { location.hash = "seance/" + existing.id; return; }
        var s = await q(sb.from("sessions").insert({ group_id: v.group_id, session_date: v.session_date, animateur_id: session.user.id }).select().single());
        location.hash = "seance/" + s.id;
      });
    }, 0);
    return html;
  };
  VIEWS.seance = async function (id) {
    if (!id) { location.hash = "seances"; return ""; }
    var s = await q(sb.from("sessions").select("*, groups(id, name, kind, level)").eq("id", id).single());
    var kids = await q(sb.from("children").select("id, first_name, status").or("group_id.eq." + s.group_id + ",course_group_id.eq." + s.group_id).neq("status", "parti").order("first_name"));
    var att = await q(sb.from("attendance").select("*").eq("session_id", id));
    var byKid = {}; att.forEach(function (a) { byKid[a.child_id] = a; });
    var canEdit = roleIs("admin") || roleIs("animateur");
    var html = '<p><a href="#seances">← Toutes les séances</a></p>' + pageHead("Séance du " + fmtDate(s.session_date), (s.groups ? (KINDS[s.groups.kind] || "Atelier") + " " + s.groups.name : "") + " · " + (LEVELS[s.groups ? s.groups.level : ""] || ""));
    html += '<form class="form" id="form-attendance"><div class="check-list">' + (kids.length ? kids.map(function (k) { var a = byKid[k.id]; return '<label class="check-row"><input type="checkbox" name="present-' + k.id + '"' + (!a || a.present ? " checked" : "") + (canEdit ? "" : " disabled") + '><span class="title">' + esc(k.first_name) + '</span><input type="text" name="note-' + k.id + '" value="' + esc(a ? a.note || "" : "") + '" placeholder="Note pour cet enfant (facultatif)"' + (canEdit ? "" : " disabled") + "></label>"; }).join("") : '<div class="empty">Aucun enfant dans ce groupe.</div>') + "</div>";
    html += field("Ce qui a été fait, ce qui a bloqué", textarea("summary", s.summary, 4));
    if (canEdit) html += '<div class="btn-row"><button class="btn btn-primary" type="submit">Enregistrer la séance</button><button class="btn btn-secondary" type="button" id="btn-delete-session">Supprimer cette séance</button></div>';
    html += "</form>";
    setTimeout(function () {
      if (!canEdit) return;
      $("#form-attendance").addEventListener("submit", async function (e) {
        e.preventDefault(); var v = readForm(e.target);
        var rows = kids.map(function (k) { return { session_id: id, child_id: k.id, present: !!v["present-" + k.id], note: nullIfEmpty(v["note-" + k.id] || "") }; });
        if (rows.length) await q(sb.from("attendance").upsert(rows, { onConflict: "session_id,child_id" }));
        await q(sb.from("sessions").update({ summary: nullIfEmpty(v.summary) }).eq("id", id));
        toast("Séance enregistrée : " + rows.filter(function (r) { return r.present; }).length + " présent" + (rows.filter(function (r) { return r.present; }).length > 1 ? "s" : "") + ".");
      });
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
    var html = pageHead("Équipe et comptes", "Chaque personne crée son compte sur la page de connexion ; vous choisissez ici son rôle. Un parent est relié automatiquement à sa famille quand les e-mails correspondent.");
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
    html += '<div class="detail-grid"><form class="form card" id="form-profile">' + field("Nom", input("full_name", profile.full_name)) + field("WhatsApp", input("phone", profile.phone, "tel")) + field("E-mail", input("email", profile.email, "email", "disabled")) + '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Enregistrer</button></div></form>';
    html += '<form class="form card" id="form-password"><h3>Changer le mot de passe</h3>' + field("Nouveau mot de passe", input("password", "", "password", 'minlength="8" autocomplete="new-password"'), "8 caractères au minimum.") + '<div class="btn-row"><button class="btn btn-secondary btn-sm" type="submit">Mettre à jour</button></div></form></div>';
    setTimeout(function () {
      $("#form-profile").addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(e.target); await q(sb.from("profiles").update({ full_name: v.full_name, phone: nullIfEmpty(v.phone) }).eq("id", profile.id)); profile.full_name = v.full_name; $("#user-name").textContent = v.full_name || profile.email; toast("Compte enregistré."); });
      $("#form-password").addEventListener("submit", async function (e) { e.preventDefault(); var v = readForm(e.target); if ((v.password || "").length < 8) { toast("8 caractères au minimum.", true); return; } var r = await sb.auth.updateUser({ password: v.password }); if (r.error) toast(r.error.message, true); else { toast("Mot de passe mis à jour."); e.target.reset(); } });
    }, 0);
    return html;
  };

  init();
})();
