/* Calo Découpe — page « Cote ».
   Tôle : les morceaux dictés sont rangés dans un espace 3D, puis dessinés en 2D et mis à plat.
   PVC : une dictée remplit la liste du matériel à prendre et son récapitulatif par diamètre et épaisseur. */
(function (root) {
  'use strict';
  var K = root.CoteCalc, C = root.Calc;
  var $ = function (id) { return document.getElementById(id); };
  var CLE_TOLE = 'calo-morceaux-v1', CLE_PVC = 'calo-metre-v1', CLE_VUE = 'calo-cote-finition', CLE_IA = 'calo-ia-v1';
  var O;                                   /* outils fournis par app.js */
  var vue = 'tole', morceaux = [], entrees = [], IA = { actif: false, cle: '' };
  var scene = null, choisi = null, plat = null, brouillon = null, formes = [], pret = false;

  function echapper(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tubeDe(dn) { return C.TUBES.filter(function (t) { return t.dn === +dn; })[0]; }
  function copie(x) { return JSON.parse(JSON.stringify(x)); }
  function lire(cle) { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (err) { return null; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (err) { /* stockage indisponible */ } }
  function val(v) { return O.lg(v) + ' ' + O.un(); }
  function nombre(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }

  /* ---------- dictée vocale ---------- */
  var Reco = root.SpeechRecognition || root.webkitSpeechRecognition;
  /* champ : la zone de texte remplie ; surTexte à chaque nouveau mot ; surEtat quand l'écoute change */
  function ecouteur(champ, surTexte, surEtat) {
    var micro = null, actif = false, acquis = '';
    /* après une erreur, la fin de séance qui suit est ignorée : la saisie reste ouverte */
    var finir = function (message) { actif = false; micro = null; surEtat(false, message); };
    function seance() {
      var fini = '', m = new Reco();
      micro = m;
      m.lang = 'fr-FR'; m.interimResults = true; m.continuous = false;
      m.onresult = function (ev) {
        if (m !== micro) return;
        var provisoire = '';
        fini = '';
        for (var i = 0; i < ev.results.length; i++) { if (ev.results[i].isFinal) fini += ev.results[i][0].transcript + ' '; else provisoire += ev.results[i][0].transcript; }
        champ.value = (acquis + ' ' + fini + provisoire).replace(/\s+/g, ' ').trim();
        surTexte();
      };
      m.onerror = function (ev) {
        if (m !== micro || ev.error === 'no-speech' || ev.error === 'aborted') return;
        finir(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'Micro refusé : autorisez-le dans les réglages du navigateur, ou utilisez le micro du clavier.'
          : ev.error === 'network' ? 'La reconnaissance vocale a besoin du réseau. Utilisez le micro du clavier ou écrivez.' : 'La dictée s’est arrêtée. Réessayez, ou utilisez le micro du clavier.');
      };
      /* chaque pause termine une séance : on garde le texte et on relance tant qu'on n'a pas arrêté */
      m.onend = function () {
        if (m !== micro) return;
        if (fini.trim()) acquis = (acquis + ' ' + fini).trim() + ' ,';
        if (!actif) { micro = null; surEtat(false, '', true); return; }
        try { seance(); } catch (err) { finir('La dictée s’est arrêtée.'); }
      };
      m.start();
    }
    champ.addEventListener('input', function () { if (actif) { acquis = champ.value; var m = micro; micro = null; if (m) m.abort(); try { seance(); } catch (err) { finir(''); } } });
    return {
      actif: function () { return actif; },
      demarrer: function () {
        if (actif) return;
        if (!Reco) { champ.focus(); surEtat(false, 'La dictée directe n’est pas disponible ici : touchez la zone de texte et utilisez le micro du clavier.'); return; }
        acquis = champ.value.trim(); actif = true;
        try { seance(); surEtat(true, ''); } catch (err) { finir('La dictée ne démarre pas : utilisez le micro du clavier.'); }
      },
      /* arrêt demandé : les derniers mots arrivent encore */
      arreter: function () { if (!actif) return; actif = false; if (micro) micro.stop(); surEtat(false, ''); },
      couper: function () { if (!micro && !actif) return; actif = false; var m = micro; micro = null; if (m) m.abort(); surEtat(false, ''); },
      oublier: function () { acquis = ''; champ.value = ''; if (actif) { var m = micro; micro = null; if (m) m.abort(); try { seance(); } catch (err) { finir(''); } } }
    };
  }
  /* mots mal entendus que le correcteur a remis d'aplomb */
  function texteCorrige(l) {
    if (!l || !l.length) return '';
    return '<p class="corrige"><b>Mots corrigés</b>' + l.map(function (c) { return '<span><s>' + echapper(c[0]) + '</s> → ' + echapper({ metres: 'mètres', tole: 'tôle' }[c[1]] || c[1]) + '</span>'; }).join('') + '</p>';
  }
  function peindreMicro(b, actif, repos, enCours) {
    b.classList.toggle('actif', actif);
    b.setAttribute('aria-pressed', String(actif));
    b.querySelector('span').textContent = actif ? enCours : repos;
  }

  /* ================= TÔLE ================= */
  var micTole;
  function sauverTole() { ecrire(CLE_TOLE, morceaux); }
  function neuf() {
    var dernier = morceaux[morceaux.length - 1];
    var r = K.nouveau(O.base(), 'tole');
    if (dernier) { r.dn = dernier.dn; r.d = dernier.d; r.coq = dernier.coq; r.e = dernier.e; r.matiere = dernier.matiere; r.recouv = dernier.recouv; }
    return K.normaliser(r);
  }
  function titreMorceau(r, d) {
    if (r.pieces.length === 1) return K.TYPES[r.pieces[0].type] + (r.pieces[0].type === 'coude' ? ' ' + r.pieces[0].angle + '° ' + K.SENS[d.geo.segments[0].sens] : '');
    return 'Ensemble : ' + r.pieces.map(function (p) { return K.TYPES[p.type].replace(' / piquage', '').toLowerCase(); }).join(' + ');
  }
  function diam(r) { return O.lg(r.coq) + '-' + O.lg(r.e); }

  /* morceaux affichés : ceux enregistrés, avec le brouillon à sa place */
  function affiches() {
    var l = morceaux.map(function (r, i) { return { r: r, i: i }; });
    if (brouillon && brouillon.releve.pieces.length) {
      if (brouillon.i === null) l.push({ r: brouillon.releve, i: morceaux.length, brouillon: true });
      else l[brouillon.i] = { r: brouillon.releve, i: brouillon.i, brouillon: true };
    }
    l.forEach(function (x) { x.d = K.debit(x.r); x.titre = titreMorceau(x.r, x.d); });
    return l;
  }

  function elementScene(x) {
    var long = function (L, D) { return L <= 4 * D ? Math.max(L, 0.35 * D) : Math.min(9 * D, 4 * D + (L - 4 * D) * 0.2); };
    var geo = K.geometrie(x.r, long);
    return {
      geo: geo, tole: true, recouv: x.r.recouv, largeur: x.r.largeur, diametre: O.lg(geo.segments[0].s.D),
      nom: (x.i + 1) + ' · ' + diam(x.r),
      etiquettes: x.d.geo.segments.map(function (g) { return g.type === 'droit' ? O.lg(g.L) : g.type === 'coude' ? 'Coude ' + g.q.angle + '°' : K.TYPES[g.type].replace(' / piquage', '').replace(' à vanne', ''); }),
      secteurs: x.d.geo.segments.map(function (g) {
        if (g.type !== 'coude') return null;
        var c = g.calcul, dos = [], ventre = [];
        for (var j = 0; j < c.n + 2; j++) { var m = j > 0 && j <= c.n ? c.entiere : c.demi; dos.push('D ' + O.lg(Math.max(0, m.dos))); ventre.push('V ' + O.lg(Math.max(0, m.ventre))); }
        return { dos: dos, ventre: ventre };
      })
    };
  }
  function dessinerScene(liste) {
    var vus = brouillon ? liste.filter(function (x) { return x.brouillon; }) : liste;
    var index = brouillon ? (vus.length ? 0 : null) : choisi;
    scene.choisir(index);
    scene.definir({
      morceaux: vus.map(elementScene), habillage: 'Avec tôle',
      fiches: vus.map(function (x) { return { titre: (x.i + 1) + ' · ' + echapper(x.titre) + ' · ' + diam(x.r), unite: '', cotes: [] }; }),
      legendePVC: '', legendeLaine: ''
    });
    scene.el.classList.toggle('en-saisie', !!brouillon);
    scene.el.classList.toggle('sans-morceau', !vus.length);
    $('cmVide').textContent = brouillon ? 'Dictez le morceau : il apparaît ici.' : 'Aucun morceau pour l’instant.';
    $('cmSelection').hidden = !!brouillon || !!dessin || choisi === null;
    if (!$('cmSelection').hidden) $('cmChoisi').textContent = 'Morceau ' + (choisi + 1);
  }

  function dessiner2d(liste) {
    if (!liste.length) { $('cote2d').innerHTML = '<p class="note vide">Les vues cotées apparaissent avec le premier morceau.</p>'; return; }
    var groupes = {};
    liste.forEach(function (x) { var s = x.d.geo.segments[0].s, k = s.coq + '|' + s.e; (groupes[k] = groupes[k] || { coq: s.coq, e: s.e, D: s.D, l: [] }).l.push(x); });
    $('cote2d').innerHTML = Object.keys(groupes).map(function (k) { return groupes[k]; }).sort(function (a, b) { return a.coq - b.coq || a.e - b.e; }).map(function (g) {
      return '<div class="groupe-diam"><h3><b>' + O.lg(g.coq) + '-' + O.lg(g.e) + '</b><span>coquille ' + val(g.coq) + ' · épaisseur ' + val(g.e) + ' · Ø fini ' + val(g.D) + '</span></h3>' +
        g.l.map(function (x) {
          return '<div class="fiche2d' + (x.brouillon ? ' neuf' : '') + (choisi === x.i ? ' choisie' : '') + '"><button type="button" class="f2-tete" data-act="voir" data-i="' + x.i + '"><i>' + (x.i + 1) + '</i><span><b>' + echapper(x.titre) + '</b><small>' + (x.brouillon ? 'en cours de saisie' : 'toucher pour le voir en 3D') + '</small></span></button>' +
            x.d.geo.segments.map(function (s, j) {
              var infos = [x.d.geo.segments.length > 1 ? (j + 1) + '. ' + K.TYPES[s.type] : '', s.type === 'coude' ? s.q.sections + ' section' + (s.q.sections > 1 ? 's' : '') + ' + 2 demies' : '', s.type === 'coude' ? 'rayon ' + O.lg(s.R) : '', K.texteFermeture(s)].filter(Boolean).join(' · ');
              var al = x.d.alertes.filter(function (a) { return a.i === j; });
              return '<div class="draw">' + (infos ? '<p class="f2-infos">' + echapper(infos) + '</p>' : '') + root.Plans.vue2d(s, x.r, O.lg) + '</div>' +
                (al.length ? '<ul class="f2-alertes">' + al.map(function (a) { return '<li>' + echapper(a.texte) + '</li>'; }).join('') + '</ul>' : '');
            }).join('') + '</div>';
        }).join('') + '</div>';
    }).join('') + '<p class="note">Cotes finies en ' + O.un() + ', sans les recouvrements. D = dos, V = ventre. Trait de couleur : fermeture.</p>';
  }

  function dessinerPlat(liste) {
    formes = [];
    if (!liste.length) { $('cotePlat').innerHTML = '<p class="note vide">La tôle à plat apparaît avec le premier morceau.</p>'; return; }
    var i = brouillon && brouillon.releve.pieces.length ? (brouillon.i === null ? morceaux.length : brouillon.i) : (plat !== null && plat < liste.length ? plat : liste.length - 1);
    var x = liste.filter(function (y) { return y.i === i; })[0] || liste[0];
    var h = '<div class="seg choix-plat" role="group" aria-label="Morceau à découper">' + liste.map(function (y) {
      return '<button type="button" data-act="plat" data-i="' + y.i + '" aria-pressed="' + (y.i === x.i) + '">' + (y.i + 1) + ' · ' + diam(y.r) + '</button>';
    }).join('') + '</div><p class="plat-titre"><b>' + (x.i + 1) + ' · ' + echapper(x.titre) + '</b><span>Tôle ' + K.MATIERES[x.r.matiere].toLowerCase() + ' ' + nombre(x.r.epTole) + ' mm · recouvrement ' + val(x.r.recouv) + '</span></p>';
    x.d.geo.segments.forEach(function (s, j) {
      if (x.d.geo.segments.length > 1) h += '<h3 class="plat-piece">' + (j + 1) + '. ' + K.TYPES[s.type] + ' · ' + echapper(K.resumePiece(s, val)) + '</h3>';
      var l = root.Plans.aPlat(s, x.r, O.lg);
      if (!l.length) h += '<div class="warn">Le piquage est plus gros que le tube principal : aucune découpe possible.</div>';
      l.forEach(function (f) {
        var n = formes.push(f.forme) - 1;
        h += '<div class="decoupe"><div class="piece"><h4>' + f.titre + '</h4><span class="tag">× ' + f.qte + '</span></div><div class="draw">' + O.dessinPVC(f.forme, 'Tôle à plat : ' + f.titre) + '</div>' +
          (f.aide ? '<p class="note">' + f.aide + '</p>' : '') + '<div class="actions"><button type="button" class="btn" data-act="gabarit" data-n="' + n + '">Gabarit à taille réelle</button></div></div>';
      });
    });
    $('cotePlat').innerHTML = h + '<p class="note">Cotes en ' + O.un() + '. Moulures, bordages et chutes en plus. Faites un essai avant de débiter en série.</p>';
  }

  function dessinerTole() {
    if (choisi !== null && choisi >= morceaux.length) choisi = null;
    var liste = affiches();
    dessinerScene(liste); dessiner2d(liste); dessinerPlat(liste);
  }

  /* ---------- saisie d'un morceau ---------- */
  /* dessine : relevé venu du pad de dessin, à vérifier en 3D sans lancer la dictée */
  function ouvrirSaisie(i, dessine) {
    micTole.couper();
    var base = dessine ? K.normaliser(dessine) : i === null ? neuf() : K.normaliser(copie(morceaux[i]));
    brouillon = { i: i, base: base, releve: copie(base), doutes: [], ia: '', occupe: false, corrections: [] };
    choisi = null;
    $('cmTitre').textContent = dessine ? 'Nouveau morceau ' + (morceaux.length + 1) + ' (dessiné)' : i === null ? 'Nouveau morceau ' + (morceaux.length + 1) : 'Modifier le morceau ' + (i + 1);
    $('cmTexte').value = '';
    $('cmTexte').placeholder = i === null && !dessine ? 'Tuyau en 60-40, un coude en tête, fermeture de dos avec deux sections' : 'Trois sections, fermeture en ventre';
    $('cmInfo').textContent = dessine ? 'Vérifiez en 3D. Corrigez à la main ou à la voix, puis OK.' : '';
    $('cmPlus').open = !!dessine;
    $('cmPanneau').hidden = false; $('cmAjouter').hidden = true; $('cmMode').hidden = true;
    dessinerTole(); resumeSaisie();
    if (!dessine) micTole.demarrer();
    scene.el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function fermerSaisie() {
    micTole.couper();
    brouillon = null;
    $('cmPanneau').hidden = true; $('cmAjouter').hidden = false; $('cmMode').hidden = false;
    dessinerTole();
  }

  /* ---------- ajout par dessin ---------- */
  var CLE_MODE = 'calo-cote-mode', mode = 'dictee', dessin = null;
  var ECHELLE = 5;                         /* mm par pixel pour les longueurs proposées */
  function peindreMode() {
    document.querySelectorAll('#cmMode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
    $('cmIcone').innerHTML = mode === 'dessin' ? '<path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20zM13.8 6.8l3.4 3.4"/>' : '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/>';
  }
  function ouvrirDessin() {
    var r = neuf();
    dessin = { traits: [], courant: null, res: null, pieces: [], valeurs: [], coq: r.coq, e: r.e };
    choisi = null;
    $('cmDessin').hidden = false; $('cmAjouter').hidden = true; $('cmMode').hidden = true; $('cmSelection').hidden = true;
    tailleToile(); peindreDessin(); dessinerCotes();
    $('cmDessin').scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function fermerDessin() {
    dessin = null;
    $('cmDessin').hidden = true; $('cmAjouter').hidden = false; $('cmMode').hidden = false;
    dessinerTole();
  }
  function tailleToile() {
    var t = $('cdToile'), k = root.devicePixelRatio || 1;
    t.width = Math.round(t.clientWidth * k); t.height = Math.round(t.clientHeight * k);
  }
  /* les traits, reliés dans l'ordre : un trait qui repart du bout prolonge, sinon on recommence */
  function chemin() {
    var c = [];
    dessin.traits.forEach(function (t) {
      if (!c.length) { c = t.slice(); return; }
      var fin = c[c.length - 1], deb = c[0], d1 = Math.hypot(t[0][0] - fin[0], t[0][1] - fin[1]), d2 = Math.hypot(t[0][0] - deb[0], t[0][1] - deb[1]);
      if (d1 <= 40) c = c.concat(t);
      else if (d2 <= 40) c = t.slice().reverse().concat(c);
      else c = t.slice();
    });
    return c;
  }
  function estimer(px) { return Math.max(100, Math.round(px * ECHELLE / 50) * 50); }
  function reconnaitreDessin() {
    var c = chemin(), res = c.length > 1 ? root.Croquis.reconnaitre(c.map(function (q) { return [q[0], -q[1]]; })) : null;
    var anciens = dessin.pieces, vals = dessin.valeurs;
    dessin.res = res;
    dessin.pieces = res ? root.Croquis.pieces(res) : [];
    /* les cotes déjà tapées restent sur la pièce du même rang et du même type */
    dessin.valeurs = dessin.pieces.map(function (p, i) {
      var v = anciens[i] && anciens[i].type === p.type && vals[i] && vals[i].tape ? vals[i] : null;
      if (p.type === 'droit') return v || { longueur: estimer(res.batons[p.baton].L), tape: false };
      return v || { angle: p.angle, sections: 1, fermeture: '', tape: false };
    });
  }
  function peindreDessin() {
    var t = $('cdToile'), g = t.getContext('2d'), k = root.devicePixelRatio || 1;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, t.width, t.height);
    var net = !!dessin.res && !dessin.courant;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = net ? 3 : 4;
    g.strokeStyle = net ? 'rgba(120, 132, 150, .45)' : getComputedStyle(t).getPropertyValue('--accent').trim() || '#e8890c';
    dessin.traits.concat(dessin.courant ? [dessin.courant] : []).forEach(function (tr) {
      g.beginPath(); tr.forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke();
    });
    $('cdVide').hidden = dessin.traits.length > 0 || !!dessin.courant;
    peindrePropre();
  }
  /* le dessin remis au propre : bâtons, coudes arrondis et numéros des pièces */
  function peindrePropre() {
    var s = $('cdPropre'), res = dessin.res;
    if (!res || dessin.courant) { s.innerHTML = ''; return; }
    var tr = root.Croquis.trace(res, [s.clientWidth, s.clientHeight, 30]), h = '<path class="cd-tube" d="' + tr.d + '"/><path class="cd-axe" d="' + tr.d + '"/>';
    tr.coins.forEach(function (c, i) { if (i === 0 || i === tr.coins.length - 1) h += '<circle class="cd-bout" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="5"/>'; });
    dessin.pieces.forEach(function (p, n) {
      var pos = tr.poses.filter(function (x) { return p.type === 'droit' ? x.baton === p.baton : x.coude === p.coude; })[0];
      if (!pos) return;
      var v = dessin.valeurs[n], txt = p.type === 'droit' ? (v.tape ? '' : '≈ ') + O.lg(v.longueur) : v.angle + '°';
      var w = 22 + txt.length * 7.2, x = Math.max(4, Math.min(s.clientWidth - w - 4, pos.x - w / 2)), y = Math.max(4, Math.min(s.clientHeight - 26, pos.y - 13));
      h += '<g class="cd-etiq' + (p.type === 'droit' && !v.tape ? ' estime' : '') + '" data-n="' + n + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"><rect width="' + w.toFixed(1) + '" height="26" rx="13"/><circle cx="13" cy="13" r="10"/><text class="cd-num" x="13" y="17.5">' + (n + 1) + '</text><text x="27" y="17.5">' + txt + '</text></g>';
    });
    s.innerHTML = h;
  }
  function dessinerCotes() {
    var el = $('cdCotes');
    if (!dessin.res) { el.innerHTML = ''; $('cdOk').disabled = true; return; }
    $('cdOk').disabled = !dessin.pieces.length;
    var opts = function (l, v, suffixe) { return l.map(function (x) { return '<option value="' + x + '"' + (+x === +v ? ' selected' : '') + '>' + x + (suffixe || '') + '</option>'; }).join(''); };
    var coqs = K.COQ.indexOf(dessin.coq) >= 0 ? K.COQ : K.COQ.concat([dessin.coq]);
    var h = '<p class="cd-compris"><b>Compris</b> ' + (dessin.pieces.length ? dessin.pieces.map(function (p) { return p.type === 'droit' ? 'droit' : 'coude ' + p.angle + '°'; }).join(' · ') : 'rien : dessinez plus grand') + '</p>' +
      '<div class="fields cd-tuyau"><label class="field"><span>Coquille Ø intérieur</span><select data-cd="coq">' + opts(coqs, dessin.coq) + '</select></label>' +
      '<label class="field"><span>Épaisseur isolant</span><select data-cd="e">' + opts([13, 19, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120].concat([13, 19, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120].indexOf(dessin.e) >= 0 ? [] : [dessin.e]), dessin.e) + '</select></label></div>';
    h += '<ol class="cd-liste">' + dessin.pieces.map(function (p, n) {
      var v = dessin.valeurs[n], f;
      if (p.type === 'droit') f = '<label class="field"><span>Longueur (mm)' + (v.tape ? '' : ' · estimée') + '</span><input type="number" inputmode="numeric" min="1" data-cd="longueur" data-n="' + n + '" value="' + v.longueur + '"></label>';
      else f = '<label class="field"><span>Angle (°)</span><input type="number" inputmode="numeric" min="5" max="180" data-cd="angle" data-n="' + n + '" value="' + v.angle + '"></label>' +
        '<label class="field"><span>Sections entières</span><input type="number" inputmode="numeric" min="0" max="12" data-cd="sections" data-n="' + n + '" value="' + v.sections + '"></label>' +
        '<label class="field"><span>Fermeture</span><select data-cd="fermeture" data-n="' + n + '">' + Object.keys(K.FERMETURES).filter(function (k) { return k !== 'angle'; }).map(function (k) { return '<option value="' + k + '"' + (k === v.fermeture ? ' selected' : '') + '>' + maj(K.FERMETURES[k]) + '</option>'; }).join('') + '</select></label>';
      return '<li id="cdP' + n + '"><i>' + (n + 1) + '</i><div><b>' + (p.type === 'droit' ? 'Partie droite' : 'Coude ' + (p.sens ? K.SENS[p.sens] : '')) + '</b><div class="fields">' + f + '</div></div></li>';
    }).join('') + '</ol><p class="note">Longueurs estimées d’après le dessin (≈) : tapez les vraies cotes.</p>';
    el.innerHTML = h;
  }
  function versReleve() {
    var r = neuf(), res = dessin.res;
    K.poserCoquille(r, dessin.coq); r.e = dessin.e; r.finition = 'tole';
    r.depart = root.Croquis.departDe(res);
    r.pieces = dessin.pieces.map(function (p, n) {
      var v = dessin.valeurs[n];
      if (p.type === 'droit') return K.piece({ type: 'droit', longueur: v.longueur });
      return K.piece({ type: 'coude', angle: v.angle, sens: p.sens, sections: v.sections, fermeture: v.fermeture });
    });
    return r;
  }
  function brancherPad() {
    var t = $('cdToile');
    var point = function (ev) { var b = t.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
    t.addEventListener('pointerdown', function (ev) {
      if (!dessin || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      ev.preventDefault();
      try { t.setPointerCapture(ev.pointerId); } catch (err) { /* sans capture */ }
      dessin.courant = [point(ev)];
      peindreDessin();
    });
    t.addEventListener('pointermove', function (ev) {
      if (!dessin || !dessin.courant) return;
      var l = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      (l.length ? l : [ev]).forEach(function (e) { dessin.courant.push(point(e)); });
      peindreDessin();
    });
    var finir = function () {
      if (!dessin || !dessin.courant) return;
      var c = dessin.courant;
      dessin.courant = null;
      if (c.length > 1) { dessin.traits.push(c); reconnaitreDessin(); dessinerCotes(); }
      peindreDessin();
    };
    t.addEventListener('pointerup', finir);
    t.addEventListener('pointercancel', finir);
    $('cdPropre').addEventListener('click', function (ev) {
      var g = ev.target.closest('.cd-etiq'); if (!g) return;
      var champ = $('cdP' + g.dataset.n).querySelector('input');
      champ.scrollIntoView({ block: 'center' }); champ.focus(); champ.select();
    });
    $('cdCotes').addEventListener('input', function (ev) {
      var c = ev.target.dataset.cd; if (!c || !dessin) return;
      var v = ev.target.value;
      if (c === 'coq' || c === 'e') { dessin[c] = +v; return; }
      var x = dessin.valeurs[+ev.target.dataset.n];
      x[c] = c === 'fermeture' ? v : (+v || 0);
      x.tape = true;
      peindrePropre();
    });
    $('cdCotes').addEventListener('change', function (ev) {
      if (ev.target.dataset.cd === 'longueur') dessinerCotes();
    });
    root.addEventListener('resize', function () { if (dessin) { tailleToile(); peindreDessin(); } });
  }
  function dessinVers3D() {
    if (!dessin || !dessin.pieces.length) return;
    var bad = dessin.valeurs.filter(function (v, n) { return dessin.pieces[n].type === 'droit' ? !(v.longueur > 0) : !(v.angle >= 5 && v.angle <= 180); });
    if (bad.length) { O.avertir('Une cote est vide ou fausse : vérifiez les longueurs et les angles.'); return; }
    var r = versReleve();
    dessin = null; $('cmDessin').hidden = true;
    ouvrirSaisie(null, r);
  }
  function lireTexte() {
    if (!brouillon) return;
    var t = $('cmTexte').value.trim();
    if (!t) { brouillon.releve = copie(brouillon.base); brouillon.doutes = []; brouillon.corrections = []; }
    else {
      var res = K.interpreter(t, brouillon.base, O.un(), { corrige: brouillon.i !== null });
      brouillon.releve = res.releve; brouillon.releve.finition = 'tole'; brouillon.doutes = res.doutes; brouillon.corrections = res.corrections;
    }
    dessinerTole(); resumeSaisie();
  }
  function resumeSaisie() {
    var r = brouillon.releve, h = '';
    if (r.pieces.length) {
      var d = K.debit(r);
      h += '<ul class="faits"><li>Tuyau ' + diam(r) + ' (coquille ' + val(r.coq) + ', épaisseur ' + val(r.e) + ')</li>' + d.geo.segments.map(function (g) {
        return '<li>' + K.TYPES[g.type] + ' ' + echapper([K.resumePiece(g, val), K.texteFermeture(g)].filter(Boolean).join(' · ')) + '</li>';
      }).join('') + '</ul>';
    }
    h += texteCorrige(brouillon.corrections);
    if (brouillon.occupe) h += '<p class="note attente">L’agent IA réfléchit…</p>';
    if (brouillon.doutes.length) h += '<div class="warn"><b>À vérifier</b><ul>' + brouillon.doutes.map(function (x) { return '<li>' + echapper(x) + '</li>'; }).join('') + '</ul></div>';
    $('cmCompris').innerHTML = h;
    $('cmOk').disabled = !r.pieces.length || brouillon.occupe;
    $('cmMain').innerHTML = corriger(r);
  }
  /* l'agent IA relit la dictée une fois l'écoute terminée */
  function demanderIA() {
    var b = brouillon, t = $('cmTexte').value.trim();
    if (!b || !IA.actif || !IA.cle || !t || b.ia === t || b.occupe) return false;
    b.occupe = true; resumeSaisie();
    root.CoteIA.interpreter(t, b.base, IA.cle).then(function (res) {
      if (brouillon !== b) return;
      b.ia = t; b.releve = res.releve; b.releve.finition = 'tole'; b.doutes = res.doutes;
    }).catch(function (err) {
      if (brouillon !== b) return;
      b.ia = t; b.doutes = [(err && err.message || 'Agent IA indisponible.') + ' Lecture faite par l’interprète intégré.'].concat(b.doutes);
    }).then(function () { if (brouillon === b) { b.occupe = false; dessinerTole(); resumeSaisie(); } });
    return true;
  }
  function valider() {
    if (!brouillon) return;
    micTole.couper();
    if (demanderIA()) { O.avertir('L’agent IA relit la dictée : vérifiez, puis OK.'); return; }
    if (!brouillon.releve.pieces.length) { O.avertir('Dites au moins une pièce : coude, droit, té, réduction, fond ou boîte.'); return; }
    var r = K.normaliser(brouillon.releve);
    if (brouillon.i === null) { r.id = K.nouveau().id; morceaux.push(r); plat = morceaux.length - 1; }
    else { morceaux[brouillon.i] = r; plat = brouillon.i; }
    sauverTole(); fermerSaisie();
  }

  /* corrections au doigt, sans dicter */
  function options(liste, valeur) { return liste.map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(valeur) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); }
  function champ(nom, libelle, valeur, i, attrs) { return '<label class="field"><span>' + libelle + '</span><input data-champ="' + nom + '"' + (i === null ? '' : ' data-p="' + i + '"') + ' type="number" inputmode="decimal" min="0" value="' + (valeur || valeur === 0 ? valeur : '') + '" ' + (attrs || '') + '></label>'; }
  function liste_(nom, libelle, opts, valeur, i) { return '<label class="field"><span>' + libelle + '</span><select data-champ="' + nom + '"' + (i === null ? '' : ' data-p="' + i + '"') + '>' + options(opts, valeur) + '</select></label>'; }
  function maj(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function tubes(zero) { return [[0, zero]].concat(C.TUBES.map(function (t) { return [t.dn, 'DN ' + t.dn + ' · ' + t.coq]; })); }
  function corriger(r) {
    var h = '<div class="fields">' + champ('coq', 'Ø intérieur coquille', r.coq, null) + champ('e', 'Épaisseur isolant', r.e, null) +
      liste_('matiere', 'Matière de la tôle', Object.keys(K.MATIERES).map(function (k) { return [k, K.MATIERES[k]]; }), r.matiere, null) +
      liste_('epTole', 'Épaisseur de la tôle', [[0.6, '0,6 mm'], [0.8, '0,8 mm'], [1, '1 mm']], r.epTole, null) +
      champ('recouv', 'Recouvrement', r.recouv, null) + champ('largeur', 'Largeur de feuille', r.largeur, null) + '</div>';
    var sens = [['', 'Non précisé']].concat(['haut', 'bas', 'gauche', 'droite', 'avant', 'arriere', 'plat'].map(function (k) { return [k, maj(K.SENS[k])]; }));
    r.pieces.forEach(function (q, i) {
      var f = '';
      if (q.type === 'droit') f = champ('longueur', 'Longueur', q.longueur, i) + liste_('mode', 'Cote prise', [['nette', 'Longueur nette'], ['axe', 'D’axe à axe']], q.mode, i);
      else if (q.type === 'coude') f = liste_('sens', 'Sens', sens, q.sens, i) + champ('angle', 'Angle (°)', q.angle, i) + champ('sections', 'Sections entières', q.sections, i, 'step="1" max="12"') + champ('rayon', 'Rayon à l’axe', q.rayon || '', i, 'placeholder="auto"');
      else if (q.type === 'te') f = champ('longueur', 'Longueur du té', q.longueur, i) + champ('position', 'Axe du piquage depuis le début', q.position || '', i, 'placeholder="milieu"') + liste_('sens', 'Piquage vers', sens.slice(0, -1), q.sens, i) + champ('angle', 'Angle (°)', q.angle, i) + liste_('dnB', 'Tube du piquage', tubes('Comme le principal'), q.dnB, i) + champ('eB', 'Isolant du piquage', q.eB || '', i, 'placeholder="auto"') + champ('longueurB', 'Longueur depuis l’axe', q.longueurB, i);
      else if (q.type === 'reduction') f = liste_('dnS', 'Tube de sortie', tubes('Diamètre en dessous'), q.dnS, i) + champ('longueur', 'Longueur', q.longueur, i) + liste_('forme', 'Forme', [['concentrique', 'Concentrique'], ['excentree', 'Excentrée']], q.forme, i) + liste_('plat', 'Côté plat', [['dessous', 'Dessous'], ['dessus', 'Dessus']], q.plat, i);
      else if (q.type === 'fond') f = liste_('forme', 'Forme', [['plat', 'Plat'], ['bombe', 'Bombé']], q.forme, i);
      else f = champ('longueur', 'Longueur', q.longueur || '', i, 'placeholder="auto"') + champ('largeur', 'Largeur', q.largeur || '', i, 'placeholder="auto"') + champ('hauteur', 'Hauteur', q.hauteur || '', i, 'placeholder="auto"');
      if (q.fermeture !== undefined) {
        f += liste_('fermeture', 'Fermeture', Object.keys(K.FERMETURES).map(function (k) { return [k, maj(K.FERMETURES[k])]; }), q.fermeture, i) +
          (q.fermeture === 'angle' ? champ('fermAngle', 'Angle de fermeture (°)', q.fermAngle, i, 'max="359"') : '') +
          liste_('faces', 'En', [[1, '1 face'], [2, '2 faces']], q.faces, i);
      }
      h += '<div class="corr"><div class="piece"><h4>' + (i + 1) + '. ' + K.TYPES[q.type] + '</h4>' + (r.pieces.length > 1 ? '<button type="button" class="link" data-act="oter" data-p="' + i + '">Retirer</button>' : '') + '</div><div class="fields">' + f + '</div></div>';
    });
    return h;
  }
  /* après une correction au doigt, le texte déjà dicté est considéré comme pris en compte */
  function figerSaisie(r) {
    brouillon.base = K.normaliser(r); brouillon.releve = copie(brouillon.base); brouillon.doutes = []; brouillon.ia = '';
    micTole.oublier();
    dessinerTole(); resumeSaisie();
  }

  /* ================= PVC ================= */
  var micPvc, depart = null;
  var NOMS = [['coudePVC', 'coude', 'PVC'], ['coudeLaine', 'coude', 'laine'], ['pvc', 'm', 'PVC'], ['laine', 'm', 'laine'], ['coquillesPVC', 'coquille', 'PVC'], ['coquilles', 'coquille', 'laine']];
  function quantite(k, n) {
    if (k[1] === 'm') return nombre(n) + ' m de ' + k[2];
    return nombre(n) + ' ' + k[1] + (n > 1 ? 's' : '') + (k[1] === 'coude' ? ' ' : ' de ') + k[2];
  }
  function nomDiam(x) { return x.coq ? x.coq + (x.e ? '-' + x.e : '') : 'Ø ?'; }
  function detailDiam(x) { return (x.coq ? 'coquille ' + x.coq : 'diamètre non dit') + (x.e ? ' · épaisseur ' + x.e : ' · épaisseur non dite'); }
  function anglesTexte(a) { var l = Object.keys(a || {}); return l.length ? l.map(function (k) { return a[k] + ' à ' + k + '°'; }).join(', ') : ''; }
  /* fiches au format d'une page imprimée : papier blanc, tableau, lisible d'un coup d'œil */
  function aujourdhui() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function entete(titre, sous, droite) {
    return '<header class="f-tete"><div class="f-titre"><b>' + titre + '</b><span>' + sous + '</span></div><div class="f-date"><b>' + aujourdhui() + '</b><span>' + droite + '</span></div></header>';
  }
  function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }
  function ficheListe() {
    var lignes = entrees.map(function (x, i) {
      var quoi = NOMS.filter(function (k) { return x.q[k[0]]; }).map(function (k) {
        return '<li class="m-' + (k[2] === 'PVC' ? 'pvc' : 'laine') + '"><b>' + (k[1] === 'm' ? nombre(x.q[k[0]]) + ' m' : nombre(x.q[k[0]])) + '</b> ' + (k[1] === 'm' ? 'de ' + k[2] : k[1] + (x.q[k[0]] > 1 ? 's' : '') + ' ' + k[2]) + '</li>';
      }).join('');
      var a = anglesTexte(x.angles);
      return '<tr><td class="f-n">' + (i + 1) + '</td><td class="f-d"><b>' + nomDiam(x) + '</b>' + (x.coq && x.e ? '' : '<small>' + detailDiam(x) + '</small>') + '</td>' +
        '<td><ul class="f-quoi">' + (quoi || '<li class="f-rien">rien de compté</li>') + '</ul>' + (a ? '<small class="f-angles">coudes ' + a + '</small>' : '') + '</td>' +
        '<td class="f-x"><button type="button" data-act="retirer" data-n="' + i + '" aria-label="Retirer la ligne ' + (i + 1) + '">✕</button></td></tr>';
    }).join('');
    return '<article class="feuille">' + entete('Prise de cotes', 'PVC et laine · ce qui a été dit', pluriel(entrees.length, 'ligne')) +
      '<table class="f-table f-liste"><thead><tr><th>N°</th><th>Tuyau</th><th>À prendre</th><th><span class="lecteur">Retirer</span></th></tr></thead><tbody>' + lignes + '</tbody></table>' +
      '<p class="f-pied"><span class="m-pvc">PVC</span><span class="m-laine">Laine</span>« 60-40 » = coquille Ø 60, épaisseur 40</p></article>';
  }
  function ficheRecap() {
    var groupes = K.recapitulatif(entrees), total = {};
    groupes.forEach(function (g) { QUOI_.forEach(function (k) { if (g.q[k]) total[k] = Math.round(((total[k] || 0) + g.q[k]) * 1000) / 1000; }); });
    var cell = function (v, m) { return v ? '<b>' + nombre(v) + '</b>' + (m ? '<small> m</small>' : '') : '<span class="f-vide">–</span>'; };
    var ligne = function (nom, q, cl) {
      return '<tr' + (cl ? ' class="' + cl + '"' : '') + '><th scope="row">' + nom + '</th><td class="m-pvc">' + cell(q.pvc, true) + '</td><td class="m-laine">' + cell(q.laine, true) + '</td><td class="m-pvc">' + cell(q.coudePVC) + '</td><td class="m-laine">' + cell(q.coudeLaine) + '</td></tr>';
    };
    var notes = [];
    groupes.forEach(function (g) {
      var a = anglesTexte(g.angles), c = [];
      if (g.q.coquillesPVC) c.push(pluriel(nombre(g.q.coquillesPVC), 'coquille') + ' PVC');
      if (g.q.coquilles) c.push(pluriel(nombre(g.q.coquilles), 'coquille') + ' laine');
      if (a) c.push('coudes ' + a);
      if (c.length) notes.push('<li><b>' + nomDiam(g) + '</b> : ' + c.join(' · ') + '</li>');
    });
    return '<article class="feuille">' + entete('Récapitulatif', 'Rangé par diamètre et épaisseur', pluriel(groupes.length, 'diamètre')) +
      '<table class="f-table f-recap"><thead><tr><th>Tuyau</th><th class="m-pvc">PVC</th><th class="m-laine">Laine</th><th class="m-pvc">Coudes PVC</th><th class="m-laine">Coudes laine</th></tr></thead><tbody>' +
      groupes.map(function (g) { return ligne(nomDiam(g), g.q); }).join('') + '</tbody>' +
      (groupes.length > 1 ? '<tfoot>' + ligne('Total', total, 'f-total') + '</tfoot>' : '') + '</table>' +
      (notes.length ? '<ul class="f-notes">' + notes.join('') + '</ul>' : '') + '</article>';
  }
  var QUOI_ = ['pvc', 'laine', 'coudePVC', 'coudeLaine', 'coquillesPVC', 'coquilles'];
  function dessinerPvc() {
    if (!entrees.length) {
      $('pvcListe').innerHTML = '<p class="note vide">Rien pour l’instant. Dites par exemple : « en 60-40, 4 coudes et 12 mètres ».</p>';
      $('pvcRecap').innerHTML = '<p class="note vide">Le récapitulatif se remplit tout seul.</p>';
      return;
    }
    $('pvcListe').innerHTML = ficheListe() + '<div class="actions deux"><button type="button" class="btn primary" data-act="pdf">Faire un PDF</button><button type="button" class="btn" data-act="toutvider">Vider la liste</button></div>';
    $('pvcRecap').innerHTML = ficheRecap() + '<div class="actions"><button type="button" class="btn primary" data-act="pdf">Faire un PDF</button></div>';
  }
  /* impression : les deux fiches, sans les boutons ; « Enregistrer en PDF » dans la fenêtre d'impression du téléphone */
  function imprimerPvc() {
    var p = $('print');
    p.innerHTML = '<div class="feuilles">' + ficheListe() + ficheRecap() + '</div>';
    p.querySelectorAll('.f-x').forEach(function (c) { c.remove(); });
    p.querySelectorAll('.f-liste th:last-child').forEach(function (c) { c.remove(); });
    document.body.classList.add('gabarit');
    window.print();
  }
  function lirePvc() {
    var t = $('pvcTexte').value.trim();
    if (depart === null) depart = copie(entrees);
    var res = t ? K.metre(t, depart) : { entrees: copie(depart), doutes: [] };
    entrees = res.entrees; ecrire(CLE_PVC, entrees);
    $('pvcDoutes').innerHTML = texteCorrige(res.corrections) + (res.doutes.length ? '<div class="warn"><ul>' + res.doutes.map(function (x) { return '<li>' + echapper(x) + '</li>'; }).join('') + '</ul></div>' : '');
    dessinerPvc();
  }
  /* la liste telle qu'elle est devient le point de départ de la suite de la dictée */
  function figerPvc() { depart = copie(entrees); micPvc.oublier(); $('pvcDoutes').innerHTML = ''; ecrire(CLE_PVC, entrees); dessinerPvc(); }
  /* la prise de cotes reste ouverte tant que la zone de saisie est affichée, même sans micro */
  function basculerPvc() {
    if (!$('pvcSaisie').hidden) { if (micPvc.actif()) micPvc.arreter(); else terminerPvc(); return; }
    depart = copie(entrees);
    $('pvcTexte').value = ''; $('pvcDoutes').innerHTML = ''; $('pvcRestes').innerHTML = ''; $('pvcInfo').textContent = ''; $('pvcSaisie').hidden = false;
    peindreMicro($('pvcMicro'), false, 'Terminer la prise de cotes', '');
    micPvc.demarrer();
  }
  function terminerPvc() {
    if ($('pvcTexte').value.trim()) lirePvc();
    var reste = $('pvcDoutes').innerHTML;
    depart = null; $('pvcTexte').value = ''; $('pvcInfo').textContent = '';
    $('pvcSaisie').hidden = true;
    $('pvcRestes').innerHTML = reste;
    peindreMicro($('pvcMicro'), false, 'Commencer la prise de cotes', '');
  }

  /* ================= page ================= */
  function montrer() {
    document.querySelectorAll('#coteFinition button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.finition === vue)); });
    $('coteTole').hidden = vue !== 'tole'; $('cotePvc').hidden = vue !== 'pvc';
  }
  function couperMicros() { if (micTole) micTole.couper(); if (micPvc) micPvc.couper(); }

  function init() {
    pret = true;
    O = root.Outils;
    morceaux = (lire(CLE_TOLE) || []).map(K.normaliser).filter(function (r) { return r.pieces.length; });
    entrees = (lire(CLE_PVC) || []).filter(function (x) { return x && x.q; });
    vue = lire(CLE_VUE) === 'pvc' ? 'pvc' : 'tole';
    scene = root.Scene3D.creer('ensemble', 'Mes morceaux en 3D', true, {
      libre: true, selection: true, bouton: 'Recentrer', depart: null, mot: 'Morceau', court: true,
      invite: 'Touchez un morceau, ou son numéro, pour le voir seul avec ses cotes.',
      surChoix: function (i) { if (brouillon || dessin) return; choisi = i; if (i !== null) plat = i; dessinerTole(); }
    });
    $('cote-scene').appendChild(scene.el);
    scene.el.querySelector('.scene-vue').insertAdjacentHTML('beforeend', '<p class="vide-3d" id="cmVide"></p>');
    scene.el.appendChild($('cmZone'));

    micTole = ecouteur($('cmTexte'), lireTexte, function (actif, message, fini) {
      peindreMicro($('cmMicro'), actif, 'Reprendre la dictée', 'J’écoute… toucher pour arrêter');
      if (message !== undefined) $('cmInfo').textContent = message;
      if (fini) demanderIA();
    });
    micPvc = ecouteur($('pvcTexte'), lirePvc, function (actif, message, fini) {
      if (message !== undefined) $('pvcInfo').textContent = message;
      if (actif) peindreMicro($('pvcMicro'), true, '', 'J’écoute… toucher pour terminer');
      else if (fini) terminerPvc();
      else if (!$('pvcSaisie').hidden) peindreMicro($('pvcMicro'), false, 'Terminer la prise de cotes', '');
    });
    $('cmTexte').addEventListener('input', lireTexte);
    mode = lire(CLE_MODE) === 'dessin' ? 'dessin' : 'dictee';
    peindreMode(); brancherPad();
    $('cmMode').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; mode = b.dataset.mode; ecrire(CLE_MODE, mode); peindreMode(); });
    $('pvcTexte').addEventListener('input', lirePvc);

    $('coteFinition').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      couperMicros();
      if (brouillon) fermerSaisie();
      if (dessin) fermerDessin();
      if (!$('pvcSaisie').hidden) terminerPvc();
      vue = b.dataset.finition; ecrire(CLE_VUE, vue); montrer();
      if (vue === 'tole') dessinerTole();
    });
    $('p-cote').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act, i = +b.dataset.i;
      if (act === 'ajouter') { if (mode === 'dessin') ouvrirDessin(); else ouvrirSaisie(null); }
      else if (act === 'dessin-retour') { if (dessin) { dessin.traits.pop(); reconnaitreDessin(); dessinerCotes(); peindreDessin(); } }
      else if (act === 'dessin-effacer') { if (dessin && dessin.traits.length && window.confirm('Effacer tout le dessin ?')) { dessin.traits = []; reconnaitreDessin(); dessinerCotes(); peindreDessin(); } }
      else if (act === 'dessin-3d') dessinVers3D();
      else if (act === 'dessin-fermer') fermerDessin();
      else if (act === 'micro') { if (micTole.actif()) micTole.arreter(); else micTole.demarrer(); }
      else if (act === 'ok') valider();
      else if (act === 'abandon') fermerSaisie();
      else if (act === 'modifier') { if (choisi !== null) ouvrirSaisie(choisi); }
      else if (act === 'jeter') {
        if (choisi === null || !window.confirm('Supprimer définitivement le morceau ' + (choisi + 1) + ' ?')) return;
        morceaux.splice(choisi, 1); choisi = null; plat = null; sauverTole(); dessinerTole();
      } else if (act === 'voir') {
        if (brouillon || dessin) return;
        choisi = i; plat = i; dessinerTole(); scene.el.scrollIntoView({ block: 'start' });
      } else if (act === 'plat') { if (brouillon) return; plat = i; if (choisi !== null) choisi = i; dessinerTole(); }
      else if (act === 'gabarit') O.gabarit('cote', formes[+b.dataset.n]);
      else if (act === 'oter') { var r = copie(brouillon.releve); r.pieces.splice(+b.dataset.p, 1); figerSaisie(r); }
      else if (act === 'pvc') basculerPvc();
      else if (act === 'retirer') { entrees.splice(+b.dataset.n, 1); figerPvc(); }
      else if (act === 'pdf') imprimerPvc();
      else if (act === 'toutvider') { if (window.confirm('Vider toute la liste de la prise de cotes ?')) { entrees = []; figerPvc(); } }
    });
    $('cmMain').addEventListener('change', function (ev) {
      var c = ev.target.dataset.champ; if (!c || !brouillon) return;
      var r = copie(brouillon.releve), v = ev.target.value, p = ev.target.dataset.p;
      if (p === undefined) {
        if (c === 'matiere') r.matiere = v;
        else if (c === 'coq') K.poserCoquille(r, +v);
        else r[c] = +v;
      } else {
        var q = r.pieces[+p];
        q[c] = c === 'mode' || c === 'sens' || c === 'fermeture' || c === 'forme' || c === 'plat' ? v : (v === '' ? undefined : +v);
        r.pieces[+p] = K.piece(q);
      }
      figerSaisie(r);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) couperMicros(); });
    peindreMicro($('cmMicro'), false, 'Reprendre la dictée', '');
  }

  /* réglage de l'agent IA, dans l'onglet Mémo */
  function etatIA() {
    var lu = lire(CLE_IA);
    IA = lu ? { actif: !!lu.actif, cle: String(lu.cle || '') } : { actif: false, cle: '' };
    $('iaActif').checked = IA.actif;
    if (document.activeElement !== $('iaCle')) $('iaCle').value = IA.cle;
    $('iaEtat').textContent = IA.actif && IA.cle ? 'La dictée tôle est lue par l’agent IA Claude.' : 'La dictée est lue par l’interprète intégré.';
  }
  $('iaActif').addEventListener('change', function () { ecrire(CLE_IA, { actif: this.checked, cle: IA.cle }); etatIA(); });
  $('iaCle').addEventListener('change', function () { var c = this.value.trim(); ecrire(CLE_IA, { actif: !!c, cle: c }); etatIA(); });
  $('iaOublier').addEventListener('click', function () { ecrire(CLE_IA, { actif: false, cle: '' }); $('iaCle').value = ''; etatIA(); });
  etatIA();

  function rendre() {
    if (!pret) init();
    montrer();
    if (vue === 'tole') dessinerTole();
    dessinerPvc();
    if (root.Widgets) root.Widgets.organiser($('out-cote-pvc'), 'cotepvc');
  }
  function quitter() { if (!pret) return; couperMicros(); if (brouillon) fermerSaisie(); if (dessin) fermerDessin(); if (!$('pvcSaisie').hidden) terminerPvc(); }

  root.Cote = { rendre: rendre, quitter: quitter };
})(this);
