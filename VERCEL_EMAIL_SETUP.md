# Déploiement Vercel - Configuration Email

## 🚀 Setup Vercel

### 1. Variables d'environnement sur Vercel
Va dans **Settings > Environment Variables** sur Vercel et ajoute:

```
SMTP_HOST=mail.lecointefamily.cloud
SMTP_PORT=587
SMTP_USER=noreply@lecointefamily.cloud
SMTP_PASS=MonpassMail69
SENDER_EMAIL=noreply@lecointefamily.cloud
SENDER_NAME=Pétanque Manager
```

### 2. Vérifier le déploiement
- Les fonctions API sont dans `/api/*.ts` 
- Vercel détecte automatiquement et les déploie
- Elles seront accessibles via `https://votreapp.vercel.app/api/sendEmails`

### 3. Test local (dev)
```bash
npm run dev
# Va chercher .env.local
```

### 4. Test avant deploy
```bash
npm run build
# Vérifie que tout compile sans erreur
```

## 📧 Utilisation du bouton

1. Admin > Gestion des Équipes
2. Cliquez sur **"📧 Envoyer identifiants"**
3. Les emails sont envoyés aux équipes qui ont une adresse email
4. Chaque équipe reçoit: son PIN (4 caractères) + lien vers l'app

## ⚙️ Troubleshooting

**"Server configuration error"**
- Vérifier que toutes les env vars sont bien définies sur Vercel

**Emails non reçus**
- Vérifier que l'adresse email du compte OVH est correcte
- Vérifier le mot de passe OVH
- Vérifier que le domaine `mail.lecointefamily.cloud` est accessible
- Si échec, essayer `mail.ovh.net` comme SMTP_HOST

**Erreur SMTP**
- Vérifier le port 587 (TLS) est correct
- Vérifier que le compte OVH est autorisé à envoyer des emails

## 📝 Notes

- `.env.local` ne doit pas être commité (déjà dans `.gitignore`)
- Les variables Vercel sont prioritaires en prod
- Si tu as besoin de tester en local sans .env.local, les emails échoueront (normal)
