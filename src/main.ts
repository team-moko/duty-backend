import { createApp } from './server';

const rawPort = process.env.PORT ?? '8000';
const PORT = Number.parseInt(rawPort, 10);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[duty-backend] Invalid PORT="${rawPort}" — must be 1-65535.`);
  process.exit(1);
}

const app = createApp();
app.listen(PORT, () => {
  console.log(`[duty-backend] listening on http://localhost:${PORT}`);
});
