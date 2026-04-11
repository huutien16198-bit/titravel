import express from "express";
import axios from "axios";
import { parse } from "csv-parse/sync";
import https from "https";

const app = express();
app.use(express.json({ limit: '50mb' }));

// Permissive HTTPS agent for sites with SSL issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// WordPress Test Connection Endpoint
app.post("/api/wp/test-connection", async (req, res) => {
  const { site, username, password } = req.body;
  
  try {
    const cleanSite = site.replace(/\/$/, '');
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
});

// WordPress Proxy Endpoint
app.post("/api/wp/post", async (req, res) => {
  const { site, username, password, postData } = req.body;
  
  try {
    const cleanSite = site.replace(/\/$/, '');
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
    
    let errorMessage = error.message;
    const responseData = error.response?.data;
    
    if (typeof responseData === 'string') {
      const match = responseData.match(/<title>(.*?)<\/title>/i);
      if (match) {
        errorMessage = `Server HTML Error: ${match[1]}`;
      } else {
        errorMessage = `Server Error: ${responseData.substring(0, 100)}...`;
      }
    } else if (responseData?.message) {
      errorMessage = responseData.message;
    }

    res.status(error.response?.status || 500).json({ 
      message: errorMessage,
      details: responseData || null
    });
  }
});

// WordPress Media Upload Proxy
app.post("/api/wp/media", async (req, res) => {
  const { site, username, password, imageUrl, filename } = req.body;
  
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

    console.log(`Uploading to WordPress: ${site}/wp-json/wp/v2/media`);
    
    const cleanSite = site.replace(/\/$/, '');
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
});

// WordPress Categories Proxy
app.post("/api/wp/categories", async (req, res) => {
  const { site, username, password } = req.body;
  try {
    const cleanSite = site.replace(/\/$/, '');
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await axios.get(`${cleanSite}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` },
      httpsAgent
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

// WordPress Tags Proxy
app.post("/api/wp/tags", async (req, res) => {
  const { site, username, password } = req.body;
  try {
    const cleanSite = site.replace(/\/$/, '');
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const response = await axios.get(`${cleanSite}/wp-json/wp/v2/tags?per_page=100`, {
      headers: { Authorization: `Basic ${auth}` },
      httpsAgent
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
  }
});

// CSV Parsing Endpoint
app.post("/api/parse-csv", (req, res) => {
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
});

export default app;
