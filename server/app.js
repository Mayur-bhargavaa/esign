require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const next = require('next');
const { connectToMongo } = require('./mongo');

const uploadRoutes = require('./routes/upload');
const signRoutes = require('./routes/sign');
const documentRoutes = require('./routes/document');
const auditRoutes = require('./routes/audit');

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/upload', uploadRoutes);
app.use('/api/sign', signRoutes);
app.use('/api/document', documentRoutes);
app.use('/api/audit', auditRoutes);

async function start() {
  await connectToMongo();

  const isProduction = process.env.NODE_ENV === 'production';
  const isSinglePort = process.env.SINGLE_PORT === 'true' || isProduction;

  if (isSinglePort) {
    const nextApp = next({
      dev: !isProduction,
      dir: path.resolve(__dirname, '../client')
    });
    const handle = nextApp.getRequestHandler();

    await nextApp.prepare();

    // Catch-all route for Next.js (placed after API routes)
    app.all('*', (req, res) => {
      console.log(`[Next.js Router] Handling request: ${req.method} ${req.url}`);
      return handle(req, res);
    });
  }

  // Error handler goes last!
  app.use((error, _req, res, _next) => {
    if (error && error.message) {
      res.status(400).json({ error: error.message });
      return;
    }
  
    res.status(500).json({ error: 'Unexpected server error' });
  });

  app.listen(port, () => {
    const serverUrl = isSinglePort ? 'https://esign.stitchbyte.in' : `http://localhost:${port}`;
    console.log(`Server running on ${serverUrl}`);
    if (isSinglePort) {
      console.log('Serving frontend and backend on a single port for production!');
    }
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
