/**
 * Default HTML content for each legal/landing key, derived from the existing
 * i18n strings. Used as the initial body served to the admin editor and to
 * the public pages until an admin saves a custom version.
 *
 * Once an admin saves a key via PATCH /admin/legal/:key, the database row
 * takes precedence; defaults are only consulted when the row is absent.
 */
import type { LegalContentKey } from '@/validators/legal-content';

type SupportedLocale = 'fr' | 'en';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function articles(intro: string, articleCount: number, articleResolver: (n: number) => { title: string; body: string }): string {
  const introBlock = `<p>${escapeHtml(intro)}</p>`;
  const list = Array.from({ length: articleCount }, (_, i) => {
    const a = articleResolver(i + 1);
    return `<h2>Art. ${i + 1} — ${escapeHtml(a.title)}</h2><p>${escapeHtml(a.body)}</p>`;
  }).join('\n');
  return `${introBlock}\n${list}`;
}

function qa(pairs: Array<{ q: string; a: string }>): string {
  return pairs.map((p) => `<h3>${escapeHtml(p.q)}</h3><p>${escapeHtml(p.a)}</p>`).join('\n');
}

// ─── FR defaults ─────────────────────────────────────────────────────────────

const FR_DEFAULTS: Record<LegalContentKey, string> = {
  cgu: articles(
    'Les présentes conditions générales d\'utilisation (CGU) régissent l\'accès et l\'utilisation de la plateforme Hurryline. En utilisant nos services, vous acceptez sans réserve les présentes conditions.',
    10,
    (n) => ([
      { title: 'Objet', body: 'Hurryline est une plateforme de mise en relation entre clients souhaitant réserver un lavage automobile et stations de lavage partenaires. La société exploitante agit en tant qu\'intermédiaire technique.' },
      { title: 'Accès à la plateforme', body: 'L\'accès aux services Hurryline nécessite la création d\'un compte utilisateur. Vous devez être âgé d\'au moins 18 ans et disposer d\'un véhicule immatriculé pour utiliser le service en tant que client.' },
      { title: 'Responsabilités de l\'utilisateur', body: 'Vous vous engagez à fournir des informations exactes lors de l\'inscription, à ne pas utiliser la plateforme à des fins frauduleuses, et à respecter les règlements des stations partenaires lors de votre visite.' },
      { title: 'Réservations et paiements', body: 'Les réservations sont confirmées uniquement après paiement complet. Les prix sont indiqués TTC. Hurryline collecte une commission sur chaque transaction conformément à la grille tarifaire en vigueur.' },
      { title: 'Annulations et remboursements', body: 'Les conditions d\'annulation et de remboursement sont détaillées dans notre Politique d\'annulation, accessible depuis le pied de page. En cas de litige, Hurryline intervient en médiateur.' },
      { title: 'Propriété intellectuelle', body: 'L\'ensemble des contenus présents sur la plateforme (logos, textes, interfaces, code source) est la propriété exclusive de Hurryline ou de ses partenaires et est protégé par les lois sur la propriété intellectuelle.' },
      { title: 'Protection des données personnelles', body: 'Hurryline traite vos données conformément à sa Politique de confidentialité et à la Loi 25 (Québec). Vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données.' },
      { title: 'Limitation de responsabilité', body: 'Hurryline ne peut être tenu responsable des dommages causés lors du lavage par une station partenaire. Chaque station demeure responsable de ses prestations et de son personnel.' },
      { title: 'Modification des CGU', body: 'Hurryline se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés par e-mail au moins 15 jours avant l\'entrée en vigueur des nouvelles conditions.' },
      { title: 'Droit applicable', body: 'Les présentes CGU sont régies par le droit québécois et canadien. Tout litige relève de la compétence exclusive des tribunaux de Montréal, Québec, Canada.' },
    ][n - 1]!),
  ),

  cgu_stations: articles(
    'Les présentes conditions générales d\'utilisation régissent la relation entre Hurryline et les stations de lavage partenaires inscrites sur la plateforme. En activant votre compte station, vous acceptez sans réserve les présentes conditions.',
    10,
    (n) => ([
      { title: 'Objet', body: 'Hurryline met à disposition des stations partenaires un outil de gestion des réservations, un système de paiement intégré et une visibilité sur la plateforme client. La société exploitante agit en tant qu\'intermédiaire technique.' },
      { title: 'Inscription et vérification (KYC)', body: 'L\'accès à l\'espace station est subordonné à la validation d\'un dossier KYC (permis d\'affaires, preuve d\'identité du dirigeant, attestation d\'adresse). Toute fausse déclaration entraîne la résiliation immédiate du compte.' },
      { title: 'Obligations de la station', body: 'La station s\'engage à maintenir à jour ses créneaux de disponibilité, à honorer les réservations confirmées, à respecter les prix affichés sur la plateforme et à traiter les clients avec professionnalisme.' },
      { title: 'Commission et reversement', body: 'Hurryline perçoit une commission sur chaque réservation réalisée via la plateforme. Le taux est défini dans la grille tarifaire en vigueur. Le reversement du solde net s\'effectue chaque semaine via Stripe Connect.' },
      { title: 'Absences et annulations', body: 'Toute annulation de la station après confirmation d\'une réservation entraîne le remboursement intégral du client. Un taux d\'annulation supérieur à 10 % sur un mois glissant peut entraîner une suspension temporaire du compte.' },
      { title: 'Litiges et médiation', body: 'Hurryline intervient en médiateur en cas de litige entre une station et un client. La décision de Hurryline est définitive pour les litiges inférieurs à 500 $ CAD. Au-delà, les parties peuvent saisir les tribunaux compétents.' },
      { title: 'Suspension et résiliation', body: 'Hurryline se réserve le droit de suspendre ou de résilier un compte station en cas de non-respect des présentes CGU, de plaintes répétées, de fraude avérée ou de décision de justice. La station est informée par e-mail avec un préavis de 48 h, sauf en cas d\'urgence.' },
      { title: 'Propriété intellectuelle', body: 'La station autorise Hurryline à utiliser son nom, logo et photos à des fins de promotion sur la plateforme et dans ses communications marketing, dans le respect de la charte graphique de la station.' },
      { title: 'Confidentialité', body: 'La station s\'engage à ne pas divulguer les informations personnelles des clients auxquelles elle a accès via la plateforme à des tiers non autorisés, et à les utiliser uniquement dans le cadre de la prestation de service.' },
      { title: 'Droit applicable', body: 'Les présentes CGU sont régies par le droit québécois et canadien. Tout litige relève de la compétence exclusive des tribunaux de Montréal, Québec, Canada.' },
    ][n - 1]!),
  ),

  politique_confidentialite: articles(
    'La présente politique de confidentialité décrit la façon dont Hurryline collecte, utilise et protège vos données personnelles conformément à la Loi 25 (Québec) et aux lois canadiennes applicables.',
    10,
    (n) => ([
      { title: 'Données collectées', body: 'Nous collectons les informations que vous nous fournissez lors de votre inscription (nom, adresse e-mail, numéro de téléphone), ainsi que les données de navigation générées par l\'utilisation de la plateforme (pages consultées, actions effectuées, données techniques de votre appareil).' },
      { title: 'Finalités du traitement', body: 'Vos données sont utilisées pour créer et gérer votre compte, traiter vos réservations et paiements, vous envoyer des notifications relatives à vos activités, améliorer nos services et assurer la sécurité de la plateforme.' },
      { title: 'Partage des données', body: 'Vos données personnelles ne sont pas vendues à des tiers. Elles peuvent être partagées avec les stations partenaires dans le cadre d\'une réservation confirmée, ainsi qu\'avec nos prestataires techniques (hébergement, paiement) soumis à des obligations de confidentialité strictes.' },
      { title: 'Cookies et traceurs', body: 'Hurryline utilise des cookies essentiels au fonctionnement de la plateforme (authentification, sécurité) et des cookies analytiques anonymes pour mesurer l\'audience. Vous pouvez refuser les cookies non essentiels via les paramètres de votre navigateur.' },
      { title: 'Conservation des données', body: 'Vos données sont conservées le temps nécessaire à l\'exécution du contrat et au respect de nos obligations légales, soit un maximum de 5 ans après la clôture de votre compte, sauf obligation légale contraire.' },
      { title: 'Sécurité', body: 'Nous mettons en œuvre des mesures techniques et organisationnelles appropriées (chiffrement TLS, accès restreints, audits réguliers) pour protéger vos données contre tout accès non autorisé, perte ou divulgation.' },
      { title: 'Vos droits (Loi 25)', body: 'Conformément à la Loi 25 sur la protection des renseignements personnels dans le secteur privé (Québec), vous disposez du droit d\'accès, de rectification, de portabilité et de suppression de vos données. Pour exercer ces droits, contactez-nous à privacy@Hurryline.ca.' },
      { title: 'Transferts hors Québec', body: 'Certains de nos prestataires peuvent traiter des données hors du Québec. Nous effectuons une évaluation des facteurs relatifs à la vie privée (ÉFVP) préalablement à tout transfert et nous assurons d\'un niveau de protection équivalent.' },
      { title: 'Responsable de la protection des données', body: 'Le responsable de la protection des données personnelles au sein de Hurryline est joignable à privacy@Hurryline.ca. Toute demande relative à vos données sera traitée dans un délai de 30 jours.' },
      { title: 'Modifications', body: 'Hurryline se réserve le droit de modifier la présente politique à tout moment. Vous serez informé par e-mail au moins 15 jours avant l\'entrée en vigueur de toute modification substantielle.' },
    ][n - 1]!),
  ),

  politique_annulation: [
    '<p>Hurryline s\'engage à offrir une expérience transparente. Les annulations sont traitées équitablement selon le délai de préavis donné avant le rendez-vous.</p>',
    '<h2>Tableau des remboursements</h2>',
    '<p>Le montant remboursé dépend du délai entre l\'annulation et l\'heure du rendez-vous :</p>',
    '<ul>',
    '<li><strong>Plus de 24 h avant</strong> — 100 % remboursé</li>',
    '<li><strong>Entre 2 h et 24 h</strong> — 50 % remboursé</li>',
    '<li><strong>Moins de 2 h</strong> — Non remboursé</li>',
    '</ul>',
    '<h2>Procédure d\'annulation</h2>',
    '<p>Pour annuler, accédez à votre espace client, sélectionnez la réservation concernée et cliquez sur « Annuler ». Vous recevrez une confirmation par e-mail.</p>',
    '<p>Le remboursement est traité sous 5 à 10 jours ouvrés selon votre institution financière.</p>',
    '<h2>Annulation par la station</h2>',
    '<p>Si une station annule votre rendez-vous, vous êtes remboursé à 100 % et un crédit de compensation peut être offert selon les circonstances.</p>',
    '<h2>No-show</h2>',
    '<p>En cas d\'absence non signalée (no-show), le montant total de la réservation est retenu. Des frais supplémentaires peuvent s\'appliquer si la station a bloqué du temps pour votre passage.</p>',
  ].join('\n'),

  mentions_legales: [
    { title: 'Éditeur du site', body: 'Le site Hurryline.ca est édité par Hurryline inc., société par actions constituée sous les lois du Québec, immatriculée au Registraire des entreprises du Québec. Siège social : Montréal, Québec, Canada. Directeur de la publication : Équipe Hurryline.' },
    { title: 'Hébergement', body: 'Le site est hébergé par Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, États-Unis) et utilise les services cloud de Neon Inc. pour les bases de données et de Cloudinary Inc. pour le stockage des médias.' },
    { title: 'Propriété intellectuelle', body: 'L\'ensemble des éléments constituant le site (textes, graphismes, logiciels, photographies, images, sons, plans, logos) est la propriété exclusive de Hurryline inc. ou fait l\'objet d\'une autorisation d\'utilisation. Toute reproduction, représentation ou diffusion, en tout ou partie, est interdite sans autorisation écrite préalable.' },
    { title: 'Protection des données personnelles', body: 'Hurryline traite vos données personnelles conformément à la Loi 25 sur la protection des renseignements personnels dans le secteur privé (Québec). Pour toute demande, contactez-nous à privacy@Hurryline.ca. Consultez également notre Politique de confidentialité.' },
    { title: 'Cookies', body: 'Le site utilise des cookies essentiels au fonctionnement des services (authentification, sécurité de session) et des cookies analytiques anonymes. Vous pouvez gérer vos préférences via les paramètres de votre navigateur.' },
    { title: 'Contact', body: 'Pour toute question relative aux présentes mentions légales, vous pouvez nous contacter à l\'adresse legal@Hurryline.ca ou via notre formulaire de contact.' },
  ].map((a, i) => `<h2>Art. ${i + 1} — ${escapeHtml(a.title)}</h2><p>${escapeHtml(a.body)}</p>`).join('\n'),

  contact: [
    '<p>Une question, une réclamation ou simplement envie de nous dire bonjour ? Notre équipe vous répond sous 24 h ouvrées.</p>',
    '<h2>Coordonnées</h2>',
    '<ul>',
    '<li><strong>E-mail :</strong> <a href="mailto:support@hurryline.ca">support@hurryline.ca</a></li>',
    '<li><strong>Horaires :</strong> Lun–Ven, 9h–18h (HE)</li>',
    '<li><strong>Siège :</strong> Montréal, Québec, Canada</li>',
    '</ul>',
    '<p>Avant d\'envoyer un message, consultez notre FAQ — vous y trouverez peut-être la réponse immédiatement.</p>',
  ].join('\n'),

  landing_faq: qa([
    { q: 'Comment réserver un lavage ?', a: 'Créez un compte, choisissez une station près de chez vous, sélectionnez un créneau horaire et un forfait, puis confirmez votre réservation. Vous recevrez une confirmation par e-mail.' },
    { q: 'Puis-je annuler ma réservation ?', a: 'Oui, vous pouvez annuler jusqu\'à 2 heures avant le rendez-vous depuis votre espace client. Au-delà de ce délai, des frais d\'annulation peuvent s\'appliquer selon la politique de la station.' },
    { q: 'Comment fonctionne la file d\'attente ?', a: 'Si tous les créneaux d\'une station sont complets, vous pouvez rejoindre la file d\'attente. En cas de désistement, vous serez automatiquement notifié et votre place confirmée.' },
    { q: 'Quels modes de paiement sont acceptés ?', a: 'Nous acceptons les cartes Visa, Mastercard et American Express via notre plateforme sécurisée Stripe. Le paiement s\'effectue au moment de la réservation.' },
    { q: 'Comment devenir station partenaire ?', a: 'Rendez-vous sur la page « Devenez partenaire » et remplissez le formulaire d\'inscription. Notre équipe examine votre dossier sous 48 h ouvrées.' },
    { q: 'Mon véhicule a été endommagé lors du lavage, que faire ?', a: 'Contactez immédiatement le responsable de la station sur place, puis signalez l\'incident depuis votre espace client dans les 24 h. Nous vous accompagnons dans la résolution du litige.' },
  ]),

  landing_how_it_works: [
    '<p>Hurryline rend la réservation d\'un lavage auto aussi simple qu\'un trajet en taxi. Voici comment cela fonctionne.</p>',
    '<h2>Étape 1 — Choisissez votre station</h2>',
    '<p>Parcourez les stations partenaires près de chez vous, comparez les avis, les prix et les disponibilités, puis choisissez celle qui vous convient.</p>',
    '<h2>Étape 2 — Réservez un créneau</h2>',
    '<p>Sélectionnez le format de votre véhicule, le créneau horaire qui vous arrange, et payez en ligne en quelques secondes via Stripe.</p>',
    '<h2>Étape 3 — Arrivez à l\'heure</h2>',
    '<p>Présentez-vous à la station à l\'heure prévue. Le ticket digital vous sert de preuve de réservation. Pas d\'attente, pas de surprise.</p>',
  ].join('\n'),
};

// ─── EN defaults (minimal fallback — kept short; FR is the primary locale) ───
// The FR defaults are also returned for EN if no English copy is provided here.
const EN_DEFAULTS: Partial<Record<LegalContentKey, string>> = {};

/**
 * Returns the default HTML for the given legal key in the requested locale.
 * Falls back to French when no English copy is available.
 */
export function getDefaultLegalContent(key: LegalContentKey, locale: SupportedLocale = 'fr'): string {
  if (locale === 'en' && EN_DEFAULTS[key]) return EN_DEFAULTS[key]!;
  return FR_DEFAULTS[key] ?? '';
}
