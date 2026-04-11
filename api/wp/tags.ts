import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { site, username, password } = req.body;
  const cleanSite = site.replace(/\/+$/, '');
  
  try {
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await axios.get(`${cleanSite}/wp-json/wp/v2/tags?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` },
      httpsAgent
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
}
