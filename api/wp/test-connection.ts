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
    const response = await axios.get(`${cleanSite}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      httpsAgent
    });
    
    const userData = response.data;
    const roles = userData.roles || [];
    const canPublish = roles.some((role: string) => ['administrator', 'editor', 'author'].includes(role));

    res.json({
      success: true,
      user: userData.name,
      roles: roles,
      canPublish: canPublish,
      message: canPublish 
        ? "Kết nối thành công! Tài khoản có quyền đăng bài." 
        : "Kết nối thành công nhưng tài khoản này không có quyền đăng bài (Cần Author trở lên)."
    });
  } catch (error: any) {
    console.error("WP Test Error:", error.response?.data || error.message);
    let message = "Lỗi kết nối không xác định.";
    
    if (error.response?.status === 401) {
      message = "Sai Username hoặc Application Password. Hãy kiểm tra lại.";
    } else if (error.response?.status === 403) {
      message = "Tài khoản bị chặn truy cập REST API hoặc thiếu quyền.";
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      message = "Không thể tìm thấy website. Hãy kiểm tra lại URL.";
    }

    res.status(error.response?.status || 500).json({
      success: false,
      message: message,
      details: error.response?.data || error.message
    });
  }
}
