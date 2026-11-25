/* Calo Découpe — réaction au clic et au doigt (rebond et onde de lumière) et entrée des widgets.
   Le survol et l'appui sont réglés dans style.css. */
(function () {
  'use strict';
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)');
  var CIBLES = 'button, summary, .brand, select, input[type="number"], .stat, .cotes > div, .fiche > div > p, .summary > div:not(.warn), tbody tr';
  var appui = null;

  /* petit rebond : l'élément grossit à peine puis se repose */
  function rebond(el) {
    if (!el.animate) return;
    if (el.tagName === 'TR') {
      el.animate([{ backgroundColor: 'rgba(255,164,44,.34)' }, { backgroundColor: 'rgba(255,164,44,0)' }], { duration: 650, easing: 'ease-out' });
      return;
    }
    var ampleur = el.matches('input, select') ? 0.012 : el.matches('.stat, .cotes > div, .fiche > div > p') ? 0.028 : 0.05;
    el.animate([
      { scale: 1 - ampleur * 0.6 },
      { scale: 1 + ampleur, offset: 0.42 },
      { scale: 1 - ampleur * 0.15, offset: 0.72 },
      { scale: 1 }
    ], { duration: 560, easing: 'cubic-bezier(.25,.8,.3,1)' });
  }

  /* onde partant du point touché ; posée par-dessus la page pour survivre à un nouvel affichage */
  function onde(el, x, y) {
    if (el.matches('input, select, tr')) return;
    var cadre = el.getBoundingClientRect();
    if (!cadre.width || !document.body.animate) return;
    var boite = document.createElement('span'), rond = document.createElement('i');
    boite.className = 'onde';
    boite.setAttribute('aria-hidden', 'true');
    boite.style.cssText = 'left:' + cadre.left + 'px;top:' + cadre.top + 'px;width:' + cadre.width + 'px;height:' + cadre.height + 'px;border-radius:' + getComputedStyle(el).borderRadius;
    var px = x - cadre.left, py = y - cadre.top;
    var rayon = Math.hypot(Math.max(px, cadre.width - px), Math.max(py, cadre.height - py)) * 1.25;
    rond.style.cssText = 'left:' + (px - rayon) + 'px;top:' + (py - rayon) + 'px;width:' + rayon * 2 + 'px;height:' + rayon * 2 + 'px';
    boite.appendChild(rond);
    document.body.appendChild(boite);
    var fin = function () { boite.remove(); };
    rond.animate([{ scale: 0.05, opacity: 0.9 }, { scale: 1, opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.18,.7,.2,1)' }).onfinish = fin;
    setTimeout(fin, 900);   /* filet de sécurité si l'onglet est en arrière-plan */
  }

  function reagir(el, x, y) {
    onde(el, x, y);
    /* l'élément a pu être redessiné par le clic : on anime celui qui a pris sa place */
    setTimeout(function () {
      var cible = el;
      if (!cible.isConnected) {
        var dessous = document.elementFromPoint(x, y);
        cible = dessous && dessous.closest(CIBLES);
      }
      if (cible) rebond(cible);
    }, 30);
  }

  document.addEventListener('pointerdown', function (ev) {
    var el = ev.button === 0 && ev.target.closest(CIBLES);
    appui = el ? { el: el, x: ev.clientX, y: ev.clientY, id: ev.pointerId } : null;
  }, true);
  document.addEventListener('pointerup', function (ev) {
    /* un doigt qui a glissé faisait défiler la page : ce n'était pas un clic */
    if (appui && appui.id === ev.pointerId && Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) < 10) reagir(appui.el, ev.clientX, ev.clientY);
    appui = null;
  }, true);
  document.addEventListener('pointercancel', function () { appui = null; }, true);
  /* au clavier aussi */
  document.addEventListener('click', function (ev) {
    if (ev.detail !== 0) return;
    var el = ev.target.closest(CIBLES);
    if (!el) return;
    var r = el.getBoundingClientRect();
    reagir(el, r.left + r.width / 2, r.top + r.height / 2);
  }, true);
  /* nécessaire pour que Safari sur téléphone applique l'effet d'appui */
  document.addEventListener('touchstart', function () {}, { passive: true });

  /* à chaque changement d'onglet, les widgets arrivent en cascade */
  var minuterie = 0;
  function entree() {
    var panneau = document.querySelector('.panel.active');
    if (!panneau || calme.matches) return;
    document.querySelectorAll('.panel.entree').forEach(function (p) { p.classList.remove('entree'); });
    panneau.querySelectorAll('.card, .stat').forEach(function (el, i) { el.style.setProperty('--rang', Math.min(i, 9)); });
    void panneau.offsetWidth;
    panneau.classList.add('entree');
    clearTimeout(minuterie);
    minuterie = setTimeout(function () { panneau.classList.remove('entree'); }, 1100);
  }
  var onglets = document.querySelector('.tabs');
  new MutationObserver(entree).observe(onglets, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
  entree();
})();
