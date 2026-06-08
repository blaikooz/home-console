import type { VercelRequest, VercelResponse } from '@vercel/node';
import { airspaceHandler } from '../lib/api/handlers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await airspaceHandler(req, res);
}
