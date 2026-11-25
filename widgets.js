/* Calo Découpe — widgets repliables et déplaçables, réglages repliables, barre d'onglets en bas sur téléphone.
   La disposition choisie (ordre et widgets repliés) est gardée dans le navigateur. */
(function (root) {
  'use strict';
  var CLE = 'calo-widgets-v1';
  var E = { ordre: {}, plies: {}, groupes: {} };
  try { var lu = JSON.parse(localStorage.getItem(CLE) || '{}'); E.ordre = lu.ordre || {}; E.plies = lu.plies || {}; E.groupes = lu.groupes || {}; } catch (err) { /* stockage indisponible */ }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(E)); } catch (err) { /* idem */ } }

  var CHEVRON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>';
  var POIGNEE = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="5" r="1.6"/><circle cx="13" cy="5" r="1.6"/><circle cx="7" cy="10" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="7" cy="15" r="1.6"/><circle cx="13" cy="15" r="1.6"/></svg>';
  var ETROIT = window.matchMedia('(max-width: 720px)');
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)');

  function slug(t) {
    return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /* ---------- habillage d'un widget : barre (poignée, titre, flèche) et corps repliable ---------- */
  function habiller(w, opts, prises) {
    if (w.classList.contains('widget')) return;
    var h2 = w.querySelector('h2');
    var titre = opts.titre || (h2 ? h2.textContent.trim() : 'Widget');
    var cle = opts.cle || (opts.onglet + ':' + slug(titre));
    if (prises) { var base = cle, n = 2; while (prises[cle]) cle = base + '-' + n++; prises[cle] = true; }

    var barre = document.createElement('div');
    barre.className = 'w-barre';
    if (opts.deplacable) barre.insertAdjacentHTML('beforeend', '<button type="button" class="w-poignee" aria-label="Déplacer ce widget">' + POIGNEE + '</button>');
    var zoneTitre = document.createElement('div');
    zoneTitre.className = 'w-titre';
    if (!h2) { h2 = document.createElement('h2'); h2.textContent = titre; }
    var piece = h2.parentNode && h2.parentNode.classList && h2.parentNode.classList.contains('piece') ? h2.parentNode : null;
    zoneTitre.appendChild(h2);
    barre.appendChild(zoneTitre);
    if (piece) {
      var tag = piece.querySelector('.tag');
      if (tag) barre.appendChild(tag);
      if (!piece.children.length) piece.remove();
    }
    barre.insertAdjacentHTML('beforeend', '<button type="button" class="w-plier" aria-label="Masquer ou afficher">' + CHEVRON + '</button>');

    var corps = document.createElement('div'), int = document.createElement('div');
    corps.className = 'w-corps'; int.className = 'w-int';
    corps.appendChild(int);
    Array.prototype.slice.call(w.childNodes).forEach(function (n) { if (n !== opts.garde) int.appendChild(n); });
    w.insertBefore(barre, w.firstChild);
    w.insertBefore(corps, opts.garde || null);

    w.classList.add('widget');
    if (opts.deplacable) w.classList.add('deplacable');
    w.dataset.w = cle;
    var plie = !!E.plies[cle];
    w.classList.toggle('plie', plie);
    barre.querySelector('.w-plier').setAttribute('aria-expanded', String(!plie));
  }

  function plier(w) {
    var plie = !w.classList.contains('plie');
    w.classList.add('bouge');
    w.classList.toggle('plie', plie);
    w.querySelector(':scope > .w-barre .w-plier').setAttribute('aria-expanded', String(!plie));
    if (plie) E.plies[w.dataset.w] = true; else delete E.plies[w.dataset.w];
    sauver();
    clearTimeout(w._bouge);
    w._bouge = setTimeout(function () { w.classList.remove('bouge'); }, 450);
  }

  /* ---------- groupes de boutons (épaisseurs, coquilles, angles) repliables ---------- */
  function habillerGroupe(f) {
    var rang = f.querySelector('.chips, .seg'), lab = f.querySelector(':scope > span');
    if (!rang || !lab || f.classList.contains('groupe')) return;
    f.classList.add('groupe');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'g-tete';
    f.insertBefore(b, lab);
    b.appendChild(lab);
    var val = document.createElement('b'); val.className = 'g-val';
    b.appendChild(val);
    b.insertAdjacentHTML('beforeend', CHEVRON);
    var corps = document.createElement('div'), int = document.createElement('div');
    corps.className = 'g-corps'; int.className = 'g-int';
    f.insertBefore(corps, rang); corps.appendChild(int); int.appendChild(rang);
    var plie = !!E.groupes[rang.id];
    f.classList.toggle('g-plie', plie);
    b.setAttribute('aria-expanded', String(!plie));

    var premier = true;
    var maj = function () {
      var p = rang.querySelector('[aria-pressed="true"]');
      val.textContent = p ? p.textContent : 'autre';
      /* sur téléphone la rangée défile : le choix reste au centre */
      if (p && rang.scrollWidth > rang.clientWidth + 2) {
        var x = p.offsetLeft - (rang.clientWidth - p.offsetWidth) / 2;
        rang.scrollTo({ left: Math.max(0, x), behavior: premier || calme.matches ? 'auto' : 'smooth' });
      }
      premier = false;
    };
    new MutationObserver(maj).observe(rang, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
    rang._maj = maj;
    maj();
  }

  function plierGroupe(f) {
    var rang = f.querySelector('.chips, .seg'), plie = !f.classList.contains('g-plie');
    f.classList.toggle('g-plie', plie);
    f.querySelector('.g-tete').setAttribute('aria-expanded', String(!plie));
    if (plie) E.groupes[rang.id] = true; else delete E.groupes[rang.id];
    sauver();
    if (!plie && rang._maj) setTimeout(rang._maj, 60);
  }

  /* ---------- barre d'onglets : en haut sur ordinateur, en bas sur téléphone ---------- */
  var nav = document.querySelector('.tabs'), entete = document.querySelector('.top'), marque = document.querySelector('.brand');
  function placerNav() {
    if (ETROIT.matches) {
      if (nav.parentNode !== document.body) document.body.appendChild(nav);
      nav.classList.add('bas');
    } else {
      if (nav.parentNode !== entete) entete.insertBefore(nav, marque.nextSibling);
      nav.classList.remove('bas');
    }
    window.dispatchEvent(new Event('resize'));
  }
  placerNav();
  ETROIT.addEventListener('change', placerNav);

  /* ---------- mise en place des parties fixes de la page ---------- */
  var pret = false;
  function initStatique() {
    if (pret) return;
    pret = true;
    var base = document.getElementById('base');
    habiller(base, { titre: 'Tuyau et isolant', cle: 'base', garde: base.querySelector('.summary') });
    document.querySelectorAll('.panel .controls.card').forEach(function (c) {
      habiller(c, { titre: c.dataset.titre || 'Réglages', cle: c.closest('.panel').id + ':reglages' });
    });
    document.querySelectorAll('#base .field.wide, .controls .field.wide').forEach(habillerGroupe);
    var memo = document.querySelector('#p-memo .grid');
    if (memo) organiser(memo, 'memo');
    var raz = document.getElementById('resetDispo');
    if (raz) raz.addEventListener('click', function () {
      E = { ordre: {}, plies: {}, groupes: {} }; sauver(); location.reload();
    });
  }

  /* ---------- un panneau de résultats devient une grille de widgets ---------- */
  var NOMS_RES = ['Résultats', 'Quantités'];
  function organiser(cont, onglet) {
    initStatique();
    cont.classList.add('widgets');
    cont.dataset.onglet = onglet;
    cont.querySelectorAll(':scope > .grid').forEach(function (g) {
      while (g.firstChild) cont.insertBefore(g.firstChild, g);
      g.remove();
    });
    cont.querySelectorAll(':scope > [data-scene]').forEach(function (d) {
      var f = d.firstElementChild;
      if (f) { f.classList.add('full'); cont.insertBefore(f, d); }
      d.remove();
    });
    var prises = {}, ires = 0;
    Array.prototype.slice.call(cont.children).forEach(function (el) {
      if (el.classList.contains('big')) {
        var w = document.createElement('section');
        w.className = 'card full widget-res';
        cont.insertBefore(w, el); w.appendChild(el);
        habiller(w, { titre: NOMS_RES[ires] || 'Résultats', cle: onglet + ':res-' + ires, deplacable: true }, prises);
        ires++;
      } else if (el.classList.contains('card')) {
        if (el.dataset.w) prises[el.dataset.w] = true;
        habiller(el, { onglet: onglet, deplacable: true }, prises);
      }
    });
    ordonner(cont, onglet);
  }

  function widgetsDe(cont) { return Array.prototype.filter.call(cont.children, function (e) { return e.classList.contains('widget'); }); }

  function ordonner(cont, onglet) {
    var ws = widgetsDe(cont), N = ws.map(function (w) { return w.dataset.w; });
    var S = (E.ordre[onglet] || []).filter(function (k) { return N.indexOf(k) >= 0; });
    N.forEach(function (k, i) {
      if (S.indexOf(k) >= 0) return;
      var j = -1;
      for (var p = i - 1; p >= 0 && j < 0; p--) j = S.indexOf(N[p]);
      S.splice(j + 1, 0, k);
    });
    var parCle = {};
    ws.forEach(function (w) { parCle[w.dataset.w] = w; });
    var ok = S.every(function (k, i) { return ws[i] === parCle[k]; });
    if (!ok) S.forEach(function (k) { cont.appendChild(parCle[k]); });
  }

  /* ---------- glisser-déposer avec la poignée ---------- */
  var glisse = null;
  function deplacerAvecAnimation(cont, faire) {
    var autres = widgetsDe(cont).filter(function (w) { return w !== glisse.w; });
    var avant = autres.map(function (w) { return w.getBoundingClientRect(); });
    faire();
    autres.forEach(function (w, i) {
      var apres = w.getBoundingClientRect(), dx = avant[i].left - apres.left, dy = avant[i].top - apres.top;
      if ((dx || dy) && w.animate && !calme.matches) {
        w.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
  }

  function placerGlisse() {
    var g = glisse, w = g.w;
    var r = w.getBoundingClientRect(), natL = r.left - g.tx, natT = r.top - g.ty;
    var ws = widgetsDe(g.cont), wi = ws.indexOf(w), largeur = g.cont.clientWidth;
    for (var i = 0; i < ws.length; i++) {
      var s = ws[i];
      if (s === w) continue;
      var q = s.getBoundingClientRect();
      if (g.x < q.left || g.x > q.right || g.y < q.top || g.y > q.bottom) continue;
      var cote = q.width < largeur * 0.7 && Math.abs(q.top - natT) < 12;
      var premiereMoitie = cote ? g.x < q.left + q.width / 2 : g.y < q.top + q.height / 2;
      if (wi > i && premiereMoitie) deplacerAvecAnimation(g.cont, function () { g.cont.insertBefore(w, s); });
      else if (wi < i && !premiereMoitie) deplacerAvecAnimation(g.cont, function () { g.cont.insertBefore(w, s.nextSibling); });
      else break;
      r = w.getBoundingClientRect(); natL = r.left - g.tx; natT = r.top - g.ty;
      break;
    }
    g.tx = g.x - g.ox - natL; g.ty = g.y - g.oy - natT;
    w.style.translate = g.tx + 'px ' + g.ty + 'px';
  }

  function boucle() {
    if (!glisse) return;
    var y = glisse.y, H = window.innerHeight, bas = ETROIT.matches ? 120 : 50, v = 0;
    if (y < 110) v = -Math.min(16, (110 - y) / 4);
    else if (y > H - bas) v = Math.min(16, (y - (H - bas)) / 4);
    if (v) window.scrollBy(0, v);
    placerGlisse();
    requestAnimationFrame(boucle);
  }

  var finA = 0;
  function finGlisse() {
    finA = Date.now();
    var g = glisse;
    glisse = null;
    document.body.classList.remove('en-glisse');
    var w = g.w;
    if (w.animate && !calme.matches) w.animate([{ translate: g.tx + 'px ' + g.ty + 'px' }, { translate: '0px 0px' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.25,1)' });
    w.style.translate = '';
    w.classList.remove('attrape');
    E.ordre[g.cont.dataset.onglet] = widgetsDe(g.cont).map(function (x) { return x.dataset.w; });
    sauver();
  }

  document.addEventListener('pointerdown', function (ev) {
    var h = ev.target.closest('.w-poignee');
    if (!h || ev.button !== 0 || glisse) return;
    var w = h.closest('.widget'), cont = w.parentNode;
    if (!cont.dataset.onglet) return;
    ev.preventDefault();
    var r = w.getBoundingClientRect();
    glisse = { w: w, cont: cont, id: ev.pointerId, ox: ev.clientX - r.left, oy: ev.clientY - r.top, x: ev.clientX, y: ev.clientY, tx: 0, ty: 0 };
    try { h.setPointerCapture(ev.pointerId); } catch (err) { /* capture facultative */ }
    w.classList.add('attrape');
    document.body.classList.add('en-glisse');
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* sans vibreur */ } }
    requestAnimationFrame(boucle);
  });
  document.addEventListener('pointermove', function (ev) {
    if (glisse && ev.pointerId === glisse.id) { glisse.x = ev.clientX; glisse.y = ev.clientY; }
  });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    document.addEventListener(n, function (ev) { if (glisse && ev.pointerId === glisse.id) finGlisse(); });
  });

  /* ---------- flèches et titres : masquer ou afficher ---------- */
  document.addEventListener('click', function (ev) {
    if (Date.now() - finA < 350) return;   /* le clic qui suit un glisser ne replie rien */
    var b = ev.target.closest('.w-plier, .w-titre');
    if (b) { var w = b.closest('.widget'); if (w) plier(w); return; }
    var g = ev.target.closest('.g-tete');
    if (g) plierGroupe(g.parentNode);
  });

  root.Widgets = { organiser: organiser };
})(this);
