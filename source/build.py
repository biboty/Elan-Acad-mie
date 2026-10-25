# -*- coding: utf-8 -*-
"""Construit le site Élan Académie : pages complètes dans out/site/, version artefact (index sans squelette) dans out/artifact/."""
import os, re, shutil, urllib.parse

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SRC, "out")
LOGOS = "/tmp/claude-0/-home-claude/5ecf6d4b-e17a-54bc-b780-e2304a107edc/scratchpad/logos"

SYMBOL_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" {attrs}>'
              '<path d="M60 240L144 160" stroke="{node}" stroke-width="14" stroke-linecap="round" fill="none"/>'
              '<path d="M144 160L238 68" stroke="{node}" stroke-width="14" stroke-linecap="round" fill="none"/>'
              '<circle cx="60" cy="240" r="18" fill="{node}"/><circle cx="144" cy="160" r="24" fill="{node}"/>'
              '<circle cx="238" cy="68" r="32" fill="{top}"/></svg>')

def symbol(attrs="", node="var(--sym-node)", top="var(--sym-top)"):
    return SYMBOL_SVG.format(attrs=attrs, node=node, top=top)

FAVICON = "data:image/svg+xml," + urllib.parse.quote(SYMBOL_SVG.format(attrs='width="64" height="64"', node="#243B8C", top="#3EC28F"))

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@500;600&family=Nunito+Sans:wght@400;700&display=swap">'

NAV = [("index.html", "Accueil"), ("programme.html", "Programme"), ("parcours.html", "Parcours"), ("metiers.html", "Rencontres métiers"),
       ("stages.html", "Stages"), ("a-propos.html", "À propos"), ("faq.html", "FAQ")]

def header(current):
    links = "".join('<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == current else "", t) for h, t in NAV if h != "index.html")
    return f'''<header class="site-header">
  <div class="wrap">
    <a class="brand logo-switch" href="index.html" aria-label="Élan Académie, accueil">
      <img class="logo-light" src="assets/logo-horizontal.svg" alt="Élan Académie" width="94" height="40">
      <img class="logo-dark" src="assets/logo-horizontal-negatif.svg" alt="" width="94" height="40">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Navigation principale">{links}<a href="app/">Espace famille</a><a class="btn btn-primary" href="inscription.html">Liste d'attente</a></nav>
  </div>
</header>'''

WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 0 16.4 8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3 4.4c-.2 0-.5 0-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5.3-.5v-.5l-.9-2.2c-.2-.5-.4-.4-.6-.4h-.5z"/></svg>'

def footer():
    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="logo-switch">
      <img class="logo-light" src="assets/logo-horizontal.svg" alt="Élan Académie" width="118" height="50" style="height:50px;width:auto">
      <img class="logo-dark" src="assets/logo-horizontal-negatif.svg" alt="" width="118" height="50" style="height:50px;width:auto">
      <p style="margin-top:12px;max-width:34ch">Académie en présentiel pour les 7-18 ans à Casablanca. Créer, s'exprimer, choisir.</p>
      <p class="small muted" style="margin-top:10px">Élan Académie, SARL en cours de création. Casablanca, Maroc.</p>
    </div>
    <div>
      <h4>L'académie</h4>
      <ul><li><a href="programme.html">Programme</a></li><li><a href="parcours.html">Les parcours</a></li><li><a href="metiers.html">Rencontres métiers</a></li><li><a href="stages.html">Stages intensifs</a></li><li><a href="a-propos.html">À propos</a></li></ul>
    </div>
    <div>
      <h4>Parents</h4>
      <ul><li><a href="inscription.html">Liste d'attente</a></li><li><a href="app/">Espace famille (connexion)</a></li><li><a href="faq.html">Questions fréquentes</a></li><li><a href="a-propos.html#securite">Sécurité des enfants</a></li><li><a href="mentions-legales.html">Mentions légales</a></li></ul>
    </div>
    <div>
      <h4>Contact</h4>
      <ul><li><a data-wa="" href="#">WhatsApp <span data-wa-number></span></a></li><li><span data-email></span></li><li><a data-instagram href="#" target="_blank" rel="noopener">Instagram</a></li><li><a data-linkedin href="#" target="_blank" rel="noopener">LinkedIn</a></li><li><a data-facebook href="#" target="_blank" rel="noopener">Facebook</a></li></ul>
    </div>
  </div>
  <div class="wrap footer-bottom"><span>© <span data-year></span> Élan Académie</span><span>Les notes ouvrent la porte. Ce que votre enfant apprend ici décide de ce qui se passe derrière.</span></div>
</footer>
<a class="wa-float" data-wa="Bonjour, j'ai une question sur Élan Académie." href="#">{WA_ICON} WhatsApp</a>
<script src="assets/site.js"></script>'''

def cta_band(title="Rejoignez la liste d'attente", text="Les familles de la liste d'attente sont prévenues en premier des dates des rencontres métiers, des ateliers d'essai et de l'ouverture des premiers groupes. Sans engagement.", primary=("inscription.html", "Rejoindre la liste d'attente"), secondary=("Bonjour, j'ai une question sur Élan Académie.", "Poser une question sur WhatsApp")):
    return f'''<section class="band cta-band section">
  <div class="wrap">
    <div><p class="eyebrow">Lancement</p><h2 style="margin-top:8px">{title}</h2><p class="lead" style="margin-top:12px">{text}</p></div>
    <div class="btn-row"><a class="btn btn-primary btn-lg" href="{primary[0]}">{primary[1]}</a><a class="btn btn-secondary btn-lg" data-wa="{secondary[0]}" href="#">{secondary[1]}</a></div>
  </div>
</section>'''

PAGES = {}

# ---------------------------------------------------------------- Accueil
PAGES["index.html"] = dict(title="Élan Académie", description="Académie en présentiel pour les 10-16 ans à Casablanca. Votre enfant choisit un projet, le fabrique, le présente devant les parents et rencontre des professionnels. Robotique, prise de parole, rencontres métiers.", body=f'''
<section class="band hero">
  <div class="wrap">
    <div class="hero-text">
      <p class="eyebrow">Académie pour les 10-16 ans · Casablanca</p>
      <h1>Les notes ouvrent la porte. Ce que votre enfant apprend ici décide de ce qui se passe derrière.</h1>
      <p class="lead">Ici, c'est votre enfant qui choisit son projet, le fabrique de ses mains, le présente devant un public et pose ses questions à des professionnels. En groupe de 8, le samedi ou le mercredi. Nous sommes là pour qu'il y arrive.</p>
      <div class="btn-row"><a class="btn btn-primary btn-lg" href="inscription.html">Inscrire mon enfant sur la liste d'attente</a><a class="btn btn-secondary btn-lg" href="programme.html">Ce qu'il va faire</a></div>
      <p class="small" style="color:var(--band-muted)">Les premiers ateliers d'essai et les premières rencontres métiers ont eu lieu. Les familles de la liste d'attente sont prévenues en premier des prochaines dates.</p>
    </div>
    <div class="hero-sym" aria-hidden="true">{symbol('width="360" height="360"', node="var(--band-node)", top="var(--band-accent)")}</div>
  </div>
</section>

<section class="facts-band">
  <div class="wrap facts">
    <div class="fact"><strong class="num">8</strong><span>enfants par groupe : chacun a la parole, chacun a les mains sur le projet</span></div>
    <div class="fact"><strong class="num">1</strong><span>projet par trimestre, que l'enfant choisit lui-même</span></div>
    <div class="fact"><strong class="num">4</strong><span>démos par an, où il présente son travail devant les parents</span></div>
    <div class="fact"><strong class="num">2 h</strong><span>par semaine, le samedi ou le mercredi</span></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Ce que votre enfant fait chez Élan</p><h2>Il crée, il s'exprime, il choisit</h2><p class="lead">À l'école, on lui demande de réussir des examens. Ici, on lui demande trois choses qu'on n'enseigne presque nulle part : fabriquer quelque chose de concret, le défendre devant un public, et choisir une direction en connaissance de cause.</p></div>
    <div class="grid grid-3">
      <article class="card pillar"><span class="pillar-num">01</span><h3>Il crée</h3><p>Il choisit un projet parmi trois, forme son binôme, construit, programme, teste, recommence. À la fin du trimestre, l'objet fonctionne, et c'est lui qui l'a fait.</p><ul><li>LEGO SPIKE, micro:bit, Arduino, impression 3D</li><li>Un animateur pour 8 enfants, qui aide sans faire à sa place</li><li>Chaque projet rejoint son portfolio en ligne</li></ul></article>
      <article class="card pillar"><span class="pillar-num">02</span><h3>Il s'exprime</h3><p>Il présente son projet devant les parents toutes les huit semaines : ce qu'il a fait, ce qui a marché, ce qu'il ferait autrement. Il apprend à tenir debout devant un public, et à aimer ça.</p><ul><li>Une démo par trimestre, seul, sans notes à partir de 13 ans</li><li>Des débats préparés, où il défend une position</li><li>Un intervenant expression pour la voix, le regard, la structure</li></ul></article>
      <article class="card pillar"><span class="pillar-num">03</span><h3>Il choisit</h3><p>Il rencontre un ingénieur, un médecin, un avocat, un entrepreneur, et c'est lui qui pose les questions. Avant de choisir un métier, il a parlé à des gens qui le font.</p><ul><li>Une rencontre métiers par mois, préparée avec l'animateur</li><li>Ses questions, posées par lui, à voix haute</li><li>À partir de 14 ans, un bilan d'orientation et un plan sur deux ans</li></ul></article>
    </div>
  </div>
</section>

<section class="section band-2" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Premiers retours</p><h2>Nous avons commencé, et les enfants en redemandent</h2><p class="lead">Avant d'ouvrir la liste d'attente, nous avons interrogé des parents, réuni un premier groupe en atelier d'essai et tenu une première rencontre métiers. Les retours des enfants et des parents nous ont décidés à continuer.</p></div>
    <div class="facts">
      <div class="fact"><strong class="num">50</strong><span>parents interrogés avant d'écrire le programme</span></div>
      <div class="fact"><strong class="num">8</strong><span>enfants au premier atelier d'essai, 8 projets présentés à la fin</span></div>
      <div class="fact"><strong class="num">1</strong><span>première rencontre métiers tenue en visio, questions posées par les enfants</span></div>
      <div class="fact"><strong class="num">10-16</strong><span>ans : l'âge des premiers inscrits sur la liste d'attente</span></div>
    </div>
    <p class="small muted" style="margin-top:14px">Chiffres mis à jour à chaque étape du lancement.</p>
  </div>
</section>

<section class="section" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Un trimestre dans la vie de votre enfant</p><h2>Huit semaines, un projet, une démo</h2><p class="lead">Le même rythme toute l'année, pour qu'il sache toujours où il va et ce qu'on attend de lui.</p></div>
    <div class="steps">
      <div class="step"><span class="when">Semaine 1</span><h3>Il choisit son projet</h3><p>Trois projets proposés, adaptés à son âge. Il en choisit un, forme son binôme et décide de ce qu'il veut montrer à la démo.</p></div>
      <div class="step"><span class="when">Semaines 2 à 7</span><h3>Il fabrique et il prépare</h3><p>Six séances de 2 h avec son groupe de 8 et un animateur. Il construit, programme, teste, recommence, et prépare sa présentation.</p></div>
      <div class="step"><span class="when">Semaine 8</span><h3>Il présente devant les parents</h3><p>Cinq à huit minutes, seul, devant un public qui pose des questions. C'est le moment dont il se souvient.</p></div>
      <div class="step"><span class="when">Chaque mois</span><h3>Vous savez où il en est</h3><p>Un retour écrit de l'animateur : ce qu'il a appris, où il progresse, où il bloque. Son projet rejoint son portfolio en ligne.</p></div>
    </div>
  </div>
</section>

<section class="section band-2" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Son groupe</p><h2>Un niveau par âge, jamais plus de 8</h2><p class="lead">Les projets, le vocabulaire et la durée des présentations changent avec l'âge. Chaque enfant travaille avec des enfants de son âge.</p></div>
    <div class="grid grid-4">
      <article class="card"><span class="pill">Année 2</span><h3>Explorateurs</h3><p class="muted">7-9 ans</p><p>Premiers mécanismes et premiers programmes par blocs. Présentations courtes, en binôme.</p></article>
      <article class="card"><span class="pill pill-green">Ouvert au lancement</span><h3>Bâtisseurs</h3><p class="muted">10-12 ans</p><p>LEGO SPIKE et micro:bit. Un objet qui fonctionne par trimestre, présenté seul devant les parents.</p></article>
      <article class="card"><span class="pill pill-green">Ouvert au lancement</span><h3>Argumentateurs</h3><p class="muted">13-15 ans</p><p>Arduino, impression 3D, code. Débats préparés, présentations argumentées, premières rencontres métiers.</p></article>
      <article class="card"><span class="pill">Année 2</span><h3>Décideurs</h3><p class="muted">16-18 ans</p><p>Projets longs, prise de parole exigeante, bilan d'orientation et plan sur deux ans.</p></article>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Ce qu'il garde</p><h2>À la fin de l'année, il a quelque chose à montrer</h2></div>
    <div class="grid grid-3">
      <article class="card"><h3>Son portfolio</h3><p>Chaque projet y entre avec des photos, la vidéo de sa démo et son carnet. Il le suit d'une année sur l'autre et pourra le montrer plus tard, à une école ou à un employeur.</p></article>
      <article class="card"><h3>Ses badges</h3><p>Un badge par compétence acquise : programmer un capteur, souder, présenter sans notes, poser une question à un professionnel. Pas de classement entre enfants.</p></article>
      <article class="card"><h3>Sa confiance</h3><p>Il a fabriqué un objet qui marche, il l'a présenté en public, il a parlé à des adultes de leur métier. La prochaine fois, il sait qu'il peut.</p></article>
    </div>
    <div class="btn-row" style="margin-top:24px"><a class="btn btn-secondary" href="parcours.html">Les parcours proposés</a></div>
  </div>
</section>

<section class="section band" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Rencontres métiers</p>
      <h2 style="margin-top:8px">Un professionnel, 45 minutes, et c'est votre enfant qui pose les questions</h2>
      <p class="lead" style="margin-top:14px">Un ingénieur, un médecin, un avocat, un architecte, un entrepreneur raconte une journée de son travail, ce qu'il a choisi et ce qu'il referait autrement. Les enfants ont préparé leurs questions avant ; ce sont eux qui les posent.</p>
      <div class="btn-row" style="margin-top:22px"><a class="btn btn-primary" href="metiers.html">Les prochaines rencontres</a><a class="btn btn-secondary" href="metiers.html#intervenir">Vous êtes professionnel ? Donnez une heure</a></div>
    </div>
    <div class="grid" style="gap:14px">
      <div class="card"><h3>Avant</h3><p>Il prépare deux questions avec l'animateur.</p></div>
      <div class="card"><h3>Pendant</h3><p>45 minutes de récit, puis 30 minutes où il pose ses questions lui-même. En visio au lancement, en présentiel ensuite.</p></div>
      <div class="card"><h3>Après</h3><p>Il note dans son portfolio ce qu'il retient du métier, et s'il se voit le faire.</p></div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(48px,7vw,88px)" id="securite">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Il est en sécurité</p><h2>Quatre règles qui ne se discutent pas</h2></div>
    <div class="grid grid-4">
      <article class="card"><h3>Assurance</h3><p>Responsabilité civile couvrant les mineurs, pour chaque séance, stage et sortie.</p></article>
      <article class="card"><h3>Animateurs vérifiés</h3><p>Casier judiciaire demandé à chaque animateur et intervenant avant la première séance.</p></article>
      <article class="card"><h3>Jamais seul</h3><p>Un adulte n'est jamais seul avec un enfant. Deux adultes présents, portes ouvertes.</p></article>
      <article class="card"><h3>Protocole d'accueil</h3><p>Signé par les parents : qui dépose, qui récupère, qui appeler, autorisation ou non pour les photos.</p></article>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Questions fréquentes</p><h2>Ce que les parents demandent d'abord</h2></div>
    <div class="faq">
      <details><summary>Mon enfant n'a jamais fait de robotique ni de programmation. Est-ce un problème ?</summary><p>Non. Les projets du premier trimestre partent de zéro. Ce qui compte, c'est la curiosité, pas le niveau de départ.</p></details>
      <details><summary>Mon enfant est timide. La prise de parole va-t-elle le bloquer ?</summary><p>C'est souvent pour lui que ça compte le plus. On commence en binôme, trois minutes, devant le groupe seulement. La présentation devant les parents vient quand il est prêt. Personne n'est mis en difficulté en public.</p></details>
      <details><summary>Quand ont lieu les séances ?</summary><p>Le samedi ou le mercredi, 2 heures par semaine, 32 séances sur l'année scolaire. Les horaires exacts sont confirmés avec les familles de la liste d'attente avant l'ouverture des groupes.</p></details>
      <details><summary>Où se passent les ateliers ?</summary><p>À Casablanca, dans une salle louée les jours d'atelier, du côté d'Anfa ou de Maârif. L'adresse est communiquée aux familles inscrites.</p></details>
    </div>
    <div class="btn-row" style="margin-top:22px"><a class="btn btn-secondary" href="faq.html">Toutes les questions</a></div>
  </div>
</section>

{cta_band()}
''')

# ---------------------------------------------------------------- Programme
PAGES["programme.html"] = dict(title="Programme", description="Le programme d'Élan Académie : trois piliers, un projet par trimestre, une démo toutes les huit semaines, quatre niveaux de 7 à 18 ans.", body=f'''
<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Programme</p><h1>Un projet par trimestre, une démo devant les parents, un portfolio qui reste</h1><p class="lead">Le programme tient en trois piliers et un rythme fixe. Rien d'abstrait : à la fin de chaque trimestre, votre enfant a fabriqué quelque chose, l'a présenté en public et l'a rangé dans son portfolio.</p></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="grid grid-3">
      <article class="card"><span class="pillar-num">01 · Créer</span><h3>Robotique, sciences, programmation</h3><p>Des kits qu'on trouve dans les meilleures écoles d'ingénieurs pour enfants : LEGO SPIKE pour les mécanismes et les capteurs, micro:bit pour les premiers programmes, Arduino pour l'électronique, une imprimante 3D pour les pièces qu'on dessine soi-même.</p><ul><li>Un projet par trimestre, choisi par l'enfant parmi trois</li><li>En binôme, avec un animateur pour 8 enfants</li><li>Le projet doit fonctionner le jour de la démo</li></ul></article>
      <article class="card"><span class="pillar-num">02 · S'exprimer</span><h3>Prise de parole, débat, argumentation</h3><p>Présenter son projet n'est pas une formalité : c'est la moitié du travail. Un intervenant expression (comédien, journaliste ou formateur) intervient chaque trimestre pour la voix, le regard, la structure d'un exposé, et pour les débats.</p><ul><li>Une démo de 5 à 8 minutes par enfant, devant les parents</li><li>Un débat préparé par trimestre à partir de 13 ans</li><li>Un retour individuel après chaque passage</li></ul></article>
      <article class="card"><span class="pillar-num">03 · Choisir</span><h3>Rencontres métiers et orientation</h3><p>Choisir une filière à 17 ans sans avoir jamais parlé à un ingénieur ou à un médecin, c'est choisir au hasard. Les rencontres métiers sont incluses dans le parcours ; le bilan d'orientation est proposé aux 14-18 ans.</p><ul><li>Une rencontre métiers par mois, ouverte aux inscrits</li><li>Les enfants préparent et posent leurs questions</li><li>Bilan d'orientation : 3 entretiens, tests, rapport, plan sur 2 ans</li></ul></article>
    </div>
  </div>
</section>

<section class="section band" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Une séance type</p><h2>Deux heures, toujours dans le même ordre</h2><p class="lead">Les enfants savent à quoi s'attendre, et les parents savent ce qui se passe pendant qu'ils attendent.</p></div>
    <div class="steps">
      <div class="step"><span class="when">15 minutes</span><h3>Lancement</h3><p>Où en est chaque binôme, ce qu'il doit obtenir aujourd'hui, un point technique montré par l'animateur.</p></div>
      <div class="step"><span class="when">75 minutes</span><h3>Projet</h3><p>Construction, programmation, tests. L'animateur passe de binôme en binôme ; il ne fait pas à la place de l'enfant.</p></div>
      <div class="step"><span class="when">20 minutes</span><h3>Présentation</h3><p>Deux binômes montrent leur avancée au groupe et répondent aux questions. Chacun passe au moins une fois par mois.</p></div>
      <div class="step"><span class="when">10 minutes</span><h3>Rangement et carnet</h3><p>Le matériel est rangé, l'enfant note trois lignes dans son carnet : fait, bloqué, prochaine fois.</p></div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Quatre niveaux</p><h2>Des projets qui grandissent avec l'enfant</h2><p class="lead">Exemples de projets proposés au choix. La liste change chaque trimestre ; les enfants d'un même groupe ne font pas tous le même.</p></div>
    <div class="grid grid-2">
      <article class="card"><div class="btn-row" style="gap:8px"><span class="pill">7-9 ans</span><span class="pill">Année 2</span></div><h3>Explorateurs</h3><ul><li>Un véhicule LEGO SPIKE qui s'arrête devant un obstacle</li><li>Un dé électronique avec micro:bit</li><li>Un porte-clés dessiné et imprimé en 3D</li></ul><p class="small muted">Présentations en binôme, 3 minutes.</p></article>
      <article class="card"><div class="btn-row" style="gap:8px"><span class="pill">10-12 ans</span><span class="pill pill-green">Ouvert au lancement</span></div><h3>Bâtisseurs</h3><ul><li>Un robot suiveur de ligne LEGO SPIKE</li><li>Une station météo micro:bit qui enregistre la température</li><li>Une lampe dont le socle est imprimé en 3D et le circuit soudé</li></ul><p class="small muted">Présentation seul, 5 minutes, questions des parents.</p></article>
      <article class="card"><div class="btn-row" style="gap:8px"><span class="pill">13-15 ans</span><span class="pill pill-green">Ouvert au lancement</span></div><h3>Argumentateurs</h3><ul><li>Un bras articulé Arduino commandé par un joystick</li><li>Une application simple qui parle à un capteur</li><li>Un débat préparé : « Faut-il interdire les téléphones au collège ? »</li></ul><p class="small muted">Présentation argumentée, 8 minutes, contradiction du groupe.</p></article>
      <article class="card"><div class="btn-row" style="gap:8px"><span class="pill">16-18 ans</span><span class="pill">Année 2</span></div><h3>Décideurs</h3><ul><li>Un projet long sur deux trimestres, avec un cahier des charges</li><li>Un exposé de 10 minutes devant un jury d'adultes</li><li>Le bilan d'orientation et un plan sur deux ans</li></ul><p class="small muted">Rencontres métiers choisies par l'élève selon son plan.</p></article>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Ce que les parents reçoivent</p><h2>Vous savez ce qui se passe, chaque mois</h2></div>
    <div class="grid grid-3">
      <article class="card"><h3>Le portfolio en ligne</h3><p>Chaque projet y entre avec des photos, une courte vidéo de la démo et le carnet de l'enfant. Il suit l'enfant d'une année sur l'autre.</p></article>
      <article class="card"><h3>Le retour mensuel écrit</h3><p>Un message de l'animateur, chaque mois : ce que votre enfant a appris, où il progresse, où il bloque, et ce que vous pouvez faire à la maison.</p></article>
      <article class="card"><h3>Les badges</h3><p>Un badge par compétence acquise (programmer un capteur, souder, présenter sans notes). Ils s'affichent dans le portfolio, pas de classement entre enfants.</p></article>
    </div>
  </div>
</section>

{cta_band()}
''')

# ---------------------------------------------------------------- Offres
PAGES["parcours.html"] = dict(title="Les parcours", description="Les parcours d'Élan Académie : le parcours annuel, les stages intensifs, le bilan d'orientation et les rencontres métiers. Tout est pensé pour l'enfant.", body=f'''
<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Les parcours</p><h1>Quatre façons d'entrer, un seul objectif : que votre enfant avance</h1><p class="lead">Le parcours annuel est le cœur de l'académie. Les stages, les rencontres métiers et le bilan d'orientation permettent de commencer plus doucement, ou d'aller plus loin. Dans tous les cas, c'est l'enfant qui fait, qui présente et qui choisit.</p></div>
    <div class="grid grid-2">
      <article class="card"><span class="pill pill-green">Le cœur de l'académie</span><h3>Le parcours annuel</h3><p>32 séances de 2 h sur l'année scolaire, le samedi ou le mercredi, en groupe de 8. Un projet par trimestre, une démo devant les parents toutes les huit semaines, les rencontres métiers, le portfolio et le retour mensuel.</p><ul class="checklist"><li>Quatre projets dans l'année, choisis par l'enfant</li><li>Quatre démos devant les parents</li><li>Une rencontre métiers par mois</li><li>Un portfolio en ligne et un retour écrit chaque mois</li><li>Un bilan de fin d'année avec vous</li></ul></article>
      <article class="card"><span class="pill">Vacances et été</span><h3>Le stage intensif</h3><p>Cinq jours, de 9 h à 15 h, sur un seul projet, du lundi au jeudi. Le vendredi, démo devant les parents. Une bonne façon de découvrir l'académie, ou de garder le rythme pendant les vacances.</p><ul class="checklist"><li>Groupe de 8, un animateur et un deuxième adulte</li><li>Un projet complet, rapporté à la maison quand c'est possible</li><li>Une présentation préparée avec l'intervenant expression</li></ul><a class="btn btn-secondary" href="stages.html" style="align-self:flex-start">Les stages en détail</a></article>
      <article class="card"><span class="pill">Ouvert à tous</span><h3>La rencontre métiers</h3><p>Un professionnel raconte une journée de son travail à un groupe de huit enfants, qui posent leurs questions. Incluse dans le parcours annuel, ouverte aux autres enfants à partir de 10 ans.</p><ul class="checklist"><li>45 minutes de récit, 30 minutes de questions</li><li>Les questions préparées par les enfants, posées par eux</li><li>En visio au lancement, en présentiel ensuite</li></ul><a class="btn btn-secondary" href="metiers.html" style="align-self:flex-start">Les prochaines rencontres</a></article>
      <article class="card"><span class="pill">14-18 ans</span><h3>Le bilan d'orientation</h3><p>Trois entretiens, des tests, un rapport écrit et un plan sur deux ans : quelles rencontres métiers prévoir, quelles filières regarder, quelles portes garder ouvertes. Avec le jeune d'abord, avec ses parents ensuite.</p><ul class="checklist"><li>Entretien 1 : le jeune seul, tests d'intérêts et de raisonnement</li><li>Entretien 2 : le jeune et ses parents, les filières possibles</li><li>Entretien 3 : le plan sur deux ans, un point à six mois inclus</li></ul></article>
    </div>
  </div>
</section>

<section class="section band-2" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap split">
    <div><p class="eyebrow">Ce que comprend le parcours annuel</p><h2 style="margin-top:8px">Tout ce dont votre enfant a besoin est fourni</h2><p class="lead" style="margin-top:12px">Il arrive avec sa curiosité ; le reste est là. Rien à acheter, rien à préparer à la maison.</p></div>
    <ul class="checklist" style="font-size:1.05rem"><li>Le matériel : kits LEGO SPIKE, micro:bit, Arduino, impression 3D</li><li>Un animateur pour 8 enfants, un deuxième adulte dans la salle</li><li>L'intervenant expression, un trimestre sur un</li><li>Les rencontres métiers, une par mois</li><li>Le portfolio en ligne, les badges et le retour mensuel écrit</li><li>Le bilan de fin d'année avec les parents</li><li>L'assurance responsabilité civile</li></ul>
  </div>
</section>

<section class="section" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Dans son école</p><h2>Le club Élan en école partenaire</h2><p class="lead">Une version allégée du parcours, 1 h 30 par semaine dans l'école de l'enfant, avec notre matériel et notre animateur. Les écoles privées intéressées peuvent nous écrire.</p></div>
    <div class="btn-row"><a class="btn btn-secondary" data-wa="Bonjour, je représente une école et je souhaite en savoir plus sur le club Élan Académie." href="#">Proposer un club dans mon école</a></div>
  </div>
</section>

{cta_band()}
''')

# ---------------------------------------------------------------- Rencontres métiers
PAGES["metiers.html"] = dict(title="Rencontres métiers", description="Les rencontres métiers d'Élan Académie : un professionnel raconte son métier à huit enfants, qui posent leurs questions. Bilan d'orientation pour les 14-18 ans.", body=f'''
<section class="section">
  <div class="wrap split">
    <div><p class="eyebrow">Rencontres métiers</p><h1 style="margin-top:8px">Avant de choisir un métier, parler à quelqu'un qui le fait</h1><p class="lead" style="margin-top:14px">Une fois par mois, un professionnel raconte une journée de son travail à un groupe de huit enfants : ce qu'il fait vraiment, ce qu'il a choisi, ce qu'il referait autrement. Les enfants ont préparé leurs questions ; ce sont eux qui les posent.</p><div class="btn-row" style="margin-top:22px"><a class="btn btn-primary" href="inscription.html">Être prévenu des prochaines dates</a><a class="btn btn-secondary" href="#intervenir">Proposer une rencontre</a></div></div>
    <div class="grid" style="gap:14px">
      <div class="card"><h3>45 minutes de récit</h3><p>Pas une conférence : une journée racontée, avec les objets, les écrans et les documents du métier.</p></div>
      <div class="card"><h3>30 minutes de questions</h3><p>Deux questions préparées par enfant, posées à voix haute. L'animateur veille à ce que chacun parle.</p></div>
      <div class="card"><h3>Une trace dans le portfolio</h3><p>Après la rencontre, l'enfant écrit ce qu'il retient du métier, et s'il se voit le faire ou non.</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Calendrier</p><h2>Les prochaines rencontres</h2><p class="lead">Les premières rencontres ont lieu en visio, pendant le lancement. Elles passent en présentiel à Casablanca avec l'ouverture des groupes. Les dates sont envoyées aux familles de la liste d'attente et publiées sur Instagram.</p></div>
    <div class="grid grid-3">
      <article class="card"><span class="pill">À venir · en visio</span><h3>Ingénieur</h3><p>Concevoir, calculer, faire fabriquer : une journée dans un bureau d'études, et pourquoi une erreur de calcul se voit des années plus tard.</p><p class="small muted">Date annoncée aux familles de la liste d'attente.</p></article>
      <article class="card"><span class="pill">À venir · en visio</span><h3>Médecin</h3><p>Ce qu'on apprend en dix ans d'études, ce qu'on apprend après, et comment on annonce une mauvaise nouvelle.</p><p class="small muted">Date annoncée aux familles de la liste d'attente.</p></article>
      <article class="card"><span class="pill">À venir · en visio</span><h3>Entrepreneur</h3><p>Monter une entreprise à Casablanca : la première vente, le premier salarié, la première fois où ça ne marche pas.</p><p class="small muted">Date annoncée aux familles de la liste d'attente.</p></article>
    </div>
    <p class="notice" style="margin-top:20px">Ouvert aux enfants inscrits au parcours et, à partir de 10 ans, à ceux qui ne le sont pas encore. Les enfants assistent sans leurs parents ; un compte rendu vous est envoyé.</p>
  </div>
</section>

<section class="section band" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap split">
    <div><p class="eyebrow">14-18 ans</p><h2 style="margin-top:8px">Le bilan d'orientation</h2><p class="lead" style="margin-top:12px">Trois entretiens, des tests, un rapport écrit et un plan sur deux ans qui dit quelles rencontres métiers prévoir, quelles filières regarder et quelles portes garder ouvertes. Le jeune d'abord, ses parents ensuite.</p></div>
    <div class="steps" style="grid-template-columns:1fr">
      <div class="step"><span class="when">Entretien 1</span><h3>Le jeune seul</h3><p>Ce qu'il aime faire, ce qu'il évite, ce qu'il croit savoir des métiers. Tests d'intérêts et de raisonnement.</p></div>
      <div class="step"><span class="when">Entretien 2</span><h3>Le jeune et ses parents</h3><p>Les résultats, les contraintes de la famille, les filières possibles au Maroc et à l'étranger.</p></div>
      <div class="step"><span class="when">Entretien 3</span><h3>Le plan sur deux ans</h3><p>Un rapport écrit, trois rencontres métiers à prévoir, un point à six mois inclus.</p></div>
    </div>
  </div>
</section>

<section class="section" id="intervenir" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap split" style="align-items:start">
    <div><p class="eyebrow">Vous êtes professionnel</p><h2 style="margin-top:8px">Donnez une heure, racontez votre métier</h2><p class="lead" style="margin-top:12px">Nous cherchons des ingénieurs, des médecins, des avocats, des architectes, des entrepreneurs, des pilotes, des chercheurs : des gens qui aiment ce qu'ils font et acceptent les questions directes de huit enfants. Une heure, en visio ou à Casablanca, sans préparation à fournir : nous préparons les enfants et nous vous envoyons leurs questions avant.</p></div>
    <form class="form card" id="form-intervenant" novalidate>
      <div class="field"><label for="int-nom">Votre nom</label><input id="int-nom" name="nom" type="text" autocomplete="name" required></div>
      <div class="field"><label for="int-metier">Votre métier</label><input id="int-metier" name="metier" type="text" placeholder="Ingénieure en génie civil, avocat d'affaires…" required></div>
      <div class="field"><label for="int-dispo">Vos disponibilités</label><input id="int-dispo" name="dispo" type="text" placeholder="Un samedi matin par trimestre, en visio…"><span class="hint">Facultatif.</span></div>
      <p id="int-status" class="notice" hidden></p>
      <div class="btn-row"><button class="btn btn-primary" type="submit">Préparer mon message</button><a class="btn btn-secondary" id="int-whatsapp" href="#" target="_blank" rel="noopener" hidden>Ouvrir WhatsApp</a></div>
    </form>
  </div>
</section>

{cta_band(title="Les dates arrivent par la liste d'attente", text="Inscrivez votre enfant sur la liste d'attente pour recevoir les dates des rencontres métiers en visio, puis des ateliers d'essai à Casablanca.")}
''')

# ---------------------------------------------------------------- Stages
PAGES["stages.html"] = dict(title="Stages intensifs", description="Stages intensifs d'Élan Académie pendant les vacances et l'été : 5 jours de 9 h à 15 h, un projet complet, démo devant les parents le vendredi.", body=f'''
<section class="section">
  <div class="wrap split">
    <div><p class="eyebrow">Stages intensifs</p><h1 style="margin-top:8px">Cinq jours, un projet complet, une démo le vendredi</h1><p class="lead" style="margin-top:14px">Pendant les vacances scolaires et l'été, un groupe de 8 enfants passe la semaine sur un seul projet, de 9 h à 15 h. Le vendredi à 14 h, les parents viennent voir ce qui a été fabriqué.</p><div class="btn-row" style="margin-top:22px"><a class="btn btn-primary" href="inscription.html">Être prévenu des prochaines dates</a><a class="btn btn-secondary" href="parcours.html">Les autres parcours</a></div></div>
    <div class="card"><p class="eyebrow">En pratique</p><ul class="checklist"><li>5 jours, du lundi au vendredi, de 9 h à 15 h</li><li>Groupe de 8, un animateur et un deuxième adulte</li><li>Matériel fourni, projet rapporté à la maison quand c'est possible</li><li>Déjeuner apporté par l'enfant, pause encadrée</li><li>Démo devant les parents le vendredi à 14 h</li></ul></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Une semaine type</p><h2>Du lundi matin à la démo du vendredi</h2></div>
    <div class="steps" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))">
      <div class="step"><span class="when">Lundi</span><h3>Choisir et dessiner</h3><p>Présentation du projet, formation des binômes, premiers croquis, liste du matériel.</p></div>
      <div class="step"><span class="when">Mardi</span><h3>Construire</h3><p>La structure, les mécanismes, les premières pièces imprimées en 3D lancées le matin.</p></div>
      <div class="step"><span class="when">Mercredi</span><h3>Programmer</h3><p>Capteurs, moteurs, premier programme qui tourne. Premiers tests, premières pannes.</p></div>
      <div class="step"><span class="when">Jeudi</span><h3>Finir et répéter</h3><p>Le projet doit fonctionner. L'après-midi : préparation de la présentation avec l'intervenant expression.</p></div>
      <div class="step"><span class="when">Vendredi</span><h3>La démo</h3><p>Le matin, dernières répétitions. À 14 h, démo devant les parents, 5 minutes par enfant, questions du public.</p></div>
    </div>
  </div>
</section>

<section class="section band-2" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Périodes</p><h2>Vacances scolaires et été</h2><p class="lead">Un stage par période de vacances du calendrier scolaire marocain, et quatre semaines en juillet et août. Les dates et le projet de chaque semaine sont publiés un mois avant, d'abord aux familles de la liste d'attente.</p></div>
    <div class="grid grid-3">
      <article class="card"><span class="pill">10-12 ans</span><h3>Exemple de projet</h3><p>Un robot LEGO SPIKE qui trie des objets par couleur et compte ce qu'il a trié.</p></article>
      <article class="card"><span class="pill">13-15 ans</span><h3>Exemple de projet</h3><p>Une station Arduino qui mesure la qualité de l'air de la salle et l'affiche sur un écran imprimé en 3D.</p></article>
      <article class="card"><span class="pill">Été</span><h3>Familles de passage et MRE</h3><p>Les stages d'été accueillent les enfants en vacances à Casablanca. L'inscription à une seule semaine est possible.</p></article>
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Pratique</p><h2>Ce qu'il faut savoir avant d'inscrire</h2></div>
    <div class="faq">
      <details><summary>À quelle heure déposer et récupérer mon enfant ?</summary><p>Accueil entre 8 h 45 et 9 h, sortie à 15 h. Un adulte désigné dans le protocole d'accueil signe à l'arrivée et au départ.</p></details>
      <details><summary>Faut-il apporter quelque chose ?</summary><p>Le déjeuner et une gourde. Tout le matériel technique est fourni. Un carnet est remis le lundi.</p></details>
      <details><summary>Mon enfant peut-il venir une seule semaine en été ?</summary><p>Oui. Chaque semaine est un projet complet et indépendant.</p></details>
      <details><summary>Et s'il n'y a pas assez d'inscrits ?</summary><p>Un stage ouvre à partir de 6 enfants. Si une semaine n'ouvre pas, vous êtes prévenu deux semaines avant et une autre semaine vous est proposée.</p></details>
    </div>
  </div>
</section>

{cta_band(title="Les dates des stages arrivent par la liste d'attente")}
''')

# ---------------------------------------------------------------- À propos
PAGES["a-propos.html"] = dict(title="À propos", description="Qui est derrière Élan Académie : un ingénieur généraliste à Casablanca, une méthode, une équipe d'animateurs étudiants ingénieurs, quatre règles de sécurité.", body=f'''
<section class="section">
  <div class="wrap split">
    <div><p class="eyebrow">À propos</p><h1 style="margin-top:8px">Pourquoi Élan Académie existe</h1><p class="lead" style="margin-top:14px">Nos enfants savent avoir des notes. Ils savent rarement fabriquer quelque chose de concret, le défendre devant un public, ou expliquer pourquoi ils veulent faire tel métier plutôt qu'un autre. Ces trois choses se travaillent, comme le reste. C'est ce que nous faisons, en groupes de 8, le samedi ou le mercredi.</p></div>
    <div class="card"><p class="eyebrow">Le fondateur</p><h3>Yassine, ingénieur généraliste</h3><p>Diplômé d'une école d'ingénieurs généraliste, il a monté Élan Académie après avoir constaté que ce qui l'avait le plus servi dans ses études et son métier (fabriquer, présenter, choisir) ne s'apprenait nulle part avant 20 ans. Il conçoit le programme, recrute les animateurs et anime lui-même les premiers groupes.</p><a class="btn btn-secondary" data-linkedin href="#" target="_blank" rel="noopener" style="align-self:flex-start">Suivre sur LinkedIn</a></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">La méthode</p><h2>Cinq principes qui ne changent pas</h2></div>
    <div class="grid grid-3">
      <article class="card"><h3>L'enfant choisit son projet</h3><p>Trois projets proposés, un choisi. Un enfant qui a choisi finit ce qu'il commence.</p></article>
      <article class="card"><h3>Le projet doit fonctionner</h3><p>Le jour de la démo, l'objet marche ou l'enfant explique pourquoi il ne marche pas encore. Les deux s'apprennent.</p></article>
      <article class="card"><h3>On présente en public</h3><p>Devant les parents, toutes les huit semaines, seul, sans notes à partir de 13 ans.</p></article>
      <article class="card"><h3>Groupes de 8, jamais plus</h3><p>Un animateur pour 8 enfants, un deuxième adulte dans la salle. Au-delà, on ouvre un autre groupe.</p></article>
      <article class="card"><h3>Les parents savent</h3><p>Un retour écrit chaque mois, un portfolio en ligne, un bilan de fin d'année. Pas de surprise en juin.</p></article>
      <article class="card"><h3>Pas de notes chez nous</h3><p>Des badges par compétence, pas de classement. L'école note déjà ; nous faisons autre chose.</p></article>
    </div>
  </div>
</section>

<section class="section band" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">L'équipe</p><h2>Qui est devant les enfants</h2></div>
    <div class="grid grid-3">
      <article class="card"><h3>Les animateurs</h3><p>Des étudiants ingénieurs en fin d'études, recrutés sur un atelier d'essai, formés à la méthode et suivis par le fondateur. Un animateur pour 8 enfants.</p></article>
      <article class="card"><h3>L'intervenant expression</h3><p>Un comédien, un journaliste ou un formateur à la prise de parole, un trimestre sur un, pour la voix, le regard, la structure et les débats.</p></article>
      <article class="card"><h3>Les intervenants métiers</h3><p>Des professionnels bénévoles qui donnent une heure par an : ingénieurs, médecins, avocats, architectes, entrepreneurs. <a href="metiers.html#intervenir">Vous pouvez en faire partie.</a></p></article>
    </div>
  </div>
</section>

<section class="section" id="securite" style="padding-top:clamp(48px,7vw,88px)">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Sécurité</p><h2>Quatre règles qui ne se discutent pas</h2><p class="lead">Elles sont écrites dans le protocole d'accueil que chaque famille signe avant la première séance.</p></div>
    <div class="grid grid-2">
      <article class="card"><h3>Assurance responsabilité civile</h3><p>Une assurance couvrant les mineurs pour chaque séance, chaque stage et chaque sortie. L'attestation est disponible sur demande.</p></article>
      <article class="card"><h3>Animateurs et intervenants vérifiés</h3><p>Casier judiciaire demandé avant la première séance, pour les animateurs comme pour les intervenants métiers qui viennent sur place.</p></article>
      <article class="card"><h3>Jamais un adulte seul avec un enfant</h3><p>Deux adultes présents à chaque séance, portes ouvertes, pas de messages privés entre un animateur et un enfant : tout passe par le groupe WhatsApp des parents.</p></article>
      <article class="card"><h3>Protocole d'accueil signé</h3><p>Qui dépose, qui récupère, qui appeler en cas de problème, allergies, autorisation ou non pour les photos. Sans autorisation écrite, aucune image de votre enfant n'est publiée.</p></article>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div><p class="eyebrow">Le lieu</p><h2 style="margin-top:8px">Casablanca, Anfa ou Maârif</h2><p class="lead" style="margin-top:12px">La première année, les ateliers ont lieu dans une salle louée le samedi et le mercredi, dans un centre culturel, un coworking ou une école du côté d'Anfa ou de Maârif. L'adresse exacte est communiquée aux familles inscrites. Un local permanent est prévu à partir de la deuxième année.</p></div>
    <dl class="kv card">
      <dt>Jours</dt><dd>Samedi et mercredi</dd>
      <dt>Durée</dt><dd>2 h par séance, 32 séances par an</dd>
      <dt>Groupes</dt><dd>8 enfants au maximum</dd>
      <dt>Lancement</dt><dd>Bâtisseurs (10-12 ans) et Argumentateurs (13-15 ans)</dd>
      <dt>Année 2</dt><dd>Explorateurs (7-9 ans) et Décideurs (16-18 ans), puis Rabat</dd>
    </dl>
  </div>
</section>

{cta_band()}
''')

# ---------------------------------------------------------------- Inscription
PAGES["inscription.html"] = dict(title="Liste d'attente", description="Inscrivez votre enfant sur la liste d'attente d'Élan Académie : réponse sous 24 h sur WhatsApp, dates des rencontres métiers et des ateliers d'essai en priorité.", body=f'''
<section class="section">
  <div class="wrap split" style="align-items:start">
    <div>
      <p class="eyebrow">Liste d'attente</p>
      <h1 style="margin-top:8px">Inscrivez votre enfant sur la liste d'attente</h1>
      <p class="lead" style="margin-top:14px">Sans engagement. Vous recevez une réponse personnelle sous 24 h sur WhatsApp, puis les dates des rencontres métiers en visio et des ateliers d'essai, avant tout le monde.</p>
      <div class="steps" style="grid-template-columns:1fr;margin-top:28px">
        <div class="step"><span class="when">Sous 24 h</span><h3>Une réponse personnelle</h3><p>Le fondateur vous répond lui-même sur WhatsApp, et répond à vos questions.</p></div>
        <div class="step"><span class="when">Ensuite</span><h3>Une rencontre métiers en visio</h3><p>Votre enfant assiste gratuitement à une première rencontre métiers, pour voir comment ça se passe.</p></div>
        <div class="step"><span class="when">Puis</span><h3>Un atelier d'essai à Casablanca</h3><p>2 h en groupe de 8, avec une courte présentation à la fin. Vous décidez après, pas avant.</p></div>
      </div>
      <p class="notice" style="margin-top:20px">Vous préférez écrire directement ? WhatsApp <strong data-wa-number></strong> ou <span data-email></span>.</p>
    </div>
    <div>
      <form class="form card" id="form-liste" novalidate>
        <div class="row">
          <div class="field"><label for="parent">Votre nom</label><input id="parent" name="parent" type="text" autocomplete="name" required></div>
          <div class="field"><label for="telephone">Votre numéro WhatsApp</label><input id="telephone" name="telephone" type="tel" inputmode="tel" autocomplete="tel" placeholder="06 12 34 56 78" required></div>
        </div>
        <div class="field"><label for="email">Votre e-mail</label><input id="email" name="email" type="email" autocomplete="email"><span class="hint">Facultatif. Utile pour recevoir le portfolio plus tard.</span></div>
        <div class="row">
          <div class="field"><label for="enfant">Prénom de votre enfant</label><input id="enfant" name="enfant" type="text" required></div>
          <div class="field"><label for="age">Son âge</label><input id="age" name="age" type="number" inputmode="numeric" min="7" max="18" required></div>
        </div>
        <div class="field"><label for="interet">Ce qui vous intéresse</label><select id="interet" name="interet"><option value="">Choisir</option><option>Le parcours annuel (samedi ou mercredi)</option><option>Un stage intensif pendant les vacances</option><option>Une rencontre métiers</option><option>Le bilan d'orientation (14-18 ans)</option><option>Je ne sais pas encore</option></select></div>
        <div class="row">
          <div class="field"><label for="quartier">Votre quartier</label><input id="quartier" name="quartier" type="text" placeholder="Anfa, Californie, Bouskoura…"><span class="hint">Facultatif. Pour choisir la salle.</span></div>
          <div class="field"><label for="source">Comment nous avez-vous connus ?</label><select id="source" name="source"><option value="">Choisir</option><option>Par un parent</option><option>Instagram ou Facebook</option><option>LinkedIn</option><option>L'école de mon enfant</option><option>Une rencontre métiers</option><option>Autre</option></select></div>
        </div>
        <div class="field"><label for="message">Une question, une précision</label><textarea id="message" name="message"></textarea><span class="hint">Facultatif.</span></div>
        <p class="error" id="form-erreur" aria-live="polite"></p>
        <div class="btn-row"><button class="btn btn-primary btn-lg" type="submit">Rejoindre la liste d'attente</button></div>
        <p class="small muted">Vos coordonnées servent uniquement à vous répondre et à vous envoyer les dates. Elles ne sont jamais transmises à des tiers ; vous pouvez demander leur suppression à tout moment.</p>
      </form>
      <div class="form-status" id="form-status" hidden>
        <p class="eyebrow">Liste d'attente</p>
        <h2 id="status-titre" style="font-size:1.5rem">Dernière étape : envoyez ce message sur WhatsApp</h2>
        <p id="status-texte" class="muted">Le bouton ouvre WhatsApp avec le message déjà rempli ; il ne reste qu'à l'envoyer.</p>
        <div class="btn-row"><a class="btn btn-primary btn-lg" id="ouvrir-whatsapp" href="#" target="_blank" rel="noopener">Ouvrir WhatsApp et envoyer</a><button class="btn btn-secondary" id="copier-message" type="button">Copier le message</button></div>
        <label for="message-apercu" class="small muted">Votre message</label>
        <textarea id="message-apercu" readonly></textarea>
        <p class="small muted">Numéro WhatsApp d'Élan Académie : <strong data-wa-number></strong></p>
      </div>
    </div>
  </div>
</section>
''')

# ---------------------------------------------------------------- FAQ
PAGES["faq.html"] = dict(title="Questions fréquentes", description="Les réponses aux questions des parents sur Élan Académie : âges, horaires, lieu, sécurité, matériel, démos, portfolio.", body=f'''
<section class="section">
  <div class="wrap">
    <div class="section-head"><p class="eyebrow">Questions fréquentes</p><h1>Ce que les parents nous demandent</h1><p class="lead">Si votre question n'est pas là, écrivez-nous sur WhatsApp : la réponse arrive dans la journée.</p></div>
    <div class="faq">
      <details open><summary>À partir de quel âge ?</summary><p>Au lancement, deux groupes : Bâtisseurs (10-12 ans) et Argumentateurs (13-15 ans). Les Explorateurs (7-9 ans) et les Décideurs (16-18 ans) ouvrent la deuxième année. Les stages d'été accueillent les 10-15 ans.</p></details>
      <details><summary>Mon enfant n'a jamais fait de robotique ni de programmation. Est-ce un problème ?</summary><p>Non. Les projets du premier trimestre partent de zéro, et les groupes mélangent les niveaux de départ. Ce qui compte, c'est la curiosité et l'envie de finir ce qu'on commence.</p></details>
      <details><summary>Quand ont lieu les séances ?</summary><p>Le samedi ou le mercredi, 2 heures par semaine, 32 séances sur l'année scolaire, hors vacances. Les horaires exacts sont confirmés avec les familles de la liste d'attente avant l'ouverture des groupes.</p></details>
      <details><summary>Où se passent les ateliers ?</summary><p>À Casablanca, dans une salle louée les jours d'atelier, du côté d'Anfa ou de Maârif. L'adresse est communiquée aux familles inscrites. Les premières rencontres métiers ont lieu en visio.</p></details>
      <details><summary>Qu'est-ce qu'une démo ?</summary><p>Toutes les huit semaines, chaque enfant présente son projet devant les parents du groupe : ce qu'il a fait, ce qui a marché, ce qu'il ferait autrement. 5 à 8 minutes, puis les questions du public. C'est le moment le plus important du trimestre.</p></details>
      <details><summary>Qu'est-ce que le portfolio ?</summary><p>Un espace en ligne propre à votre enfant, où chaque projet est rangé avec des photos, la vidéo de la démo, son carnet et ses badges. Il le suit d'une année sur l'autre et il peut le montrer plus tard, à une école ou à un employeur.</p></details>
      <details><summary>Qui sont les animateurs ?</summary><p>Des étudiants ingénieurs en fin d'études, recrutés sur un atelier d'essai, formés à la méthode et suivis par le fondateur, qui anime lui-même les premiers groupes. Casier judiciaire vérifié, jamais seuls avec un enfant.</p></details>
      <details><summary>Faut-il acheter du matériel ?</summary><p>Non. Les kits LEGO SPIKE, micro:bit, Arduino et l'imprimante 3D sont fournis. Les enfants repartent avec leur projet quand c'est possible, et toujours avec sa trace dans le portfolio.</p></details>
      <details><summary>Que se passe-t-il si mon enfant veut arrêter ?</summary><p>On ne force pas un enfant à continuer : on en parle avec lui et avec vous à la fin du trimestre en cours, et on cherche ensemble ce qui lui conviendrait mieux.</p></details>
      <details><summary>Mon enfant est timide. La prise de parole va-t-elle le bloquer ?</summary><p>C'est souvent pour lui que ça compte le plus. On commence en binôme, trois minutes, devant le groupe seulement. La présentation devant les parents vient après, quand il est prêt. Personne n'est mis en difficulté en public.</p></details>
      <details><summary>Les parents peuvent-ils assister aux séances ?</summary><p>Aux démos, oui, c'est fait pour ça. Aux séances ordinaires, non : les enfants travaillent mieux sans public. Vous recevez un retour écrit chaque mois.</p></details>
      <details><summary>Prenez-vous des photos des enfants ?</summary><p>Uniquement avec votre autorisation écrite, dans le protocole d'accueil. Sans elle, aucune image de votre enfant n'est publiée, et les démos sont filmées sur les projets, pas sur les visages.</p></details>
      <details><summary>Proposez-vous un club dans les écoles ?</summary><p>Oui, une version allégée du parcours, 1 h 30 par semaine dans l'école, avec notre matériel et notre animateur. Les écoles intéressées peuvent nous écrire.</p></details>
    </div>
  </div>
</section>

{cta_band()}
''')

# ---------------------------------------------------------------- Mentions légales
PAGES["mentions-legales.html"] = dict(title="Mentions légales", description="Mentions légales et données personnelles du site d'Élan Académie.", body=f'''
<section class="section">
  <div class="wrap prose">
    <p class="eyebrow">Mentions légales</p>
    <h1>Mentions légales et données personnelles</h1>
    <h2>Éditeur du site</h2>
    <p>Élan Académie, société à responsabilité limitée en cours de création, Casablanca, Maroc. Responsable de la publication : Yassine, fondateur. Contact : <span data-email></span>, WhatsApp <span data-wa-number></span>. Les mentions d'immatriculation (registre du commerce, identifiant fiscal, ICE) seront ajoutées dès la création de la société.</p>
    <h2>Hébergement</h2>
    <p>À compléter avec le nom et l'adresse de l'hébergeur au moment de la mise en ligne.</p>
    <h2>Données personnelles</h2>
    <p>Le formulaire de liste d'attente recueille votre nom, votre numéro WhatsApp, votre e-mail si vous le donnez, le prénom et l'âge de votre enfant et vos réponses facultatives. Ces informations servent uniquement à vous répondre et à vous envoyer les dates des rencontres métiers, des ateliers d'essai et des stages. Elles ne sont ni vendues ni transmises à des tiers.</p>
    <p>Conformément à la loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à <span data-email></span>. La déclaration du traitement auprès de la CNDP est effectuée avec la création de la société.</p>
    <h2>Photos et vidéos des enfants</h2>
    <p>Aucune image d'un enfant n'est publiée sans l'autorisation écrite de ses parents, recueillie dans le protocole d'accueil. Cette autorisation peut être retirée à tout moment.</p>
    <h2>Propriété intellectuelle</h2>
    <p>Le nom Élan Académie, le symbole aux trois nœuds et le contenu de ce site appartiennent à Élan Académie. Les marques LEGO SPIKE, micro:bit et Arduino appartiennent à leurs propriétaires respectifs et sont citées pour désigner le matériel utilisé.</p>
  </div>
</section>
''')

def page_html(name, p, full=True):
    title = p["title"] if name == "index.html" else p["title"] + " — Élan Académie"
    head_meta = f'''<title>{title}</title>
<meta name="description" content="{p["description"]}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{p["description"]}"><meta property="og:type" content="website"><meta property="og:locale" content="fr_MA">
<link rel="icon" href="{FAVICON}">
{FONTS}
<link rel="stylesheet" href="assets/site.css">
<script src="app/config.js"></script>'''
    body = header(name) + "\n<main>" + p["body"] + "</main>\n" + footer()
    if full:
        return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head_meta}
</head>
<body>
{body}
</body>
</html>
'''
    # version artefact : sans squelette (ajouté à la publication)
    return f'''{head_meta}
<meta name="claude:viewport-fit-sides" content="cover">
{body}
'''

def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    site = os.path.join(OUT, "site"); art = os.path.join(OUT, "artifact")
    for d in (os.path.join(site, "assets"), os.path.join(art, "assets")):
        os.makedirs(d, exist_ok=True)
    for name, p in PAGES.items():
        with open(os.path.join(site, name), "w", encoding="utf-8") as f:
            f.write(page_html(name, p, full=True))
        with open(os.path.join(art, name), "w", encoding="utf-8") as f:
            f.write(page_html(name, p, full=(name != "index.html")))
    for d in (site, art):
        for a in ("site.css", "site.js"):
            shutil.copy(os.path.join(SRC, "assets", a), os.path.join(d, "assets", a))
        for l in ("logo-horizontal.svg", "logo-horizontal-negatif.svg", "logo-symbole.svg", "logo-symbole-negatif.svg", "logo-vertical.svg"):
            shutil.copy(os.path.join(LOGOS, l), os.path.join(d, "assets", l))
    print("ok", sorted(os.listdir(site)))

if __name__ == "__main__":
    main()
