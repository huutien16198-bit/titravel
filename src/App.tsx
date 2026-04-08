import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Globe, 
  FileText, 
  Plus, 
  History, 
  Send, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Upload,
  Sparkles,
  ExternalLink,
  Search,
  RefreshCw,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { cn } from "@/src/lib/utils";
import { WPSite, LogEntry, BulkJob } from "./types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Safe JSON parsing for AI responses
const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerE) {
        console.error("Failed to parse extracted JSON:", innerE);
      }
    }
    throw new Error("Could not parse AI response as JSON");
  }
};

const fetchGoogleImages = async (query: string, apiKey: string, cx: string, count: number = 5) => {
  if (!apiKey || !cx) return [];
  try {
    const res = await axios.get(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${cx}&key=${apiKey}&searchType=image&num=${count}`);
    return res.data.items?.map((item: any) => item.link) || [];
  } catch (error) {
    console.error("Google Image Search Error:", error);
    return [];
  }
};

const buildArticleHtml = (data: any, images: string[]) => {
  let html = `<p>${data.introduction}</p>\n\n`;
  if (data.sections && Array.isArray(data.sections)) {
    data.sections.forEach((sec: any, index: number) => {
      html += `<h2>${sec.heading}</h2>\n`;
      html += `<p>${sec.content}</p>\n`;
      if (images[index]) {
        html += `<img src="${images[index]}" alt="${sec.heading}" />\n`;
      }
    });
  }
  if (data.faqs && Array.isArray(data.faqs) && data.faqs.length > 0) {
    html += `<h2>Câu hỏi thường gặp (FAQ)</h2>\n`;
    data.faqs.forEach((faq: any) => {
      html += `<h3>${faq.question}</h3>\n`;
      html += `<p>${faq.answer}</p>\n`;
    });
  }
  html += `<h2>Kết luận</h2>\n`;
  html += `<p>${data.conclusion}</p>\n`;
  return html;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "sites" | "generator" | "bulk" | "logs" | "settings">("dashboard");
  const [sites, setSites] = useState<WPSite[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleCx, setGoogleCx] = useState("");
  
  // Load data from localStorage
  useEffect(() => {
    const savedSites = localStorage.getItem("wp_sites");
    if (savedSites) setSites(JSON.parse(savedSites));
    
    const savedLogs = localStorage.getItem("wp_logs");
    if (savedLogs) setLogs(JSON.parse(savedLogs));

    const savedKey = localStorage.getItem("google_api_key");
    if (savedKey) setGoogleApiKey(savedKey);

    const savedCx = localStorage.getItem("google_cx");
    if (savedCx) setGoogleCx(savedCx);
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem("wp_sites", JSON.stringify(sites));
  }, [sites]);

  useEffect(() => {
    localStorage.setItem("wp_logs", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem("google_api_key", googleApiKey);
  }, [googleApiKey]);

  useEffect(() => {
    localStorage.setItem("google_cx", googleCx);
  }, [googleCx]);

  const addLog = (message: string, level: LogEntry["level"], site?: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      site
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-50 w-64 h-full bg-white border-r border-[#E5E7EB] flex flex-col transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Globe className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">WP AutoPost</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Tổng quan" 
            active={activeTab === "dashboard"} 
            onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<Globe className="w-5 h-5" />} 
            label="Trang web" 
            active={activeTab === "sites"} 
            onClick={() => { setActiveTab("sites"); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<Sparkles className="w-5 h-5" />} 
            label="Tạo bài viết AI" 
            active={activeTab === "generator"} 
            onClick={() => { setActiveTab("generator"); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<Upload className="w-5 h-5" />} 
            label="Đăng hàng loạt" 
            active={activeTab === "bulk"} 
            onClick={() => { setActiveTab("bulk"); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<History className="w-5 h-5" />} 
            label="Lịch sử" 
            active={activeTab === "logs"} 
            onClick={() => { setActiveTab("logs"); setIsSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<Settings className="w-5 h-5" />} 
            label="Cài đặt" 
            active={activeTab === "settings"} 
            onClick={() => { setActiveTab("settings"); setIsSidebarOpen(false); }} 
          />
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Trạng thái</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-sm font-medium text-blue-900">Hệ thống Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <LayoutDashboard className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard title="Tổng số Website" value={sites.length} icon={<Globe className="text-blue-600" />} />
                  <StatCard title="Bài đăng hôm nay" value={logs.filter(l => l.level === 'success').length} icon={<FileText className="text-green-600" />} />
                  <StatCard title="Lỗi" value={logs.filter(l => l.level === 'error').length} icon={<AlertCircle className="text-red-600" />} />
                </div>

                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Thao tác nhanh</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <QuickAction 
                      title="Thêm Website mới" 
                      description="Kết nối website WordPress qua REST API"
                      icon={<Plus className="text-blue-600" />}
                      onClick={() => setActiveTab("sites")}
                    />
                    <QuickAction 
                      title="Tạo nội dung AI" 
                      description="Tạo bài viết chuẩn SEO trong vài giây"
                      icon={<Sparkles className="text-purple-600" />}
                      onClick={() => setActiveTab("generator")}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "sites" && (
              <SiteManager sites={sites} setSites={setSites} addLog={addLog} />
            )}

            {activeTab === "generator" && (
              <ContentGenerator sites={sites} addLog={addLog} googleApiKey={googleApiKey} googleCx={googleCx} />
            )}

            {activeTab === "bulk" && (
              <BulkPoster sites={sites} addLog={addLog} googleApiKey={googleApiKey} googleCx={googleCx} />
            )}

            {activeTab === "logs" && (
              <LogViewer logs={logs} />
            )}

            {activeTab === "settings" && (
              <SettingsPanel 
                googleApiKey={googleApiKey} setGoogleApiKey={setGoogleApiKey}
                googleCx={googleCx} setGoogleCx={setGoogleCx}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm",
        active 
          ? "bg-blue-50 text-blue-600" 
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live</span>
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
    </div>
  );
}

function QuickAction({ title, description, icon, onClick }: { title: string, description: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-start gap-4 p-4 rounded-xl border border-[#E5E7EB] hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
    >
      <div className="p-3 bg-white rounded-lg border border-[#E5E7EB] group-hover:border-blue-200 shadow-sm">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1">{title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

// --- SUB-COMPONENTS ---

function SiteManager({ sites, setSites, addLog }: { sites: WPSite[], setSites: React.Dispatch<React.SetStateAction<WPSite[]>>, addLog: any }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [newSite, setNewSite] = useState<Partial<WPSite>>({ site: '', username: '', applicationPassword: '', name: '' });

  const handleAdd = () => {
    if (!newSite.site || !newSite.username || !newSite.applicationPassword) return;
    const site: WPSite = {
      id: Math.random().toString(36).substr(2, 9),
      site: newSite.site.replace(/\/$/, ""),
      username: newSite.username,
      applicationPassword: newSite.applicationPassword,
      name: newSite.name || new URL(newSite.site).hostname
    };
    setSites([...sites, site]);
    setNewSite({ site: '', username: '', applicationPassword: '', name: '' });
    setIsAdding(false);
    addLog(`Đã thêm website: ${site.name}`, 'success');
  };

  const handleDelete = (id: string) => {
    const site = sites.find(s => s.id === id);
    setSites(sites.filter(s => s.id !== id));
    addLog(`Đã xóa website: ${site?.name}`, 'info');
  };

  const testConnection = async (site: WPSite) => {
    setIsTesting(site.id);
    try {
      const response = await axios.post("/api/wp/test-connection", {
        site: site.site,
        username: site.username,
        password: site.applicationPassword
      });
      
      if (response.data.success) {
        addLog(`Kiểm tra kết nối thành công (${site.name}): ${response.data.message}`, 'success', site.name);
        alert(`✅ ${response.data.message}\nUser: ${response.data.user}\nRoles: ${response.data.roles.join(', ')}`);
      } else {
        addLog(`Kiểm tra kết nối thất bại (${site.name}): ${response.data.message}`, 'error', site.name);
        alert(`❌ ${response.data.message}`);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Lỗi kết nối server.";
      addLog(`Lỗi kiểm tra kết nối (${site.name}): ${msg}`, 'error', site.name);
      alert(`❌ ${msg}`);
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold">Quản lý Website</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm Website
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sites.map(site => (
          <div key={site.id} className="bg-white p-4 lg:p-5 rounded-2xl border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                <Globe className="w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold truncate">{site.name}</h4>
                <p className="text-xs lg:text-sm text-gray-500 truncate">{site.site}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ml-auto sm:ml-0">
              <button 
                onClick={() => testConnection(site)} 
                disabled={isTesting === site.id}
                className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 flex items-center gap-1 text-xs font-bold"
              >
                {isTesting === site.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Kiểm tra
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                <ExternalLink className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(site.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {sites.length === 0 && !isAdding && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Chưa có website nào được kết nối.</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 lg:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-6">Kết nối Website WordPress</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tên Website (Tùy chọn)</label>
                <input 
                  type="text" 
                  placeholder="My Blog"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  value={newSite.name}
                  onChange={e => setNewSite({...newSite, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Đường dẫn Website</label>
                <input 
                  type="url" 
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  value={newSite.site}
                  onChange={e => setNewSite({...newSite, site: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tên đăng nhập (Username)</label>
                <input 
                  type="text" 
                  placeholder="admin"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  value={newSite.username}
                  onChange={e => setNewSite({...newSite, username: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Application Password</label>
                <input 
                  type="password" 
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  value={newSite.applicationPassword}
                  onChange={e => setNewSite({...newSite, applicationPassword: e.target.value})}
                />
                <p className="text-[10px] text-gray-400 mt-2">
                  Vào Users → Profile → Application Passwords trong WP admin để tạo mật khẩu ứng dụng.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
              >
                Hủy
              </button>
              <button 
                onClick={handleAdd}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
              >
                Kết nối Website
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ContentGenerator({ sites, addLog, googleApiKey, googleCx }: { sites: WPSite[], addLog: any, googleApiKey: string, googleCx: string }) {
  const [keyword, setKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{ title: string, content: string, meta: string, slug: string, imageUrl?: string } | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const generateContent = async () => {
    if (!keyword) return;
    setIsGenerating(true);
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `
        Bạn là chuyên gia SEO. Hãy viết một bài viết chuẩn SEO chuyên sâu về chủ đề: "${keyword}".
        Yêu cầu BẮT BUỘC:
        1. Bài viết phải có phần mở đầu, ít nhất 5 mục chính (sections), phần FAQ (5 câu hỏi) và kết luận.
        2. Trả về ĐÚNG định dạng JSON sau, không thêm bất kỳ ký tự nào khác:
        {
          "title": "Tiêu đề bài viết",
          "introduction": "Đoạn mở đầu dẫn dắt",
          "sections": [
            { "heading": "Tiêu đề mục 1 (H2)", "content": "Nội dung chi tiết mục 1 (dùng HTML cơ bản như <ul>, <b>)" },
            { "heading": "Tiêu đề mục 2 (H2)", "content": "Nội dung chi tiết mục 2" },
            { "heading": "Tiêu đề mục 3 (H2)", "content": "Nội dung chi tiết mục 3" },
            { "heading": "Tiêu đề mục 4 (H2)", "content": "Nội dung chi tiết mục 4" },
            { "heading": "Tiêu đề mục 5 (H2)", "content": "Nội dung chi tiết mục 5" }
          ],
          "faqs": [
            { "question": "Câu hỏi 1", "answer": "Trả lời 1" }
          ],
          "conclusion": "Đoạn kết luận",
          "meta": "Meta description (dưới 160 ký tự)",
          "slug": "url-slug-than-thien"
        }
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const data = safeJsonParse(response.text || "{}");
      
      let images: string[] = [];
      if (googleApiKey && googleCx) {
        images = await fetchGoogleImages(keyword, googleApiKey, googleCx, 5);
      }
      
      const finalHtml = buildArticleHtml(data, images);
      const featuredImage = images.length > 0 ? images[0] : `https://picsum.photos/seed/${encodeURIComponent(keyword)}/1200/630`;
      
      setGeneratedContent({ 
        title: data.title, 
        content: finalHtml, 
        meta: data.meta, 
        slug: data.slug, 
        imageUrl: featuredImage 
      });
      setImageUrl(featuredImage);
      addLog(`Đã tạo nội dung cho: ${keyword}`, 'success');
    } catch (error: any) {
      console.error(error);
      addLog(`Lỗi tạo nội dung: ${error.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const publishToWP = async () => {
    if (!generatedContent || !selectedSiteId) return;
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;

    setIsPosting(true);
    try {
      let mediaId = undefined;
      
      if (imageUrl) {
        addLog(`Đang tải ảnh đại diện lên ${site.name}...`, 'info', site.name);
        const mediaResponse = await axios.post("/api/wp/media", {
          site: site.site,
          username: site.username,
          password: site.applicationPassword,
          imageUrl: imageUrl,
          filename: `${generatedContent.slug}.jpg`
        });
        mediaId = mediaResponse.data.id;
      }

      await axios.post("/api/wp/post", {
        site: site.site,
        username: site.username,
        password: site.applicationPassword,
        postData: {
          title: generatedContent.title,
          content: generatedContent.content,
          status: 'publish',
          slug: generatedContent.slug,
          featured_media: mediaId,
          meta: {
            _yoast_wpseo_metadesc: generatedContent.meta
          }
        }
      });
      addLog(`Đã đăng lên ${site.name}: ${generatedContent.title}`, 'success', site.name);
      alert("Đăng bài thành công!");
    } catch (error: any) {
      addLog(`Lỗi đăng bài lên ${site.name}: ${error.response?.data?.message || error.message}`, 'error', site.name);
      alert("Đăng bài thất bại.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="bg-white p-4 lg:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Sparkles className="text-purple-600" />
          Tạo bài viết AI
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Nhập từ khóa..."
              className="w-full pl-12 pr-4 py-3 lg:py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base lg:text-lg"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <button 
            onClick={generateContent}
            disabled={isGenerating || !keyword}
            className="bg-blue-600 text-white px-6 lg:px-8 py-3 lg:py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Tạo nội dung
          </button>
        </div>
      </div>

      {generatedContent && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-4 lg:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm">
                <h4 className="text-xl lg:text-2xl font-bold mb-4">{generatedContent.title}</h4>
                <div className="prose prose-sm lg:prose-blue max-w-none text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: generatedContent.content }} />
              </div>
            </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm">
              <h4 className="font-bold mb-4">Ảnh đại diện</h4>
              <div className="space-y-4">
                {imageUrl && (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-100">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
                <input 
                  type="text" 
                  placeholder="URL Hình ảnh"
                  className="w-full p-3 rounded-xl border border-gray-200 outline-none text-xs"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm">
              <h4 className="font-bold mb-4">Cài đặt SEO</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Đường dẫn (Slug)</label>
                  <div className="p-3 bg-gray-50 rounded-xl text-sm font-mono text-gray-600">{generatedContent.slug}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Meta Description</label>
                  <p className="text-sm text-gray-600 leading-relaxed">{generatedContent.meta}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm">
              <h4 className="font-bold mb-4">Đăng lên WordPress</h4>
              <div className="space-y-4">
                <select 
                  className="w-full p-3 rounded-xl border border-gray-200 outline-none text-sm"
                  value={selectedSiteId}
                  onChange={e => setSelectedSiteId(e.target.value)}
                >
                  <option value="">Chọn website...</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
                <button 
                  onClick={publishToWP}
                  disabled={isPosting || !selectedSiteId}
                  className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPosting ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                  Đăng ngay
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function BulkPoster({ sites, addLog, googleApiKey, googleCx }: { sites: WPSite[], addLog: any, googleApiKey: string, googleCx: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      try {
        const response = await axios.post("/api/parse-csv", { csvData });
        setJobs(response.data.map((r: any) => ({
          keyword: r.keyword,
          category: r.category,
          tags: r.tags,
          count: parseInt(r.number_of_posts || "1")
        })));
        addLog(`Đã tải ${response.data.length} công việc từ CSV`, 'info');
      } catch (error: any) {
        addLog(`Lỗi đọc CSV: ${error.message}`, 'error');
      }
    };
    reader.readAsText(selectedFile);
  };

  const startBulkProcess = async () => {
    if (jobs.length === 0 || !selectedSiteId) return;
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;

    setIsProcessing(true);
    const total = jobs.reduce((acc, job) => acc + job.count, 0);
    setProgress({ current: 0, total });

    let currentCount = 0;
    for (const job of jobs) {
      for (let i = 0; i < job.count; i++) {
        try {
          const model = "gemini-3-flash-preview";
          const prompt = `
            Bạn là chuyên gia SEO. Hãy viết một bài viết chuẩn SEO chuyên sâu về chủ đề: "${job.keyword}".
            Yêu cầu BẮT BUỘC:
            1. Bài viết phải có phần mở đầu, ít nhất 5 mục chính (sections), phần FAQ (5 câu hỏi) và kết luận.
            2. Trả về ĐÚNG định dạng JSON sau, không thêm bất kỳ ký tự nào khác:
            {
              "title": "Tiêu đề bài viết",
              "introduction": "Đoạn mở đầu dẫn dắt",
              "sections": [
                { "heading": "Tiêu đề mục 1 (H2)", "content": "Nội dung chi tiết mục 1 (dùng HTML cơ bản như <ul>, <b>)" },
                { "heading": "Tiêu đề mục 2 (H2)", "content": "Nội dung chi tiết mục 2" },
                { "heading": "Tiêu đề mục 3 (H2)", "content": "Nội dung chi tiết mục 3" },
                { "heading": "Tiêu đề mục 4 (H2)", "content": "Nội dung chi tiết mục 4" },
                { "heading": "Tiêu đề mục 5 (H2)", "content": "Nội dung chi tiết mục 5" }
              ],
              "faqs": [
                { "question": "Câu hỏi 1", "answer": "Trả lời 1" }
              ],
              "conclusion": "Đoạn kết luận",
              "meta": "Meta description (dưới 160 ký tự)",
              "slug": "url-slug-than-thien"
            }
          `;
          const aiResponse = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
          });
          const data = safeJsonParse(aiResponse.text || "{}");

          let images: string[] = [];
          if (googleApiKey && googleCx) {
            images = await fetchGoogleImages(job.keyword, googleApiKey, googleCx, 5);
          }
          
          const finalHtml = buildArticleHtml(data, images);
          const featuredImage = images.length > 0 ? images[0] : `https://picsum.photos/seed/${encodeURIComponent(job.keyword)}/1200/630`;

          let mediaId = undefined;
          if (featuredImage) {
            try {
              const mediaResponse = await axios.post("/api/wp/media", {
                site: site.site,
                username: site.username,
                password: site.applicationPassword,
                imageUrl: featuredImage,
                filename: `${data.slug}.jpg`
              });
              mediaId = mediaResponse.data.id;
            } catch (e) {
              console.error("Failed to upload featured image in bulk", e);
            }
          }

          await axios.post("/api/wp/post", {
            site: site.site,
            username: site.username,
            password: site.applicationPassword,
            postData: {
              title: data.title,
              content: finalHtml,
              status: 'publish',
              slug: data.slug,
              featured_media: mediaId,
              categories: job.category ? [parseInt(job.category)] : []
            }
          });

          addLog(`Đăng hàng loạt thành công: ${data.title}`, 'success', site.name);
        } catch (error: any) {
          addLog(`Lỗi đăng hàng loạt: ${job.keyword} - ${error.message}`, 'error', site.name);
        }
        currentCount++;
        setProgress({ current: currentCount, total });
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    setIsProcessing(false);
    alert("Hoàn thành đăng bài hàng loạt!");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Upload className="text-blue-600" />
          Đăng bài hàng loạt từ CSV
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Bước 1: Tải lên file CSV</label>
            <div className="relative group">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center group-hover:border-blue-400 group-hover:bg-blue-50 transition-all">
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2 group-hover:text-blue-500" />
                <p className="text-sm font-medium text-gray-600">
                  {file ? file.name : "Nhấn hoặc kéo thả file CSV vào đây"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Định dạng: keyword, category, tags, number_of_posts</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Bước 2: Chọn Website đích</label>
            <select 
              className="w-full p-4 rounded-2xl border border-gray-200 outline-none text-lg"
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
            >
              <option value="">Chọn website...</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            
            <button 
              onClick={startBulkProcess}
              disabled={isProcessing || jobs.length === 0 || !selectedSiteId}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
              Bắt đầu đăng hàng loạt
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="mt-8 space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span>Đang xử lý...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {jobs.length > 0 && (
        <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Từ khóa</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Danh mục</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Thẻ (Tags)</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase text-center">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6] hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium">{job.keyword}</td>
                    <td className="p-4 text-sm text-gray-500">{job.category}</td>
                    <td className="p-4 text-sm text-gray-500">{job.tags}</td>
                    <td className="p-4 text-sm font-bold text-center">{job.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SettingsPanel({ googleApiKey, setGoogleApiKey, googleCx, setGoogleCx }: { googleApiKey: string, setGoogleApiKey: any, googleCx: string, setGoogleCx: any }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl border border-[#E5E7EB] shadow-sm max-w-2xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Settings className="text-gray-600" />
          Cài đặt hệ thống
        </h3>
        
        <div className="space-y-6">
          <div>
            <h4 className="font-bold text-gray-800 mb-2">Google Custom Search API</h4>
            <p className="text-sm text-gray-500 mb-4">
              Cấu hình API để tự động tìm kiếm hình ảnh thực tế từ Google thay vì dùng ảnh ngẫu nhiên.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">API Key</label>
                <input 
                  type="password" 
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  value={googleApiKey}
                  onChange={e => setGoogleApiKey(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Search Engine ID (CX)</label>
                <input 
                  type="text" 
                  placeholder="1234567890abcdef"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                  value={googleCx}
                  onChange={e => setGoogleCx(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LogViewer({ logs }: { logs: LogEntry[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-2xl font-bold">Lịch sử hoạt động</h3>
        <span className="text-xs font-bold text-gray-400 uppercase">{logs.length} Mục</span>
      </div>
      
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="bg-white p-4 rounded-2xl border border-[#E5E7EB] flex items-start gap-4 shadow-sm">
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              log.level === 'success' ? "bg-green-50 text-green-600" :
              log.level === 'error' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
            )}>
              {log.level === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
               log.level === 'error' ? <AlertCircle className="w-4 h-4" /> : <History className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">{log.timestamp}</span>
                {log.site && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{log.site}</span>}
              </div>
              <p className="text-sm font-medium text-gray-800 break-words">{log.message}</p>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Chưa có lịch sử hoạt động.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

