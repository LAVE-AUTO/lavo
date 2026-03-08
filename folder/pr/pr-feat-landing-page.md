# [FRONT] Landing page Slowtime — Refonte complete avec 9 sections modulaires

## Branch
`feat/landing-page` → `main`

## Related task
Landing page — Refonte complete de la page d'accueil (inspiration lavo-client.html)

---

## Description

Cette PR remplace l'ancienne page d'accueil (simple statut API) par une **landing page marketing premium** inspiree fidelement du fichier de reference `folder/code_html/lavo-client.html`, adaptee a la marque **Slowtime** et au design system du projet.

Elle comprend :

- 9 sections modulaires independantes, aucune ne depassant 150 lignes.
- Support complet **dark/light mode** via classes Tailwind `dark:`.
- **i18n FR/EN** complet sur toutes les sections.
- **Responsive** mobile / tablet / desktop (navigation mobile via BottomNav existant).
- Animations CSS : fade-in-up entrees, phone mockup flottant, marquee defilant, scroll reveal.
- Police **Playfair Display** ajoutee pour les titres de sections (fidelite au design de reference).

---

## Commits inclus

| Hash | Message |
|---|---|
| `d9e27f5` | feat(landing): rebuild home page as Slowtime landing page |
| `107a78a` | refactor(landing): redesign navbar/footer, add redirect guard, widen layout |

---

## Ce qui a ete fait

### CSS (`src/app/globals.css`)
- Ajout de **Playfair Display** et **DM Mono** dans l'import Google Fonts.
- Variables `--font-playfair` et `--font-dm-mono` dans `@theme`.
- Classes utilitaires : `.font-playfair`, `.font-dm-mono`.
- `@keyframes marquee-scroll` + `.animate-marquee` pour le bandeau defilant.
- Classes contextuelles : `.landing-hero-bg`, `.landing-alt-bg`, `.landing-card` — gestion automatique dark/light.
- `.reveal` + `.reveal.visible` pour les animations de scroll reveal.

### i18n (`messages/fr.json` + `messages/en.json`)
- Namespace `home` entierement remplace par les cles de la landing page.
- 8 sous-namespaces : `hero`, `marquee`, `features`, `steps`, `stations_preview`, `notifications`, `testimonials`, `faq` (CtaSection retire pour v1).
- Nouvelles cles `nav` : `how_it_works`, `reminders`, `faq`, `merchant_pill`.
- Nouvelles cles `footer` : `app_col`, `help_col`, `legal_col` + tous les sous-liens (FR et EN).
- Textes FR et EN complets, prets pour la production.

### Nouveaux composants (`src/components/home/`)

#### `RevealOnScroll.tsx` (client)
- Wrapper `IntersectionObserver` — ajoute `.visible` quand l'element entre dans le viewport.

#### `HeroSection.tsx` (client)
- Grille 52%/48% desktop, colonne unique mobile.
- Eyebrow, titre Playfair avec accent or italic, description, 2 CTA buttons.
- 3 KPIs numeriques (Rajdhani bold).
- Import de `HeroPhoneMockup` pour la colonne droite.

#### `HeroPhoneMockup.tsx` (client)
- Phone frame (264x540px) avec notch, screen content, 2 cartes station.
- 2 bulles flottantes (`animate-float`) avec donnees de reservation.
- `PhoneStationCard` — sous-composant interne.
- Dark/light : fond `#0d1f0f` dark / `#e8e2d4` light sur les bulles.

#### `MarqueeBanner.tsx` (client)
- Bandeau or plein avec 7 items dupliques pour boucle continue (`animate-marquee`).

#### `FeaturesSection.tsx` (client)
- Grille 3 colonnes, 6 cartes avec icone SVG outline, titre, description.
- Cartes dark : `#f5edd6` (creme) / light : `#e8e2d4`.
- Hover : elevation + ombre.

#### `HowItWorksSection.tsx` (client)
- 3 etapes avec numero fantome Playfair, icone SVG, connecteur fleche desktop.
- Fond `landing-alt-bg` (alternatif).

#### `StationsPreviewSection.tsx` (client)
- Grille 2 colonnes : texte + pricing card a gauche, liste de 3 stations a droite.
- `StationRow` — composant interne avec badge statut, rating etoiles, boutons Reserver/Rejoindre.
- Pricing card dark background avec 3 formats vehicule.

#### `NotificationsSection.tsx` (client)
- 4 fonctionnalites listees a gauche avec icones SVG outline.
- Phone mockup de notifications a droite (4 notifications avec actions inlines).

#### `TestimonialsSection.tsx` (client)
- 3 cartes temoignages avec citation en italique, avatar initiale, nom, role.

#### `FaqSection.tsx` (client)
- Grille 2 colonnes de 6 items accordeon (useState toggle).
- Bouton `+` rotatif sur 45deg a l'ouverture.

#### `CtaSection.tsx` (client) — NON INCLUS v1
- Composant cree mais retire de la page pour la v1 (pas de telechargement app).

#### `HomeRedirectGuard.tsx` (client)
- Redirige les utilisateurs authentifies hors de la landing page.
- CLIENT → `/stations`, STATION → `/station/dashboard`, SUPER_ADMIN → `/admin`.

### Layout (`src/components/layout/`)

#### `PublicNavbar.tsx` (client) — refonte complete
- Fond verre sombre `rgba(13,31,15,0.92)` dark / creme light, `backdrop-blur`.
- Logo Playfair Display "Slowtime" en or, `letter-spacing: 5px`.
- Liens ancre : Comment ca marche, Les stations, Rappels, FAQ.
- Actions : pill "Vous etes marchand ?" + Se connecter + S'inscrire (si non auth).
- Suppression de la cloche de notifications.
- Drawer tablette conserve.

#### `PublicFooter.tsx` (serveur) — refonte complete
- Suppression de la bande CTA pre-footer.
- Grille 4 colonnes `2fr 1fr 1fr 1fr` : Brand | Application | Aide | Legal.
- En-tetes colonnes DM Mono, liens en gris avec hover creme, bas de page simplifie.

### Page (`src/app/[locale]/(public)/page.tsx`)
- Transformee en composant serveur avec `generateMetadata` et `setRequestLocale`.
- Inclut `HomeRedirectGuard`, `PublicNavbar`, 8 sections, `PublicFooter`, `BottomNav`.
- Pas de layout intermediaire necessaire.

---

## Architecture des composants

```
page.tsx (server)
  HomeRedirectGuard (client)
  PublicNavbar (client)
  main
    HeroSection (client)
      HeroPhoneMockup (client)
    MarqueeBanner (client)
    FeaturesSection (client)
      RevealOnScroll (client)
    HowItWorksSection (client)
      RevealOnScroll (client)
    StationsPreviewSection (client)
      RevealOnScroll (client)
    NotificationsSection (client)
      RevealOnScroll (client)
    TestimonialsSection (client)
      RevealOnScroll (client)
    FaqSection (client)
      RevealOnScroll (client)
  PublicFooter (server)
  BottomNav (client)
```

---

## Checklist

### Structure
- [x] Page remplacee (`/`) — server component avec generateMetadata
- [x] 8 sections modulaires (CtaSection retire pour v1), aucune > 150 lignes
- [x] Aucun fichier ne depasse les limites de taille
- [x] Composants dans `src/components/home/`
- [x] `HomeRedirectGuard` — redirection CLIENT/STATION/SUPER_ADMIN depuis la home
- [x] Navbar et footer refondes pour correspondre exactement aux fichiers HTML de reference
- [x] Layout elargi : `max-w-[1280px]` pour toutes les sections
- [x] Marquee corrige : `whitespace-nowrap` sur le conteneur pour le ticker continu

### Design fidelite
- [x] Inspiration fidele au fichier `lavo-client.html`
- [x] Branding "Slowtime" (pas "LAVO")
- [x] Palette or `#c8980a`, fond sombre `#0d1f0f`, cartes creme `#f5edd6`
- [x] Police Playfair Display pour les titres
- [x] Rajdhani pour les KPIs et prix
- [x] DM Mono pour les labels eyebrow
- [x] Icones SVG outline (aucun emoji)

### Dark/light mode
- [x] HeroSection : fond `landing-hero-bg` (dark: `#0d1f0f` / light: `#f7f3ec`)
- [x] Sections alternees : `landing-alt-bg`
- [x] Cartes : `dark:bg-[#f5edd6]` / `bg-[#e8e2d4]` (light)
- [x] Textes avec variantes dark: sur tous les elements
- [x] Phone mockup bulles dark/light distinctes

### i18n
- [x] FR complet (fr.json)
- [x] EN complet (en.json)
- [x] useTranslations dans tous les composants client
- [x] generateMetadata avec getTranslations (server)

### Responsive
- [x] Mobile : colonne unique, phone mockup masque, hero adapte
- [x] Desktop : grille 2/3 colonnes, phone mockup visible, bulles flottantes
- [x] BottomNav mobile via composant existant

### Animations
- [x] Hero : animate-fade-in-up avec delays stagges
- [x] Phone mockup : animate-float
- [x] Bulles : animate-float avec delays differents
- [x] Marquee : animate-marquee (CSS pur, 22s linear infinite)
- [x] Scroll reveal : IntersectionObserver via RevealOnScroll
- [x] FAQ : accordion avec rotation du "+"

### Qualite
- [x] Aucun emoji dans le code
- [x] Pas de commentaires decoratifs
- [x] Aucune erreur TypeScript dans les nouveaux fichiers
- [x] Erreurs TS pre-existantes non introduites
