# Zing

Zing est un petit réseau social entre amis. Le site comprend une messagerie privée, une carte d’illustration et un profil.

## Comptes et messages

Les comptes, profils et messages privés utilisent Supabase. La base de données et ses règles d’accès sont décrites dans [`supabase/schema.sql`](supabase/schema.sql). Ce script a été appliqué au projet Supabase `zing-social-eu`, hébergé à Zurich sur l’offre gratuite.

La clé publique Supabase est ajoutée au site par `build.mjs` depuis les variables d’environnement Vercel `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La clé secrète Supabase ne doit jamais être intégrée au site.

La carte et le partage de position restent une illustration : le site ne lit pas la position réelle. Il n’y a pas encore de photos ni de vidéos.

## Publication

Le dépôt GitHub est relié à Vercel. Chaque commit sur `main` déclenche un déploiement. Vercel utilise `npm run build` pour préparer le site statique.
