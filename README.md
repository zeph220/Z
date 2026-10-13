# INVISIBLES

Site pédagogique sur la cybersécurité.

## Accès administrateur

L'accès utilise Firebase Authentication avec un identifiant utilisateur et le mot de passe existant. Le mot de passe n'est pas présent dans le HTML, le JavaScript ou les données Realtime Database.

Le compte originel `zeph220` est le seul compte autorisé à nommer d'autres administrateurs suprêmes. Les autres demandes passent par la validation d'un administrateur suprême avant l'accès aux statistiques.

## Configuration Firebase

1. Activer le fournisseur **Email/Password** dans Firebase Authentication.
2. Créer ou inscrire le compte `zeph220` avec le mot de passe déjà utilisé par le site.
3. Les créations d'autres usernames vérifient ce même mot de passe auprès du compte racine. Un mot de passe incorrect ne crée aucune demande.
4. Déployer les règles Realtime Database :

   ```bash
   firebase deploy --only database
   ```

La configuration publique Firebase peut rester dans `firebase-config.js`; elle ne contient pas de secret d'authentification. La sécurité repose sur Firebase Authentication et `database.rules.json`, pas sur le masquage de l'URL de la console.

La page historique `admin.html` a été supprimée. La console protégée est `admin-console.html`, mais son contenu et les données restent inaccessibles sans une session Firebase disposant du rôle adéquat.
