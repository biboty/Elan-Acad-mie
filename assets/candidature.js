/* Élan Académie — test des candidats animateurs en trois étapes (QCM, présentation, situation).
   Le candidat n'a pas de compte : il avance avec un jeton ; la base ne lui montre jamais les bonnes réponses. */
(function () {
  "use strict";
  var C = window.ELAN_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  if (!C.supabaseUrl || !C.supabaseAnonKey || !window.supabase) { var f0 = $("#cand-form"); if (f0) { $("#cand-erreur").textContent = "Le test n'est pas encore activé. Écrivez-nous sur WhatsApp."; } return; }
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
  var token = null, quiz = [];

  function step(n) {
    ["cand-form", "cand-quiz", "cand-video1", "cand-video2", "cand-done"].forEach(function (id, i) { $("#" + id).hidden = i !== n; });
    $$("#cand-progress span").forEach(function (sp, i) { sp.classList.toggle("on", i <= n); sp.classList.toggle("done", i < n); });
    var box = $("#cand"); if (box && box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function rpc(name, args) { var r = await sb.rpc(name, args || {}); if (r.error) throw new Error(r.error.message); return r.data; }

  // Étape 0 : identité
  $("#cand-form").addEventListener("submit", async function (e) {
    e.preventDefault(); var err = $("#cand-erreur"); err.textContent = "";
    var f = e.target;
    var name = f.full_name.value.trim(), email = f.email.value.trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "Nom et e-mail valides, s'il vous plaît."; return; }
    var btn = $("button[type=submit]", f); btn.disabled = true;
    try {
      token = await rpc("candidate_start", { p_name: name, p_email: email, p_phone: f.phone.value.trim(), p_subject: f.subject.value, p_level: f.level.value, p_experience: f.experience.value.trim() });
      quiz = await rpc("candidate_quiz", { p_token: token });
      if (!quiz.length) { err.textContent = "Pas encore de questions pour cette matière. Écrivez-nous sur WhatsApp, nous vous envoyons le test autrement."; btn.disabled = false; return; }
      $("#quiz-list").innerHTML = quiz.map(function (qq, i) { return '<fieldset class="quiz-q"><legend>' + (i + 1) + ". " + esc(qq.question) + "</legend>" + (qq.options || []).map(function (o, j) { return '<label class="quiz-opt"><input type="radio" name="q-' + qq.id + '" value="' + j + '"><span>' + esc(o) + "</span></label>"; }).join("") + "</fieldset>"; }).join("");
      step(1);
    } catch (ex) { err.textContent = "Impossible de commencer : " + ex.message; btn.disabled = false; }
  });

  // Étape 1 : QCM
  $("#quiz-form").addEventListener("submit", async function (e) {
    e.preventDefault(); var err = $("#quiz-erreur"); err.textContent = "";
    var answers = [], missing = 0;
    quiz.forEach(function (qq) { var sel = $('input[name="q-' + qq.id + '"]:checked'); if (!sel) missing++; else answers.push({ id: qq.id, answer: +sel.value }); });
    if (missing) { err.textContent = "Il reste " + missing + " question" + (missing > 1 ? "s" : "") + " sans réponse."; return; }
    var btn = $("button[type=submit]", e.target); btn.disabled = true;
    try { await rpc("candidate_quiz_submit", { p_token: token, p_answers: answers }); setupRecorder(1); step(2); }
    catch (ex) { err.textContent = "Envoi impossible : " + ex.message; btn.disabled = false; }
  });

  // Étapes 2 et 3 : enregistrement vidéo dans le navigateur, ou lien externe
  function setupRecorder(stepNo) {
    var box = $('.recorder[data-step="' + stepNo + '"]'); if (box.getAttribute("data-ready")) return; box.setAttribute("data-ready", "1");
    var max = +box.getAttribute("data-max") || 180;
    box.innerHTML = '<div class="rec-stage"><video class="rec-video" playsinline muted autoplay></video><div class="rec-timer" hidden>0:00</div></div>' +
      '<div class="btn-row rec-controls"><button class="btn btn-primary" type="button" data-rec="start">Activer la caméra</button><button class="btn btn-primary" type="button" data-rec="record" hidden>Enregistrer</button><button class="btn btn-secondary" type="button" data-rec="stop" hidden>Arrêter</button><button class="btn btn-secondary" type="button" data-rec="retry" hidden>Recommencer</button><button class="btn btn-primary" type="button" data-rec="send" hidden>Envoyer cette vidéo</button></div>' +
      '<p class="small muted rec-status"></p>' +
      '<details class="small muted"><summary>La caméra ne fonctionne pas ? Collez un lien vers votre vidéo</summary><div class="input-row" style="margin-top:8px"><input type="url" class="rec-link" placeholder="https://drive.google.com/… ou YouTube (non répertorié)"><button class="btn btn-secondary btn-sm" type="button" data-rec="link">Envoyer le lien</button></div></details>';
    var video = $(".rec-video", box), timer = $(".rec-timer", box), status = $(".rec-status", box);
    var B = {}; $$("[data-rec]", box).forEach(function (b) { B[b.getAttribute("data-rec")] = b; });
    var stream = null, rec = null, chunks = [], blob = null, tick = null, started = 0, mime = "";
    function showButtons() { var a = Array.prototype.slice.call(arguments); Object.keys(B).forEach(function (k) { if (k !== "link") B[k].hidden = a.indexOf(k) < 0; }); }
    function fmt(s) { return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
    B.start.addEventListener("click", async function () {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: true }); }
      catch (ex) { status.textContent = "Caméra ou micro refusés. Autorisez-les dans le navigateur, ou collez un lien ci-dessous."; return; }
      video.srcObject = stream; video.muted = true; video.controls = false; video.play().catch(function () {});
      mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); }) || "";
      if (!window.MediaRecorder) { status.textContent = "Ce navigateur ne sait pas enregistrer. Utilisez Chrome, ou collez un lien ci-dessous."; return; }
      status.textContent = "Caméra prête. Cliquez sur Enregistrer quand vous l'êtes. " + fmt(max) + " au maximum.";
      showButtons("record");
    });
    B.record.addEventListener("click", function () {
      chunks = []; rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 800000 } : undefined);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () { blob = new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }); video.srcObject = null; video.muted = false; video.controls = true; video.src = URL.createObjectURL(blob); status.textContent = "Regardez votre vidéo (" + Math.round(blob.size / 1048576 * 10) / 10 + " Mo). Envoyez-la, ou recommencez."; showButtons("retry", "send"); };
      rec.start(1000); started = Date.now(); timer.hidden = false; timer.textContent = "0:00";
      tick = setInterval(function () { var s = Math.floor((Date.now() - started) / 1000); timer.textContent = fmt(s) + " / " + fmt(max); if (s >= max) B.stop.click(); }, 500);
      status.textContent = "Enregistrement en cours…"; showButtons("stop");
    });
    B.stop.addEventListener("click", function () { if (rec && rec.state !== "inactive") rec.stop(); clearInterval(tick); timer.hidden = true; });
    B.retry.addEventListener("click", function () { blob = null; video.controls = false; video.src = ""; video.srcObject = stream; video.muted = true; video.play().catch(function () {}); status.textContent = "Caméra prête."; showButtons("record"); });
    B.send.addEventListener("click", async function () {
      if (!blob) return; showButtons(); status.textContent = "Envoi de la vidéo… ne fermez pas la page.";
      var ext = /mp4/.test(blob.type) ? "mp4" : "webm";
      var path = token + "/" + (stepNo === 1 ? "presentation" : "situation") + "-" + Date.now() + "." + ext;
      var up = await sb.storage.from("candidatures").upload(path, blob, { contentType: blob.type || "video/webm", upsert: false });
      if (up.error) { status.textContent = "Envoi impossible (" + up.error.message + "). Réessayez, ou collez un lien ci-dessous."; showButtons("retry", "send"); return; }
      try { await rpc("candidate_video", { p_token: token, p_step: stepNo, p_path: path, p_link: "" }); } catch (ex) { status.textContent = "Erreur : " + ex.message; showButtons("retry", "send"); return; }
      stopStream(); next(stepNo);
    });
    B.link.addEventListener("click", async function () {
      var url = $(".rec-link", box).value.trim(); if (!/^https?:\/\//.test(url)) { status.textContent = "Collez un lien complet (https://…)."; return; }
      try { await rpc("candidate_video", { p_token: token, p_step: stepNo, p_path: "", p_link: url }); } catch (ex) { status.textContent = "Erreur : " + ex.message; return; }
      stopStream(); next(stepNo);
    });
    function stopStream() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }
  async function next(stepNo) {
    if (stepNo === 1) {
      try { var sit = await rpc("candidate_situation", { p_token: token }); var s0 = sit && sit[0]; $("#sit-title").textContent = s0 ? s0.title : "Situation"; $("#sit-text").textContent = s0 ? s0.statement : "Décrivez une erreur fréquente d'un élève dans votre matière et expliquez comment vous la corrigez."; }
      catch (ex) { $("#sit-text").textContent = "Décrivez une erreur fréquente d'un élève dans votre matière et expliquez comment vous la corrigez."; }
      setupRecorder(2); step(3);
    } else {
      try { await rpc("candidate_finish", { p_token: token }); } catch (ex) {}
      step(4);
    }
  }
})();
