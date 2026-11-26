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
    $('cmSelection').hidden = !!brouillon || choisi === null;
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
    }).join('') + '<p class="note">Cotes finies en ' + O.un() + ', sans les recouvrements. D = dos, V = ventre. Trait orange : fermeture.</p>';
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
  function ouvrirSaisie(i) {
    micTole.couper();
    var base = i === null ? neuf() : K.normaliser(copie(morceaux[i]));
    brouillon = { i: i, base: base, releve: copie(base), doutes: [], ia: '', occupe: false };
    choisi = null;
    $('cmTitre').textContent = i === null ? 'Nouveau morceau ' + (morceaux.length + 1) : 'Modifier le morceau ' + (i + 1);
    $('cmTexte').value = '';
    $('cmTexte').placeholder = i === null ? 'Tuyau en 60-40, un coude en tête, fermeture de dos avec deux sections' : 'Trois sections, fermeture en ventre';
    $('cmInfo').textContent = '';
    $('cmPanneau').hidden = false; $('cmAjouter').hidden = true;
    dessinerTole(); resumeSaisie();
    micTole.demarrer();
    scene.el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function fermerSaisie() {
    micTole.couper();
    brouillon = null;
    $('cmPanneau').hidden = true; $('cmAjouter').hidden = false;
    dessinerTole();
  }
  function lireTexte() {
    if (!brouillon) return;
    var t = $('cmTexte').value.trim();
    if (!t) { brouillon.releve = copie(brouillon.base); brouillon.doutes = []; }
    else {
      var res = K.interpreter(t, brouillon.base, O.un(), { corrige: brouillon.i !== null });
      brouillon.releve = res.releve; brouillon.releve.finition = 'tole'; brouillon.doutes = res.doutes;
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
  function dessinerPvc() {
    if (!entrees.length) {
      $('pvcListe').innerHTML = '<p class="note vide">Rien pour l’instant. Dites par exemple : « en 60-40, 4 coudes et 12 mètres ».</p>';
      $('pvcRecap').innerHTML = '<p class="note vide">Le récapitulatif se remplit tout seul.</p>';
      return;
    }
    $('pvcListe').innerHTML = '<ol class="metre">' + entrees.map(function (x, i) {
      var puces = NOMS.filter(function (k) { return x.q[k[0]]; }).map(function (k) { return '<span class="q q-' + (k[2] === 'PVC' ? 'pvc' : 'laine') + '">' + quantite(k, x.q[k[0]]) + '</span>'; }).join('');
      var a = anglesTexte(x.angles);
      return '<li><i>' + (i + 1) + '</i><div><p><b>' + nomDiam(x) + '</b> <small>' + detailDiam(x) + '</small></p><div class="puces">' + puces + '</div>' + (a ? '<small>Coudes : ' + a + '</small>' : '') + '</div><button type="button" data-act="retirer" data-n="' + i + '" aria-label="Retirer la ligne ' + (i + 1) + '">✕</button></li>';
    }).join('') + '</ol><div class="actions"><button type="button" class="btn" data-act="toutvider">Vider la liste</button></div>';

    var total = {};
    var cases = function (q, tout) {
      return NOMS.filter(function (k, i) { return i < 4 || q[k[0]]; }).map(function (k) {
        var n = q[k[0]] || 0;
        var titre = k[1] === 'm' ? k[2].charAt(0).toUpperCase() + k[2].slice(1) : (k[1] === 'coude' ? 'Coudes ' : 'Coquilles ') + k[2];
        return '<div class="q-' + (k[2] === 'PVC' ? 'pvc' : 'laine') + (n ? '' : ' nul') + '"><span>' + titre + '</span><b>' + (n ? nombre(n) : '–') + '</b>' + (n && k[1] === 'm' ? '<small>m</small>' : '') + '</div>';
      }).join('');
    };
    var groupes = K.recapitulatif(entrees);
    groupes.forEach(function (g) { NOMS.forEach(function (k) { if (g.q[k[0]]) total[k[0]] = (total[k[0]] || 0) + g.q[k[0]]; }); });
    $('pvcRecap').innerHTML = groupes.map(function (g) {
      var a = anglesTexte(g.angles);
      return '<div class="recap-diam"><h3><b>' + nomDiam(g) + '</b><span>' + detailDiam(g) + '</span></h3><div class="recap-cases">' + cases(g.q) + '</div>' + (a ? '<p class="note">Coudes : ' + a + '</p>' : '') + '</div>';
    }).join('') + (groupes.length > 1 ? '<div class="recap-diam total"><h3><b>Total</b><span>tous diamètres</span></h3><div class="recap-cases">' + cases(total) + '</div></div>' : '');
  }
  function lirePvc() {
    var t = $('pvcTexte').value.trim();
    if (depart === null) depart = copie(entrees);
    var res = t ? K.metre(t, depart) : { entrees: copie(depart), doutes: [] };
    entrees = res.entrees; ecrire(CLE_PVC, entrees);
    $('pvcDoutes').innerHTML = res.doutes.length ? '<div class="warn"><ul>' + res.doutes.map(function (x) { return '<li>' + echapper(x) + '</li>'; }).join('') + '</ul></div>' : '';
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
      surChoix: function (i) { if (brouillon) return; choisi = i; if (i !== null) plat = i; dessinerTole(); }
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
    $('pvcTexte').addEventListener('input', lirePvc);

    $('coteFinition').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      couperMicros();
      if (brouillon) fermerSaisie();
      if (!$('pvcSaisie').hidden) terminerPvc();
      vue = b.dataset.finition; ecrire(CLE_VUE, vue); montrer();
      if (vue === 'tole') dessinerTole();
    });
    $('p-cote').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act, i = +b.dataset.i;
      if (act === 'ajouter') ouvrirSaisie(null);
      else if (act === 'micro') { if (micTole.actif()) micTole.arreter(); else micTole.demarrer(); }
      else if (act === 'ok') valider();
      else if (act === 'abandon') fermerSaisie();
      else if (act === 'modifier') { if (choisi !== null) ouvrirSaisie(choisi); }
      else if (act === 'jeter') {
        if (choisi === null || !window.confirm('Supprimer définitivement le morceau ' + (choisi + 1) + ' ?')) return;
        morceaux.splice(choisi, 1); choisi = null; plat = null; sauverTole(); dessinerTole();
      } else if (act === 'voir') {
        if (brouillon) return;
        choisi = i; plat = i; dessinerTole(); scene.el.scrollIntoView({ block: 'start' });
      } else if (act === 'plat') { if (brouillon) return; plat = i; if (choisi !== null) choisi = i; dessinerTole(); }
      else if (act === 'gabarit') O.gabarit('cote', formes[+b.dataset.n]);
      else if (act === 'oter') { var r = copie(brouillon.releve); r.pieces.splice(+b.dataset.p, 1); figerSaisie(r); }
      else if (act === 'pvc') basculerPvc();
      else if (act === 'retirer') { entrees.splice(+b.dataset.n, 1); figerPvc(); }
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
  function quitter() { if (!pret) return; couperMicros(); if (brouillon) fermerSaisie(); if (!$('pvcSaisie').hidden) terminerPvc(); }

  root.Cote = { rendre: rendre, quitter: quitter };
})(this);
