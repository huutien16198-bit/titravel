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

  const { site, username, password, imageUrl, filename, altText } = req.body;
  const cleanSite = site.replace(/\/+$/, '');
  
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    const imageResponse = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000,
      httpsAgent
    });
    
    const imageBuffer = Buffer.from(imageResponse.data);
    if (imageBuffer.length === 0) {
      throw new Error("Downloaded image is empty");
    }

    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    
    const ext = mimeToExt[contentType.split(';')[0]] || 'jpg';
    const baseName = filename ? filename.split('.')[0] : 'image';
    const finalFilename = `${baseName}.${ext}`;

    console.log(`Uploading to WordPress: ${cleanSite}/wp-json/wp/v2/media`);
    
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await axios.post(`${cleanSite}/wp-json/wp/v2/media`, imageBuffer, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Disposition": `attachment; filename="${finalFilename}"`,
        "Content-Type": contentType,
      },
      httpsAgent,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (altText && response.data.id) {
      try {
        await axios.post(`${cleanSite}/wp-json/wp/v2/media/${response.data.id}`, {
          alt_text: altText
        }, {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          httpsAgent
        });
      } catch (altError: any) {
        console.error("Failed to update alt text:", altError.message);
      }
    }

    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      const errorData = error.response.data;
      res.status(error.response.status).json({
        success: false,
        message: errorData.message || "WordPress media upload failed",
        details: errorData
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
