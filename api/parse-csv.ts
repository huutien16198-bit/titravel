import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parse } from 'csv-parse/sync';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { csvData } = req.body;
  try {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    });
    res.json(records);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}
