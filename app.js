/* CaloCoupe — interface */
(function () {
  'use strict';
  var C = window.Calc;
  var $ = function (id) { return document.getElementById(id); };
  var EPAISSEURS = [20, 25, 30, 40, 50, 60, 80, 100];
  var COQUILLES = [16, 21, 27, 32, 34, 42, 49, 54, 60, 76, 89, 114, 140];
  var CLE = 'calocoupe-v2';

  var DEFAUT = {
    tab: 'droit', theme: '', tube: 50, dLibre: 60.3, coq: 60, e: 30, recouv: 30,
    longueur: 10, lcoq: 1000, largeur: 1000,
    angle: 90, sections: 1, rayon: 76, rayonAuto: true,
    tube2: 25, dLibre2: 33.7, coq2: 34, e2: 30, gamma: 90
  };
  var S = Object.assign({}, DEFAUT);
  try { Object.assign(S, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (err) { /* stockage indisponible */ }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(S)); } catch (err) { /* idem */ } }

  /* ---------- outils ---------- */
  function fmt(v, dec) {
    if (!isFinite(v)) return '–';
    var x = Number(v.toFixed(dec || 0));
    if (Object.is(x, -0)) x = 0;
    return x.toLocaleString('fr-FR', { maximumFractionDigits: dec || 0 });
  }
  var anciens = {};
  /* nombre qui défile jusqu'à sa nouvelle valeur */
  function num(cle, v, dec) {
    return '<span class="n" data-k="' + cle + '" data-v="' + v + '" data-d="' + (dec || 0) + '">' + fmt(v, dec) + '</span>';
  }
  function animer(racine) {
    var calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    racine.querySelectorAll('.n').forEach(function (el) {
      var k = el.dataset.k, v = +el.dataset.v, d = +el.dataset.d;
      var de = anciens[k];
      anciens[k] = v;
      if (calme || de === undefined || de === v || document.hidden) return;
      var t0 = null;
      el.textContent = fmt(de, d);
      requestAnimationFrame(function pas(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / 320), q = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(de + (v - de) * q, d);
        if (p < 1) requestAnimationFrame(pas);
      });
    });
  }
  function stat(titre, valeur, unite, aide, fort) {
    return '<div class="stat' + (fort ? ' hl' : '') + '"><span>' + titre + '</span><b>' + valeur + '</b><small>' + (unite || '') + '</small>' + (aide ? '<em>' + aide + '</em>' : '') + '</div>';
  }
  function table(entetes, lignes) {
    return '<div class="table"><table><thead><tr>' + entetes.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + lignes.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function chemin(pts, ferme) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('') + (ferme ? 'Z' : '');
  }
  function txt(x, y, s, ancre, cls) {
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + (ancre || 'middle') + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</text>';
  }
  function svg(vb, corps, label) {
    return '<svg viewBox="' + vb + '" role="img" aria-label="' + label + '"><g class="anim">' + corps + '</g></svg>';
  }
  /* largeur des dessins à plat : plus étroite sur téléphone pour garder le texte lisible */
  var ETROIT = window.matchMedia('(max-width: 720px)');
  function largeurDessin() { return ETROIT.matches ? 360 : 640; }
  function tubeDe(dn) { return C.TUBES.filter(function (t) { return t.dn === +dn; })[0]; }

  /* ---------- données communes ---------- */
  function resume() {
    var D = C.diametreFini(S.coq, S.e);
    $('summary').innerHTML = [
      ['Ø tube', num('s-d', S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d, 1) + ' mm'],
      ['Épaisseur', num('s-e', S.e, 1) + ' mm'],
      ['Ø fini isolé', num('s-D', D, 1) + ' mm'],
      ['Développé isolant', num('s-dev', C.developpe(D)) + ' mm'],
      ['Feuille PVC', num('s-pvc', C.developpe(D) + S.recouv) + ' mm']
    ].map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
    $('summary').insertAdjacentHTML('afterbegin', alerteCoquille(S.coq, S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d, 'tube'));
    animer($('summary'));
  }

  /* signale une coquille qui ne correspond pas au tube */
  function alerteCoquille(coq, d, quoi) {
    return coq > 0 && (coq < d - 1 || coq > d + 3) ? '<div class="warn mini" role="alert">Coquille Ø ' + fmt(coq, 1) + (coq < d ? ' plus petite' : ' plus grande') + ' que le ' + quoi + ' Ø ' + fmt(d, 1) + ' : vérifiez votre choix.</div>' : '';
  }

  /* rappel des réglages repliés */
  function recaps() {
    $('recapBase').textContent = 'Recouvrement ' + fmt(S.recouv, 1) + ' mm';
    $('recapDroit').textContent = 'Coquille ' + fmt(S.lcoq) + ' mm · virole ' + fmt(S.largeur) + ' mm';
    $('recapCoude').textContent = 'Rayon ' + fmt(S.rayon, 1) + ' mm';
  }

  /* ---------- développés ---------- */
  function dessinCoupe(d, r) {
    var k = 105 / (r.D / 2), R = r.D / 2 * k, rc = S.coq / 2 * k, rt = Math.min(d, S.coq) / 2 * k;
    var a = Math.min(300, S.recouv / (r.D / 2) * 180 / Math.PI);
    var pol = function (ang, ray) { var t = ang * Math.PI / 180; return [170 + ray * Math.sin(t), 140 - ray * Math.cos(t)]; };
    var p0 = pol(120, R + 8), p1 = pol(120 + a, R + 8);
    var g = '<circle class="s-wool" cx="170" cy="140" r="' + R + '"/>' +
      '<circle class="s-hole" cx="170" cy="140" r="' + rc + '"/>' +
      '<circle class="s-steel" cx="170" cy="140" r="' + rt + '"/>' +
      '<circle class="s-hole" cx="170" cy="140" r="' + Math.max(0, rt - Math.max(3, rt * .12)) + '"/>' +
      '<circle class="s-pvc" cx="170" cy="140" r="' + (R + 3) + '"/>' +
      (S.recouv > 0 ? '<path class="s-pvc" d="M' + p0[0] + ' ' + p0[1] + 'A' + (R + 8) + ' ' + (R + 8) + ' 0 ' + (a > 180 ? 1 : 0) + ' 1 ' + p1[0] + ' ' + p1[1] + '"/>' : '') +
      '<path class="s-dim" d="M' + (170 - R) + ' 270H' + (170 + R) + 'M' + (170 - R) + ' 140V276M' + (170 + R) + ' 140V276"/>' +
      txt(170, 288, 'Ø fini ' + fmt(r.D, 1)) +
      '<path class="s-dim" d="M170 ' + (140 - rc) + 'V' + (140 - R) + '"/>' +
      txt(176, 140 - (R + rc) / 2 + 4, 'é ' + fmt(S.e, 1), 'start');
    return svg('0 0 340 296', g, 'Coupe du tuyau isolé');
  }

  function rendreDroit() {
    var d = S.tube === 'libre' ? S.dLibre : tubeDe(S.tube).d;
    var r = C.droit({ dInt: S.coq, e: S.e, recouv: S.recouv, longueur: S.longueur, longueurCoquille: S.lcoq, largeur: S.largeur });
    var html = '<div class="big">' +
      stat('Feuille PVC à couper', num('d-f', r.feuille), 'mm', 'développé + ' + fmt(S.recouv) + ' mm de recouvrement', true) +
      stat('Développé sur isolant', num('d-dev', r.dev, 1), 'mm', 'π × ' + fmt(r.D, 1)) +
      stat('Développé du tube nu', num('d-tube', C.developpe(d), 1), 'mm', 'π × ' + fmt(d, 1)) +
      stat('Ø fini isolé', num('d-D', r.D, 1), 'mm', fmt(S.coq, 1) + ' + 2 × ' + fmt(S.e, 1)) +
      '</div>';
    if (S.longueur > 0) {
      html += '<div class="big">' +
        stat('Coquilles', num('m-c', r.coquilles), 'pièces', 'de ' + fmt(S.lcoq) + ' mm, hors chutes') +
        stat('Viroles PVC', num('m-v', r.viroles), 'pièces', fmt(S.largeur) + ' × ' + fmt(r.feuille) + ' mm') +
        stat('Surface PVC', num('m-s', r.surfacePVC, 2), 'm²', 'hors chutes') +
        stat('Volume de laine', num('m-vol', r.volumeIsolant, 3), 'm³', 'sur ' + fmt(S.longueur, 2) + ' m') +
        '</div>';
    }
    var eps = EPAISSEURS.indexOf(S.e) < 0 ? EPAISSEURS.concat(S.e).sort(function (a, b) { return a - b; }) : EPAISSEURS;
    var lignes = eps.map(function (e) {
      var D = C.diametreFini(S.coq, e);
      return '<tr class="clic' + (e === S.e ? ' on' : '') + '" data-e="' + e + '" tabindex="0"><td>' + fmt(e, 1) + ' mm</td><td>' + fmt(D, 1) + '</td><td>' + fmt(C.developpe(D)) + '</td><td><b>' + fmt(C.developpe(D) + S.recouv) + '</b></td></tr>';
    }).join('');
    html += '<div class="grid">' +
      '<figure class="card draw"><h2>Coupe</h2>' + dessinCoupe(d, r) + '<figcaption>En bleu : la feuille PVC et son recouvrement.</figcaption></figure>' +
      '<div class="card"><h2>Toutes les épaisseurs pour ce tube</h2><div class="table"><table><thead><tr><th>Épaisseur</th><th>Ø fini</th><th>Développé</th><th>Feuille PVC</th></tr></thead><tbody>' + lignes + '</tbody></table></div><p class="note">Touchez une ligne pour choisir cette épaisseur. Cotes en mm.</p></div>' +
      '</div>';
    $('out-droit').innerHTML = html;
  }

  /* ---------- coude ---------- */
  function dessinCoude(c) {
    var R = c.R, r = c.r, A = c.angle, b = c.beta;
    var stub = Math.max(r * .55, 20);
    var pt = function (ang, rad) { var t = ang * Math.PI / 180; return [rad * Math.cos(t), rad * Math.sin(t)]; };
    var bords = [0];
    for (var k = 0; k <= c.n; k++) bords.push((2 * k + 1) * b);
    bords.push(A);
    var rayonSur = function (i, rad) { return (i === 0 || i === bords.length - 1) ? rad : rad / Math.cos(b * Math.PI / 180); };
    var pieces = [];
    for (var i = 0; i < bords.length - 1; i++) {
      var a0 = bords[i], a1 = bords[i + 1];
      pieces.push([pt(a0, rayonSur(i, R + r)), pt(a1, rayonSur(i + 1, R + r)), pt(a1, rayonSur(i + 1, Math.max(0, R - r))), pt(a0, rayonSur(i, Math.max(0, R - r)))]);
    }
    var dir = function (ang, s) { var t = ang * Math.PI / 180; return [-Math.sin(t) * s, Math.cos(t) * s]; };
    var plus = function (p, v) { return [p[0] + v[0], p[1] + v[1]]; };
    var in_ = Math.max(0, R - r);
    var stubs = [
      [pt(0, R + r), pt(0, in_), plus(pt(0, in_), dir(0, -stub)), plus(pt(0, R + r), dir(0, -stub))],
      [pt(A, R + r), pt(A, in_), plus(pt(A, in_), dir(A, stub)), plus(pt(A, R + r), dir(A, stub))]
    ];
    var tous = [].concat.apply([], pieces.concat(stubs));
    var xs = tous.map(function (p) { return p[0]; }), ys = tous.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k2 = Math.min(300 / (x1 - x0), 270 / (y1 - y0));
    var map = function (p) { return [50 + (300 - (x1 - x0) * k2) / 2 + (p[0] - x0) * k2, 20 + (y1 - p[1]) * k2]; };
    var g = stubs.map(function (s) { return '<path class="s-stub" d="' + chemin(s.map(map), true) + '"/>'; }).join('');
    pieces.forEach(function (p, i) {
      var full = i > 0 && i < pieces.length - 1;
      g += '<path class="' + (i % 2 ? 's-wool2' : 's-wool') + '" d="' + chemin(p.map(map), true) + '"><title>' + (full ? 'Section entière' : 'Demi-section') + '</title></path>';
      var mid = (bords[i] + bords[i + 1]) / 2;
      var m = map(pt(mid, R + r * .45));
      g += txt(m[0], m[1] + 4, String(i + 1));
    });
    var arc = [];
    for (var j = 0; j <= 40; j++) arc.push(map(pt(A * j / 40, R)));
    g += '<path class="s-axis" d="' + chemin(arc) + '"/>';
    return svg('0 0 400 310', g, 'Vue de côté du coude : ' + c.n + ' section(s) entière(s) et deux demies');
  }

  function dessinDebit(c, pieces) {
    var L = c.longueurDebit, W = largeurDessin(), H = 120, k = (W - 40) / L;
    var g = '', pa = 0, pb = 0, finA = -99, finB = -99;
    pieces.forEach(function (p, i) {
      var q = [[20 + pa * k, 30], [20 + p.A * k, 30], [20 + p.B * k, 30 + H], [20 + pb * k, 30 + H]];
      g += '<path class="' + (i % 2 ? 's-wool2' : 's-wool') + '" d="' + chemin(q, true) + '"/>';
      g += txt(20 + (pa + p.A + pb + p.B) / 4 * k, 30 + H / 2 + 4, pieces.length * 80 > W ? String(i + 1) : (p.entiere ? 'Section ' : 'Demi ') + (i + 1));
      if (i < pieces.length - 1) {
        /* repères omis s'ils se chevauchent : le tableau les donne tous */
        if (20 + p.A * k - finA > 46) { finA = 20 + p.A * k; g += txt(finA, 20, 'A ' + fmt(p.A)); }
        if (20 + p.B * k - finB > 46) { finB = 20 + p.B * k; g += txt(finB, 30 + H + 18, 'B ' + fmt(p.B)); }
      }
      pa = p.A; pb = p.B;
    });
    g += txt(20, 30 + H + 36, '0', 'start', 'm') + txt(W - 20, 30 + H + 36, 'Longueur totale ' + fmt(L), 'end', 'm');
    return svg('0 0 ' + W + ' ' + (H + 72), g, 'Plan de débit sur coquille droite');
  }

  /* Développé à plat d'une pièce PVC de coude : dos au milieu, joint au ventre */
  function formePVC(c, entiere) {
    var N = 72, haut = [], bas = [], net = [], W = c.dev;
    for (var i = 0; i <= N; i++) {
      var th = -180 + 360 * i / N, h = C.hauteurSecteur(c, th, entiere), x = W * i / N;
      var yb = entiere ? -h / 2 : 0, yh = entiere ? h / 2 : h;
      bas.push([x, yb]); net.push([x, yh]); haut.push([x, yh + S.recouv]);
    }
    var fin = W + S.recouv;
    haut.push([fin, haut[N][1]]);
    bas.push([fin, bas[N][1]]);
    var contour = haut.concat(bas.slice().reverse());
    var ymin = Math.min.apply(null, contour.map(function (p) { return p[1]; }));
    var ymax = Math.max.apply(null, contour.map(function (p) { return p[1]; }));
    var norm = function (p) { return [p[0], ymax - p[1]]; };
    return {
      titre: (entiere ? 'PVC - section entiere' : 'PVC - demi-section') + ' - coude ' + fmt(c.angle) + ' deg - D ' + fmt(c.D, 1),
      w: fin, h: ymax - ymin, contour: contour.map(norm),
      pointilles: [net.map(norm), [[W, bas[N][1]], [W, net[N][1]]].map(norm)],
      reperes: [{ x: W / 2, t: 'dos' }, { x: 0, t: 'ventre' }, { x: W, t: 'ventre' }]
    };
  }

  /* Gabarit de coupe à enrouler sur la coquille */
  function formeCoquille(c, entiere) {
    var N = 72, haut = [], bas = [], W = c.dev;
    var hmax = C.hauteurSecteur(c, 0, entiere);
    for (var i = 0; i <= N; i++) {
      var th = -180 + 360 * i / N, h = C.hauteurSecteur(c, th, entiere), x = W * i / N;
      haut.push([x, entiere ? hmax / 2 - h / 2 : hmax - h]);
      bas.push([x, entiere ? hmax / 2 + h / 2 : hmax]);
    }
    return {
      titre: (entiere ? 'Coquille - section entiere' : 'Coquille - demi-section') + ' - coude ' + fmt(c.angle) + ' deg - D ' + fmt(c.D, 1),
      w: W, h: hmax, contour: haut.concat(bas.reverse()), pointilles: [],
      reperes: [{ x: W / 2, t: 'dos' }, { x: 0, t: 'ventre' }, { x: W, t: 'ventre' }]
    };
  }

  function dessinPlat(f, label, cotes, largeur) {
    var W = largeur || largeurDessin();
    var k = Math.min((W - 60) / f.w, 220 / Math.max(f.h, 1)), ox = (W - f.w * k) / 2, oy = 26;
    var map = function (p) { return [ox + p[0] * k, oy + p[1] * k]; };
    var g = '<path class="s-sheet" d="' + chemin(f.contour.map(map), true) + '"/>';
    f.pointilles.forEach(function (l) { g += '<path class="s-dash" d="' + chemin(l.map(map)) + '"/>'; });
    f.reperes.forEach(function (r) { g += txt(ox + r.x * k, 16, r.t, 'middle', 'm'); });
    g += txt(W / 2, oy + f.h * k + 20, cotes || ('Largeur ' + fmt(f.w) + ' mm  ·  hauteur hors tout ' + fmt(f.h) + ' mm'));
    return svg('0 0 ' + W + ' ' + (f.h * k + 56).toFixed(0), g, label);
  }

  var gabarits = {};
  function boutons(id) {
    return '<div class="actions"><button type="button" class="btn primary" data-print="' + id + '">Imprimer le gabarit 1:1</button><button type="button" class="btn" data-svg="' + id + '">Télécharger en SVG</button></div>';
  }

  function rendreCoude() {
    var out = $('out-coude');
    if (!(S.rayon > 0 && S.angle >= 5 && S.angle <= 180)) { out.innerHTML = '<div class="warn">Indiquez un angle entre 5 et 180° et un rayon positif.</div>'; return; }
    var c = C.coude({ dInt: S.coq, e: S.e, angle: S.angle, sections: S.sections, R: S.rayon });
    var html = '';
    if (c.ventreNegatif) {
      var Rm = Math.ceil(C.rayonPourVentre({ dInt: S.coq, e: S.e, angle: S.angle, sections: S.sections }, 5));
      html += '<div class="warn" role="alert"><b>Les coupes se croisent à l’intérieur du coude.</b> L’isolant (rayon ' + fmt(c.r, 1) + ' mm) est plus gros que le rayon du coude (' + fmt(c.R, 1) + ' mm). Le ventre est ramené à 0 : taillez en pointe et ajustez à l’intérieur. Sinon, tracez avec un rayon plus grand et contrôlez l’ajustement sur le tube.<br><button type="button" class="btn" data-rayon="' + Rm + '">Tracer avec un rayon de ' + fmt(Rm) + ' mm (ventre ≈ 5 mm)</button></div>';
    }
    html += '<div class="big">' +
      stat('Angle de coupe', num('c-b', c.beta, 2), '°', 'par rapport à la coupe d’équerre', true) +
      stat('Pièces', String(c.n + 2), '', c.n + ' entière' + (c.n > 1 ? 's' : '') + ' + 2 demies, ' + c.joints + ' joint' + (c.joints > 1 ? 's' : '')) +
      stat('Ø fini isolé', num('c-D', c.D, 1), 'mm', 'développé ' + fmt(c.dev) + ' mm') +
      (c.ventreNegatif ? '' : stat('Coquille consommée', num('c-L', c.longueurDebit), 'mm', 'par coude, pièces tête-bêche')) +
      '</div>';

    var carte = function (titre, qte, m, cle) {
      return '<div class="card"><div class="piece"><h2>' + titre + '</h2><span class="tag">× ' + qte + '</span></div><div class="cotes">' +
        ['dos', 'axe', 'ventre'].map(function (n) {
          return '<div><span>' + n.charAt(0).toUpperCase() + n.slice(1) + '</span><b>' + num(cle + n, Math.max(0, m[n])) + '</b></div>';
        }).join('') + '</div></div>';
    };
    html += '<div class="grid">' + (c.n > 0 ? carte('Coquille : section entière', c.n, c.entiere, 'ce-') : '') + carte('Coquille : demi-section', 2, c.demi, 'cd-') + '</div>';
    html += '<div class="grid"><figure class="card draw"><h2>Le coude vu de côté</h2>' + dessinCoude(c) + '<figcaption>Cotes dos / ventre en mm, prises sur l’extérieur de l’isolant.</figcaption></figure>';

    var angles = [0, 30, 60, 90, 120, 150, 180];
    html += '<div class="card"><h2>Points de traçage autour de la coquille</h2>' +
      table(['Depuis le dos', 'Sur le pourtour', 'Demie', 'Entière'], angles.map(function (a) {
        return [a + '°' + (a === 0 ? ' (dos)' : a === 180 ? ' (ventre)' : ''), fmt(c.dev * a / 360), fmt(C.hauteurSecteur(c, a, false)), c.n ? '<b>' + fmt(C.hauteurSecteur(c, a, true)) + '</b>' : '–'];
      })) + '<p class="note">Reportez chaque distance à gauche et à droite du dos, puis la longueur sur la génératrice. Reliez les points à la règle souple.</p></div></div>';

    if (!c.ventreNegatif) {
      var p = C.debit(c);
      html += '<div class="grid"><figure class="card draw full"><h2>Débit sur une coquille droite</h2>' + dessinDebit(c, p) +
        '<figcaption>Tracez deux génératrices opposées (A dessus, B dessous). Depuis un bout d’équerre, reportez les repères (cotes cumulées), joignez A à B, coupez, puis tournez d’un demi-tour une pièce sur deux. Prévoyez l’épaisseur du trait de scie ou de lame si nécessaire.</figcaption>' +
        table(['Coupe', 'Repère A', 'Repère B'], p.slice(0, -1).map(function (x, i) { return ['Coupe ' + (i + 1), fmt(x.A), fmt(x.B)]; }).concat([['Fin (équerre)', fmt(c.longueurDebit), fmt(c.longueurDebit)]])) +
        '</figure></div>';
    }

    gabarits = {};
    html += '<div class="head"><h1>Revêtement PVC du coude</h1><p>Pièces à plat : dos au milieu, joint au ventre, ' + fmt(S.recouv) + ' mm de recouvrement inclus.</p></div><div class="grid">';
    (c.n > 0 ? [true, false] : [false]).forEach(function (ent) {
      var id = ent ? 'pvc-e' : 'pvc-d', idc = ent ? 'coq-e' : 'coq-d';
      var f = formePVC(c, ent);
      gabarits[id] = f;
      gabarits[idc] = formeCoquille(c, ent);
      var hd = C.hauteurSecteur(c, 0, ent), hv = C.hauteurSecteur(c, 180, ent);
      html += '<figure class="card draw full"><div class="piece"><h2>PVC : ' + (ent ? 'section entière' : 'demi-section') + '</h2><span class="tag">× ' + (ent ? c.n : 2) + '</span></div>' +
        dessinPlat(f, 'Développé PVC') +
        '<div class="cotes"><div><span>Largeur à couper</span><b>' + num(id + 'w', f.w) + '</b></div><div><span>Au dos (net + recouvr.)</span><b>' + num(id + 'd', hd + S.recouv) + '</b></div><div><span>Au ventre (net + recouvr.)</span><b>' + num(id + 'v', hv + S.recouv) + '</b></div></div>' +
        '<figcaption>Trait plein : coupe. Pointillés : limites du recouvrement' + (ent ? ' (bord courbe et joint longitudinal).' : ' ; le bord droit rejoint la virole de la partie droite, qui vient le recouvrir.') + '</figcaption>' +
        boutons(id) + '</figure>';
    });
    html += '</div><div class="card" style="margin-top:16px"><h2>Gabarits de coupe à enrouler sur la coquille</h2><p class="note">Imprimez à 100 % (taille réelle), vérifiez la règle de 100 mm, assemblez les feuilles puis enroulez autour de la coquille.</p><div class="actions">' +
      (c.n > 0 ? '<button type="button" class="btn" data-print="coq-e">Imprimer : section entière</button>' : '') +
      '<button type="button" class="btn" data-print="coq-d">Imprimer : demi-section</button></div></div>';
    out.innerHTML = html;
  }

  /* ---------- piquage ---------- */
  /* pvc = true : trait plein = coupe du PVC (collerette comprise), pointillés = appui et recouvrement.
     pvc = false : gabarit de la coquille, coupe ajustée sans surlongueur. */
  function formePiquage(p, pvc) {
    var rc = pvc ? S.recouv : 0;
    var appui = p.courbe.map(function (q) { return [q.s, q.y]; });
    var coupe = appui.map(function (q) { return [q[0], q[1] + rc]; });
    var base = -Math.max(40, S.recouv + 20);
    var fin = p.dev2 + rc, yFin = coupe[coupe.length - 1][1];
    var pts = [[0, base], [fin, base], [fin, yFin]].concat(coupe.slice().reverse());
    var norm = function (q) { return [q[0], q[1] - base]; };
    var pointilles = rc > 0 ? [appui.map(norm), [[p.dev2, base], [p.dev2, yFin]].map(norm)] : [];
    return {
      titre: (pvc ? 'PVC' : 'Coquille') + ' - piquage D ' + fmt(p.D2, 1) + ' sur D ' + fmt(p.D1, 1) + ' a ' + fmt(p.gamma) + ' deg',
      w: fin, h: p.profondeur + rc - base, contour: pts.map(norm), pointilles: pointilles,
      reperes: [{ x: 0, t: '0°' }, { x: p.dev2 / 4, t: '90°' }, { x: p.dev2 / 2, t: '180°' }, { x: p.dev2 * .75, t: '270°' }, { x: p.dev2, t: '360°' }]
    };
  }

  function formeTrou(p) {
    /* la largeur du dessin inclut l'origine (croisement des axes), parfois hors du trou en piquage incliné */
    var x0 = Math.min(0, p.trouXMin), l = p.trouXMax - x0, h = p.trouLargeur;
    var pts = p.trou.map(function (q) { return [q.x - x0, q.s + h / 2]; });
    return {
      titre: 'Trou sur principal D ' + fmt(p.D1, 1) + ' pour piquage D ' + fmt(p.D2, 1),
      w: l, h: h, contour: pts, pointilles: [[[0, h / 2], [l, h / 2]], [[-x0, 0], [-x0, h]]], reperes: []
    };
  }

  function dessinPiquage(p) {
    var g_ = p.gamma * Math.PI / 180, r1 = p.r1, r2 = p.r2;
    var haut = (r1 / Math.sin(g_)) + r2 * 2.2;
    var demiL = Math.max(r1 * 2, (haut / Math.tan(g_)) + r2 * 2);
    var d = [Math.cos(g_), Math.sin(g_)], n = [Math.sin(g_), -Math.cos(g_)];
    var bout = function (side) { return [d[0] * (haut + r2 * .3) + n[0] * side, d[1] * (haut + r2 * .3) + n[1] * side]; };
    /* vue de côté : projection de la courbe d'intersection */
    var courbe = [];
    for (var a = 180; a >= 0; a -= 3) {
      var t = C.distancePiquage(r1, r2, p.gamma, a), s = r2 * Math.cos(a * Math.PI / 180);
      courbe.push([d[0] * t + n[0] * s, d[1] * t + n[1] * s]);
    }
    var branche = courbe.concat([bout(r2), bout(-r2)]);
    var princ = [[-demiL, -r1], [demiL, -r1], [demiL, r1], [-demiL, r1]];
    var tous = branche.concat(princ);
    var xs = tous.map(function (q) { return q[0]; }), ys = tous.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = Math.min(360 / (x1 - x0), 260 / (y1 - y0));
    var map = function (q) { return [20 + (360 - (x1 - x0) * k) / 2 + (q[0] - x0) * k, 20 + (y1 - q[1]) * k]; };
    var g = '<path class="s-wool2" d="' + chemin(princ.map(map), true) + '"/>' +
      '<path class="s-wool" d="' + chemin(branche.map(map), true) + '"/>' +
      '<path class="s-cut" d="' + chemin(courbe.map(map)) + '"/>' +
      '<path class="s-axis" d="' + chemin([[-demiL, 0], [demiL, 0]].map(map)) + '"/>' +
      '<path class="s-axis" d="' + chemin([[0, 0], bout(0)].map(map)) + '"/>';
    var q1 = map([demiL * .92, -r1 * .55]), q2 = map([d[0] * haut, d[1] * haut]);
    g += txt(q1[0], q1[1], 'Ø ' + fmt(p.D1), 'end') + txt(q2[0], q2[1], 'Ø ' + fmt(p.D2));
    return svg('0 0 400 300', g, 'Vue de côté du piquage');
  }

  function rendrePiquage() {
    var out = $('out-piquage');
    if (!(S.gamma >= 25 && S.gamma <= 90 && S.e2 > 0 && S.coq2 > 0)) { out.innerHTML = '<div class="warn">Indiquez un angle entre 25 et 90°, un diamètre et une épaisseur.</div>'; return; }
    var p = C.piquage({ dInt1: S.coq, e1: S.e, dInt2: S.coq2, e2: S.e2, gamma: S.gamma });
    gabarits = {};
    if (!p.possible) {
      out.innerHTML = '<div class="warn" role="alert"><b>Le piquage isolé (Ø ' + fmt(p.D2, 1) + ') est plus gros que le principal (Ø ' + fmt(p.D1, 1) + ').</b> Choisissez en haut de page le plus gros des deux comme tube principal, ou réduisez le piquage.</div>';
      return;
    }
    var f = formePiquage(p, true), t = formeTrou(p);
    gabarits.piq = f; gabarits.piqc = formePiquage(p, false); gabarits.trou = t;
    var html = '<div class="big">' +
      stat('Profondeur de gueule de loup', num('p-p', p.profondeur), 'mm', 'entre la génératrice la plus courte et la plus longue', true) +
      stat('Feuille PVC piquage', num('p-w', p.dev2 + S.recouv), 'mm', 'développé ' + fmt(p.dev2) + ' + recouvrement') +
      stat('Trou : longueur', num('p-tl', p.trouLongueur), 'mm', 'dans l’axe du principal') +
      stat('Trou : largeur développée', num('p-tw', p.trouLargeur), 'mm', 'sur le pourtour du principal') +
      '</div>';
    if (Math.abs(p.D1 - p.D2) < 1) html += '<div class="warn">Diamètres isolés égaux : la gueule de loup devient une coupe en V' + (p.gamma === 90 ? ' à 45°' : '') + '.</div>';
    var angles = [0, 30, 60, 90, 120, 150, 180];
    html += '<div class="grid"><figure class="card draw"><h2>Vue de côté</h2>' + dessinPiquage(p) + '<figcaption>La découpe vient en appui sur l’extérieur de l’isolant principal.</figcaption></figure>' +
      '<div class="card"><h2>Cotes de traçage du piquage</h2>' +
      table(['Génératrice', 'Sur le pourtour', 'À ajouter', 'Depuis le croisement des axes'], angles.map(function (a) {
        return [a + '°', fmt(p.dev2 * a / 360), '<b>' + fmt(p.ordonnee(a)) + '</b>', fmt(C.distancePiquage(p.r1, p.r2, p.gamma, a))];
      })) +
      '<p class="note">0° = génératrice dans l’axe du tube principal' + (p.gamma < 90 ? ', côté angle aigu' : '') + '. Tracez un trait d’équerre à la longueur de la génératrice la plus courte, puis ajoutez la cote « À ajouter » vers l’appui. L’autre moitié (180° à 360°) est symétrique.</p></div></div>';
    html += '<div class="grid"><figure class="card draw full"><h2>Gabarit PVC du piquage</h2>' +
      dessinPlat(f, 'Développé PVC du piquage', 'Largeur ' + fmt(f.w) + ' mm  ·  profondeur ' + fmt(p.profondeur) + ' mm') +
      '<figcaption>Trait plein : coupe du PVC.' + (S.recouv > 0 ? ' Pointillé courbe : appui sur le principal ; la bande de ' + fmt(S.recouv) + ' mm en dessous se crante et se rabat. Pointillé vertical : recouvrement longitudinal.' : '') + ' Le haut du gabarit est une réserve de longueur à adapter. Coquille : coupez en suivant l’arrondi du principal à travers l’épaisseur.</figcaption>' +
      '<div class="actions"><button type="button" class="btn primary" data-print="piq">Imprimer le gabarit PVC 1:1</button><button type="button" class="btn" data-print="piqc">Imprimer le gabarit coquille</button><button type="button" class="btn" data-svg="piq">Télécharger en SVG</button></div></figure>';
    var trouAngles = [0, 30, 60, 90, 120, 150, 180];
    html += '<figure class="card draw"><h2>Trou dans le principal</h2>' + dessinPlat(t, 'Développé du trou', fmt(p.trouLongueur) + ' × ' + fmt(p.trouLargeur) + ' mm', 340) +
      '<figcaption>Les traits pointillés marquent la génératrice et l’axe du piquage.</figcaption>' + boutons('trou') + '</figure>' +
      '<div class="card"><h2>Points du trou</h2>' + table(['Point', 'Le long de l’axe', 'De part et d’autre'], trouAngles.map(function (a) {
        var q = C.pointTrou(p.r1, p.r2, p.gamma, a);
        return [a + '°', fmt(q.x), '± ' + fmt(Math.abs(q.s))];
      })) + '<p class="note">Origine : le croisement des deux axes, reporté sur la génératrice du principal. Valeurs positives vers le côté où penche le piquage.</p></div></div>';
    out.innerHTML = alerteCoquille(S.coq2, S.tube2 === 'libre' ? S.dLibre2 : tubeDe(S.tube2).d, 'piquage') + html;
  }

  /* ---------- gabarits 1:1 ---------- */
  function svgReel(f, vx, vy, vw, vh, extra) {
    var m = 0.35;
    var corps = '<path d="' + chemin(f.contour, true) + '" fill="none" stroke="#000" stroke-width="' + m + '"/>';
    f.pointilles.forEach(function (l) { corps += '<path d="' + chemin(l) + '" fill="none" stroke="#000" stroke-width="' + m + '" stroke-dasharray="3 2"/>'; });
    f.reperes.forEach(function (r) {
      corps += '<path d="M' + r.x + ' 0V' + f.h + '" stroke="#999" stroke-width="0.2" stroke-dasharray="1 2" fill="none"/>' +
        '<text x="' + r.x + '" y="-2" font-size="4" text-anchor="middle" font-family="sans-serif">' + r.t + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + vw + 'mm" height="' + vh + 'mm" viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + vh + '">' + corps + (extra || '') + '</svg>';
  }

  function imprimer(id) {
    var f = gabarits[id];
    if (!f) return;
    var PW = 188, PH = 240, REC = 10, MG = 8;
    var W = f.w + 2 * MG, H = f.h + 2 * MG;
    var cols = Math.max(1, Math.ceil((W - REC) / (PW - REC))), ligs = Math.max(1, Math.ceil((H - REC) / (PH - REC)));
    var pages = '';
    for (var l = 0; l < ligs; l++) {
      for (var c = 0; c < cols; c++) {
        var vx = -MG + c * (PW - REC), vy = -MG + l * (PH - REC);
        var cadre = '<rect x="' + vx + '" y="' + vy + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="#777" stroke-width="0.2"/>' +
          '<path d="M' + (vx + PW - REC) + ' ' + vy + 'v' + PH + 'M' + vx + ' ' + (vy + PH - REC) + 'h' + PW + '" fill="none" stroke="#bbb" stroke-width="0.2" stroke-dasharray="2 2"/>';
        pages += '<div class="page"><svg xmlns="http://www.w3.org/2000/svg" width="188mm" height="22mm" viewBox="0 0 188 22" font-family="sans-serif" font-size="3.6">' +
          '<text x="0" y="5">CaloCoupe - ' + f.titre + '</text><text x="0" y="11">Feuille ligne ' + (l + 1) + '/' + ligs + ', colonne ' + (c + 1) + '/' + cols + ' - recouvrir 10 mm (trait gris)</text>' +
          '<path d="M0 17h100M0 14.5v5M100 14.5v5" stroke="#000" stroke-width="0.35" fill="none"/><text x="104" y="18.5">100 mm : a verifier au metre</text></svg>' +
          svgReel(f, vx, vy, PW, PH, cadre) + '</div>';
      }
    }
    if (ligs * cols > 12 && !window.confirm('Ce gabarit demande ' + (ligs * cols) + ' feuilles A4. Continuer ?')) return;
    $('print').innerHTML = pages;
    document.body.classList.add('gabarit');
    window.print();
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('gabarit'); });

  function telecharger(id) {
    var f = gabarits[id];
    if (!f) return;
    var blob = new Blob([svgReel(f, -8, -8, +(f.w + 16).toFixed(2), +(f.h + 16).toFixed(2))], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gabarit-' + id + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- rendu & événements ---------- */
  var RENDUS = { droit: rendreDroit, coude: rendreCoude, piquage: rendrePiquage, memo: function () {} };

  function presser(zone, valeur) {
    $(zone).querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.v === +valeur)); });
  }

  function synchroniser(source) {
    var champs = { dLibre: 'dLibre', e: 'e', recouv: 'recouv', coq: 'coq', longueur: 'longueur', lcoq: 'lcoq', largeur: 'largeur', angle: 'angle', rayon: 'rayon', dLibre2: 'dLibre2', coq2: 'coq2', e2: 'e2', gamma: 'gamma' };
    Object.keys(champs).forEach(function (id) { if ($(id) !== source) $(id).value = S[champs[id]]; });
    $('tube').value = S.tube; $('tube2').value = S.tube2;
    $('fieldLibre').hidden = S.tube !== 'libre';
    $('fieldLibre2').hidden = S.tube2 !== 'libre';
    presser('chipsE', S.e); presser('chipsC', S.coq); presser('chipsE2', S.e2); presser('chipsC2', S.coq2);
    presser('segAngle', S.angle); presser('segSec', S.sections); presser('segGamma', S.gamma);
    recaps();
    $('rayonAuto').hidden = S.rayonAuto || S.tube === 'libre';
  }

  function rendre() {
    var onglet = RENDUS[S.tab] ? S.tab : 'droit';
    $('base').hidden = onglet === 'memo';
    var valide = S.coq > 0 && S.e > 0 && S.recouv >= 0;
    if (valide) { resume(); RENDUS[onglet](); animer($('p-' + onglet)); }
    else { $('summary').innerHTML = '<div><span>Saisie incomplète</span><b>Indiquez le diamètre et l’épaisseur.</b></div>'; var o = $('out-' + onglet); if (o) o.innerHTML = ''; }
  }

  function maj(source) {
    if (S.rayonAuto && S.tube !== 'libre') S.rayon = tubeDe(S.tube).r;
    synchroniser(source); rendre(); sauver();
  }

  function placerPill() {
    var b = document.querySelector('.tabs [aria-selected="true"]'), pill = document.querySelector('.pill');
    if (b) { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = 'translateX(' + b.offsetLeft + 'px)'; }
  }

  function onglet(nom, defiler) {
    if (!RENDUS[nom]) nom = 'droit';
    S.tab = nom;
    document.querySelectorAll('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === nom)); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'p-' + nom); });
    placerPill(); maj();
    if (location.hash !== '#' + nom) history.replaceState(null, '', '#' + nom);
    if (defiler) window.scrollTo({ top: 0 });
  }

  function init() {
    var options = C.TUBES.map(function (t) { return '<option value="' + t.dn + '">DN ' + t.dn + ' · ' + t.pouce + ' · Ø ' + fmt(t.d, 1) + '</option>'; }).join('') + '<option value="libre">Autre diamètre…</option>';
    $('tube').innerHTML = options; $('tube2').innerHTML = options;
    var boutonsDe = function (zone, valeurs, suffixe) {
      $(zone).innerHTML = valeurs.map(function (v) { return '<button type="button" data-v="' + v + '">' + v + (suffixe || '') + '</button>'; }).join('');
    };
    boutonsDe('chipsE', EPAISSEURS); boutonsDe('chipsE2', EPAISSEURS);
    boutonsDe('chipsC', COQUILLES); boutonsDe('chipsC2', COQUILLES);
    boutonsDe('segAngle', [30, 45, 60, 90], '°');
    boutonsDe('segSec', [0, 1, 2, 3, 4, 5]);
    boutonsDe('segGamma', [45, 60, 90], '°');

    var choisir = function (zone, cle) {
      $(zone).addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        S[cle] = +b.dataset.v; maj();
      });
    };
    choisir('chipsC', 'coq'); choisir('chipsE2', 'e2'); choisir('chipsC2', 'coq2');
    choisir('chipsE', 'e'); choisir('segAngle', 'angle'); choisir('segSec', 'sections'); choisir('segGamma', 'gamma');

    ['dLibre', 'e', 'recouv', 'coq', 'longueur', 'lcoq', 'largeur', 'angle', 'rayon', 'dLibre2', 'coq2', 'e2', 'gamma'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        var v = parseFloat(this.value);
        S[id] = isFinite(v) ? v : 0;
        if (id === 'rayon') S.rayonAuto = false;
        if (id === 'dLibre') S.coq = S.dLibre;
        if (id === 'dLibre2') S.coq2 = S.dLibre2;
        maj(this);
      });
    });
    $('tube').addEventListener('change', function () {
      if (this.value === 'libre') { S.tube = 'libre'; S.rayonAuto = false; S.coq = S.dLibre; }
      else { S.tube = +this.value; S.coq = tubeDe(S.tube).coq; S.rayonAuto = true; }
      maj();
    });
    $('tube2').addEventListener('change', function () {
      if (this.value === 'libre') { S.tube2 = 'libre'; S.coq2 = S.dLibre2; }
      else { S.tube2 = +this.value; S.coq2 = tubeDe(S.tube2).coq; }
      maj();
    });
    $('rayonAuto').addEventListener('click', function () { S.rayonAuto = true; maj(); });

    document.querySelector('.tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (b) onglet(b.dataset.tab, true);
    });
    document.querySelector('main').addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-print],[data-svg],[data-rayon],tr[data-e]');
      if (!el) return;
      if (el.dataset.print) imprimer(el.dataset.print);
      else if (el.dataset.svg) telecharger(el.dataset.svg);
      else if (el.dataset.rayon) { S.rayon = +el.dataset.rayon; S.rayonAuto = false; maj(); }
      else { S.e = +el.dataset.e; maj(); }
    });
    document.querySelector('main').addEventListener('keydown', function (ev) {
      var tr = ev.target.closest('tr[data-e]');
      if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); S.e = +tr.dataset.e; maj(); }
    });

    var sombre = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var appliquer = function () { document.documentElement.dataset.theme = S.theme || (sombre ? 'dark' : 'light'); };
    appliquer();
    $('theme').addEventListener('click', function () {
      S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; appliquer(); sauver();
    });

    window.addEventListener('resize', placerPill);
    ETROIT.addEventListener('change', function () { rendre(); });
    window.addEventListener('hashchange', function () { onglet(location.hash.slice(1), true); });
    onglet(location.hash.slice(1) || S.tab);
  }

  init();
})();
