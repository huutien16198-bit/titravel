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

  const { site, username, password, postData } = req.body;
  const cleanSite = site.replace(/\/+$/, '');
  
  try {
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await axios.post(`${cleanSite}/wp-json/wp/v2/posts`, postData, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      httpsAgent
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("WP Post Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const wpError = error.response?.data;
    
    res.status(status).json({
      message: wpError?.message || error.message || "Lỗi không xác định từ WordPress",
      code: wpError?.code || status,
      details: wpError || error.message
    });
  }
}
