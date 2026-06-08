import type { VercelRequest, VercelResponse } from '@vercel/node';
import { weatherHandler } from '../lib/api/handlers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await weatherHandler(req, res);
}
