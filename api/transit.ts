import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transitHandler } from '../lib/api/transit-handler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await transitHandler(req, res);
}
