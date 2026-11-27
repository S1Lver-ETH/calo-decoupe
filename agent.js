/* Calo Découpe — agent IA facultatif : Claude comprend la dictée et renvoie l'ensemble complet.
   La clé est celle de l'utilisateur, gardée dans son navigateur ; la demande part directement chez Anthropic. */
(function (root) {
  'use strict';
  var SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.14.0/+esm';
  var MODELE = 'claude-opus-5-5';

  var SENS = ['auto', 'haut', 'bas', 'gauche', 'droite', 'avant', 'arriere', 'plat'];
  var FERM = ['auto', 'dos', 'ventre', 'flanc', 'dessus', 'dessous', 'gauche', 'droite', 'avant', 'arriere', 'angle'];
  function objet(props) { return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false }; }
  var T = { type: 'string' }, N = { type: 'number' }, I = { type: 'integer' };
  function choix(liste) { return { type: 'string', enum: liste }; }

  var PIECE = objet({
    type: choix(['droit', 'coude', 'te', 'reduction', 'fond', 'boite']),
    longueur: N, mode: choix(['nette', 'axe']), angle: N, sens: choix(SENS), sections: I, rayon: N,
    fermeture: choix(FERM), fermAngle: N, faces: { type: 'integer', enum: [1, 2] },
    dnB: I, eB: N, longueurB: N, position: N, dnS: I,
    forme: choix(['auto', 'concentrique', 'excentree', 'plat', 'bombe']), plat: choix(['dessus', 'dessous']),
    largeur: N, hauteur: N, note: T
  });
  var SCHEMA = objet({
    resume: T,
    doutes: { type: 'array', items: T },
    ensemble: objet({
      matiere: choix(['alu', 'isoxal', 'inox', 'galva']), coq: N, e: N,
      depart: choix(['haut', 'bas', 'gauche', 'droite', 'avant', 'arriere']), pieces: { type: 'array', items: PIECE }
    })
  });

  var CONSIGNES = [
    'Tu es l’assistant de prise de cotes d’un calorifugeur-tôlier en chaufferie (isolant en laine minérale, habillage PVC ou tôle).',
    'Tu reçois le morceau actuel en JSON et une dictée en français, souvent issue de la reconnaissance vocale (mots déformés possibles : « coup » ou « code » = coude, « coup d’aplat » = coude à plat, « lait » ou « les » = laine, « taule » = tôle, « vendre » = ventre, « sessions » = sections).',
    '« Tuyau en 60-40 » signifie coquille de diamètre intérieur coq = 60 et épaisseur isolant e = 40. « Coude en tête » = coude qui part vers le haut.',
    'Un morceau est souvent une seule pièce ; ne rajoute aucune partie droite qui n’est pas dictée.',
    'Renvoie l’ensemble COMPLET mis à jour : conserve les pièces existantes sans les modifier, sauf si la dictée demande de changer, supprimer ou réordonner.',
    'Les pièces se suivent dans l’ordre de la tuyauterie. Longueurs et diamètres en millimètres.',
    'Directions vues par le calorifugeur face à l’ensemble : haut, bas, gauche, droite, avant (vers lui), arriere (vers le mur). « sens » d’un coude = direction vers laquelle part la tuyauterie après le coude ; « plat » = coude horizontal sans côté précisé ; « auto » si non dit. En montée = haut, en chute = bas.',
    'droit : longueur ; mode « axe » si la cote est prise d’axe à axe. coude : angle, sens, sections = nombre de sections entières (les deux demies sont ajoutées par le calcul), rayon 0 = standard.',
    'te : longueur du tube principal, position de l’axe du piquage depuis le début (0 = milieu), angle 90 ou 45 etc., sens du piquage, dnB, eB (0 = même épaisseur), longueurB depuis l’axe du principal.',
    'reduction : dnS diamètre de sortie, longueur, forme concentrique ou excentree, plat = côté resté plat. fond : forme plat ou bombe. boite (boîte à vanne) : longueur, largeur, hauteur (0 = automatique).',
    'Fermeture (joint longitudinal de l’habillage) : dos = extérieur du coude, ventre = intérieur, flanc = côté, dessus, dessous, gauche, droite, avant, arriere ; « angle » avec fermAngle en degrés (sur un coude, compté depuis le dos) ; « auto » si non dit. faces = 2 quand l’habillage est en deux faces ou deux demi-coques, sinon 1.',
    'Pour un champ non dit ou sans objet : 0 pour les nombres, -1 pour sections, « auto » pour sens, fermeture et forme, « dessous » pour plat, chaîne vide pour note.',
    'N’invente aucune cote. Tout ce qui est ambigu, supposé ou manquant va dans « doutes » en phrases courtes citant le numéro de la pièce. « resume » dit en une phrase ce que tu as ajouté ou changé.'
  ].join('\n');

  var charge = null;
  function sdk() {
    if (!charge) charge = import(SDK).then(function (m) { return m.default || m.Anthropic; }).catch(function (err) { charge = null; throw new Error('Agent IA injoignable : vérifiez le réseau.'); });
    return charge;
  }

  function versRelecture(p) {
    var o = Object.assign({}, p);
    if (o.sens === 'auto') o.sens = '';
    if (o.fermeture === 'auto') o.fermeture = '';
    if (o.forme === 'auto') delete o.forme;
    return o;
  }

  function interpreter(texte, releve, cle) {
    return sdk().then(function (Anthropic) {
      var client = new Anthropic({ apiKey: cle, dangerouslyAllowBrowser: true });
      var actuel = { matiere: releve.matiere, coq: releve.coq, e: releve.e, depart: releve.depart, pieces: releve.pieces };
      return client.beta.messages.create({
        model: MODELE,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: CONSIGNES,
        messages: [{ role: 'user', content: 'Morceau actuel :\n' + JSON.stringify(actuel) + '\n\nDictée :\n' + texte }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } }
      }).then(function (rep) {
        if (rep.stop_reason === 'refusal') throw new Error('L’agent IA a refusé cette demande.');
        if (rep.stop_reason === 'max_tokens') throw new Error('Réponse de l’agent IA coupée : dictez en plusieurs fois.');
        var textes = rep.content.filter(function (b) { return b.type === 'text'; });
        if (!textes.length) throw new Error('Réponse vide de l’agent IA.');
        var lu = JSON.parse(textes[textes.length - 1].text), e = lu.ensemble;
        var base = Object.assign({}, releve, { matiere: e.matiere, depart: e.depart, e: e.e || releve.e, pieces: e.pieces.map(versRelecture) });
        if (e.coq && e.coq !== releve.coq) root.CoteCalc.poserCoquille(base, e.coq);
        return { releve: root.CoteCalc.normaliser(base), faits: lu.resume ? [lu.resume] : [], doutes: lu.doutes || [] };
      }).catch(function (err) {
        if (err instanceof Anthropic.AuthenticationError) throw new Error('Clé API refusée : vérifiez-la.');
        if (err instanceof Anthropic.PermissionDeniedError) throw new Error('Cette clé n’a pas accès au modèle.');
        if (err instanceof Anthropic.RateLimitError) throw new Error('Trop de demandes ou crédit épuisé : réessayez plus tard.');
        if (err instanceof Anthropic.APIConnectionError) throw new Error('Pas de réseau pour joindre l’agent IA.');
        if (err instanceof Anthropic.APIError) throw new Error('Erreur de l’agent IA (' + err.status + ').');
        throw err;
      });
    });
  }

  root.CoteIA = { interpreter: interpreter, schema: SCHEMA, modele: MODELE };
})(this);
