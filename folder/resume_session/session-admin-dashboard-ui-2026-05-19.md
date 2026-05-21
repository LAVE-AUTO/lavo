# Fiche projet - Dashboard admin

Objectif: rendre le dashboard admin plus lisible, plus premium et plus utile sans toucher au backend. J’ai aligné la page sur la logique du dashboard station: KPI masquables, hiérarchie visuelle plus nette, sidebar plus proche du modèle station, et données toujours branchées sur l’API admin.

Décisions clés: les KPI restent live via `GET /admin/dashboard`, mais ils peuvent être masqués avec une préférence persistée en `localStorage`. Le dashboard montre maintenant plus de signaux métier: revenu, commissions, stations actives, clients, KYC en attente et tickets ouverts. Le sidebar admin a été regroupé en sections collapsibles avec largeur persistée, tooltips en mode réduit, et comportement mobile conservé.

État actuel: commit `172a5c7` réalisé. Les fichiers modifiés ont été validés sur le plan syntaxique, et les JSON de traduction FR/EN parsés avec succès. Le tree Git est propre après le commit. La note PR reste à créer hors commit dans `folder/pr/`.

Prochaines actions: vérifier visuellement le dashboard en 375/768/1280, tester le toggle KPI et le sidebar réduit en light/dark, puis continuer sur la prochaine zone admin si le rendu est validé. Pour économiser les tokens, il vaut mieux ouvrir une nouvelle conversation une fois cette tâche validée et la fiche projet relue.

Règles à garder: frontend uniquement, pas d’emoji, petits commits, i18n obligatoire, ne pas committer `folder/pr/`, et réutiliser les patterns station quand ils existent.