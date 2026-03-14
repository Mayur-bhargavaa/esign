# Stitchbyte eSign MVP (MongoDB)

Lightweight e-signature system for offer letters with an admin upload flow and candidate signing link flow.

Admin selects multiple signature locations directly on the PDF preview before sending the secure link.

## Tech Stack

- Frontend: Next.js (React + TypeScript + TailwindCSS)
- Backend: Node.js + Express
- PDF: `pdf-lib`
- Signature capture: `signature_pad`
- Uploads: `multer`
- Database: MongoDB (`mongoose`)
- Email: `nodemailer`

## Project Structure

- `server/app.js`
- `server/routes/upload.js`
- `server/routes/sign.js`
- `server/routes/document.js`
- `server/upload.js`
- `server/services/pdfService.js`
- `server/services/emailService.js`
- `server/models/Document.js`
- `server/models/Signature.js`
- `server/storage/templates/`
- `server/storage/signed/`
- `client/pages/index.tsx`
- `client/pages/sign/[token].tsx`
- `client/components/SignatureCanvas.tsx`

## MongoDB Collections

### documents

- `candidate_email`
- `token` (unique)
- `template_path`
- `status` (`pending` | `signed`)
- `signature_fields` (array of coordinate markers selected by admin)
- `created_at`
- `expires_at`

### signatures

- `token`
- `name`
- `ip_address`
- `signed_at`
- `user_agent`
- `pdf_path`

## Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Configure values in `.env`:

- `MONGODB_URI` (example: `mongodb://127.0.0.1:27017/stitchbyte_esign`)
- `APP_BASE_URL` (`https://esign.stitchbyte.in`)
- `NEXT_PUBLIC_API_BASE_URL` (`https://esign.stitchbyte.in`)
- SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) for real email sending
- `ADMIN_EMAIL` for receiving the signed PDF attachment

3. Install dependencies:

```bash
npm install
```

4. Start both backend and frontend:

```bash
npm run dev
```

- Frontend: `https://esign.stitchbyte.in`
- Backend: `https://esign.stitchbyte.in`

## API Endpoints

- `POST /api/upload`
  - `multipart/form-data`
  - fields: `candidateEmail`, `file` (PDF), `signatureFields` (JSON array)
  - creates token, stores document, sends signing email

- `GET /api/document/:token`
  - validates token + expiry
  - returns status + preview URL + signature field coordinates

- `GET /api/document/:token/preview`
  - streams original template PDF for preview

- `POST /api/sign`
  - body: `{ token, name, signatureDataUrl, approved }`
  - validates token and single-use status
  - requires user approval checkbox
  - captures IP, timestamp, user agent
  - embeds signature + name + date at all selected signature locations
  - saves signed PDF to `server/storage/signed/`
  - updates status to `signed`
  - writes signature audit record
  - emails signed PDF to admin and candidate

- `GET /api/audit`
  - returns all documents with audit details
  - includes: signed by, signed at, IP, user agent, and signed locations

- `GET /api/audit/:token`
  - returns one document audit trail by token
  - includes exact signature locations used for that signing event

## Notes

- Signing links expire in 48 hours.
- Signing links are single-use (`status = signed` blocks re-sign).
- IP logic: `x-forwarded-for` fallback to `req.socket.remoteAddress`.
- If SMTP is not configured, Nodemailer uses JSON transport (no real email delivery).
# esign
