import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // WordPress Test Connection Endpoint
  app.post("/api/wp/test-connection", async (req, res) => {
    const { site, username, password } = req.body;
    
    try {
      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      // Try to get current user info to verify credentials and permissions
      const response = await axios.get(`${site}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
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
      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      const response = await axios.post(`${site}/wp-json/wp/v2/posts`, postData, {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("WP Post Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
    }
  });

  // WordPress Media Upload Proxy
  app.post("/api/wp/media", async (req, res) => {
    const { site, username, password, imageUrl, filename } = req.body;
    
    try {
      // Download image
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      const response = await axios.post(`${site}/wp-json/wp/v2/media`, imageBuffer, {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Disposition": `attachment; filename="${filename || 'image.jpg'}"`,
          "Content-Type": "image/jpeg",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error("WP Media Error:", JSON.stringify(errorData, null, 2));
      res.status(error.response?.status || 500).json(errorData);
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
