import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Seulement POST acceptée
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teams, appUrl } = req.body;

  if (!teams || !Array.isArray(teams) || teams.length === 0) {
    return res.status(400).json({ error: 'Teams list is required' });
  }

  // Récupérer credentials depuis variables d'env
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const senderEmail = process.env.SENDER_EMAIL;
  const senderName = process.env.SENDER_NAME || 'Pétanque Manager';

  if (!smtpHost || !smtpUser || !smtpPass || !senderEmail) {
    console.error('Missing SMTP configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Créer le transporter nodemailer
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };

  // Envoyer un email par équipe
  for (const team of teams) {
    if (!team.email || !team.pin || !team.name) {
      results.errors.push(`Team ${team.name || 'unknown'}: missing email or PIN`);
      results.failed++;
      continue;
    }

    try {
      const subject = `Votre code d'accès au tournoi - ${team.name}`;
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Bienvenue au Tournoi de Pétanque!</h2>
          <p>Bonjour <strong>${team.name}</strong>,</p>
          
          <p>Voici votre code d'accès pour suivre vos matchs en direct:</p>
          
          <div style="background: #dbeafe; border: 3px solid #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Code d'accès</p>
            <p style="margin: 10px 0 0 0; font-size: 36px; font-weight: black; color: #1e40af; letter-spacing: 4px;">${team.pin}</p>
          </div>
          
          <p><strong>Joueurs:</strong> ${team.player1 || '-'}${team.player2 ? ` & ${team.player2}` : ''}</p>
          
          <h3 style="color: #1e40af; margin-top: 20px;">Comment accéder?</h3>
          <ol>
            <li>Ouvrez l'app: <a href="${appUrl}" style="color: #3b82f6;">${appUrl}</a></li>
            <li>Entrez votre code: <strong>${team.pin}</strong></li>
            <li>Suivez vos matchs en direct 🎯</li>
          </ol>
          
          <p style="color: #64748b; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            Cet email a été généré automatiquement. Ne pas répondre à cet email.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `${senderName} <${senderEmail}>`,
        to: team.email,
        subject: subject,
        html: htmlContent
      });

      results.sent++;
    } catch (error: any) {
      results.failed++;
      results.errors.push(`${team.name} (${team.email}): ${error.message}`);
    }
  }

  res.status(200).json({
    success: results.failed === 0,
    message: `${results.sent}/${teams.length} emails envoyés`,
    ...results
  });
}
