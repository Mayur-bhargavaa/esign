const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = String(process.env.SMTP_SECURE || 'false') === 'true';

const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
    })
  : nodemailer.createTransport({ jsonTransport: true });

async function sendSigningLinkEmail({ to, signingLink }) {
  await transporter.sendMail({
    from: process.env.SMTP_USER || 'no-reply@esign.local',
    to,
    subject: 'Offer Letter Signature Request',
    text: `Please sign your offer letter using the secure link below.\n\n${signingLink}`
  });
}

async function sendSignedPdfToAdmin({ token, signedPdfPath }) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return;
  }

  await sendSignedPdfToRecipient({
    token,
    signedPdfPath,
    recipient: adminEmail,
    subject: `Signed Offer Letter Received (${token})`,
    text: 'A candidate has signed an offer letter. The signed PDF is attached.'
  });
}

async function sendSignedPdfToRecipient({ token, signedPdfPath, recipient, subject, text }) {
  if (!recipient) {
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_USER || 'no-reply@esign.local',
    to: recipient,
    subject,
    text,
    attachments: [
      {
        filename: `signed-offer-${token}.pdf`,
        path: signedPdfPath
      }
    ]
  });
}

module.exports = {
  sendSigningLinkEmail,
  sendSignedPdfToAdmin,
  sendSignedPdfToRecipient
};
