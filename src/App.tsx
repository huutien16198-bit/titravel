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
  Settings,
  LogOut,
  LogIn
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { cn } from "@/src/lib/utils";
import { WPSite, LogEntry, BulkJob } from "./types";
import { auth, db, loginWithGoogle, logout } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

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

const fetchSingleImage = async (query: string, unsplashKey: string, googleKey: string, googleCx: string) => {
  if (unsplashKey) {
    try {
      const res = await axios.get(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${unsplashKey}`);
      if (res.data.results?.length > 0) return res.data.results[0].urls.regular;
    } catch (e) {
      console.error("Unsplash error:", e);
    }
  }
  if (googleKey && googleCx) {
    try {
      const res = await axios.get(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${googleCx}&key=${googleKey}&searchType=image&num=1`);
      if (res.data.items?.length > 0) return res.data.items[0].link;
    } catch (e) {
      console.error("Google Image error:", e);
    }
  }
  return null;
};

const buildArticleHtml = (data: any, sectionImages: (string | null)[]) => {
  let html = `<p>${data.introduction}</p>\n\n`;
  if (data.sections && Array.isArray(data.sections)) {
    data.sections.forEach((sec: any, index: number) => {
      html += `<h2>${sec.heading}</h2>\n`;
      html += `<p>${sec.content}</p>\n`;
      if (sectionImages[index]) {
        html += `<img src="${sectionImages[index]}" alt="${sec.heading}" />\n`;
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
  const [unsplashApiKey, setUnsplashApiKey] = useState("");
  
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setSites([]);
      setLogs([]);
      setGoogleApiKey("");
      setGoogleCx("");
      setUnsplashApiKey("");
      return;
    }

    const sitesRef = collection(db, `users/${user.uid}/sites`);
    const unsubSites = onSnapshot(sitesRef, (snapshot) => {
      const sitesData: WPSite[] = [];
      snapshot.forEach((doc) => sitesData.push(doc.data() as WPSite));
      setSites(sitesData);
    });

    const logsRef = collection(db, `users/${user.uid}/logs`);
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const logsData: LogEntry[] = [];
      snapshot.forEach((doc) => logsData.push(doc.data() as LogEntry));
      setLogs(logsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    });

    const settingsRef = doc(db, `users/${user.uid}/settings/main`);
    const unsubSettings = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGoogleApiKey(data.googleApiKey || "");
        setGoogleCx(data.googleCx || "");
        setUnsplashApiKey(data.unsplashApiKey || "");
      }
    });

    return () => {
      unsubSites();
      unsubLogs();
      unsubSettings();
    };
  }, [user, isAuthReady]);

  const saveSettings = async (key: string, cx: string, unsplashKey: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/main`), {
        googleApiKey: key,
        googleCx: cx,
        unsplashApiKey: unsplashKey,
        uid: user.uid,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const addLog = async (message: string, level: LogEntry["level"], site?: string) => {
    if (!user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const newLog: any = {
      id,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      uid: user.uid,
      createdAt: Date.now()
    };
    if (site) {
      newLog.site = site;
    }
    try {
      await setDoc(doc(db, `users/${user.uid}/logs/${id}`), newLog);
    } catch (error) {
      console.error("Error adding log:", error);
    }
  };

  if (!isAuthReady) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Globe className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">WP AutoPost</h1>
          <p className="text-gray-500 mb-8">Đăng nhập để quản lý website và tự động hóa bài viết của bạn.</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Đăng nhập với Google
          </button>
        </div>
      </div>
    );
  }

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
              <SiteManager sites={sites} setSites={setSites} addLog={addLog} user={user} />
            )}

            {activeTab === "generator" && (
              <ContentGenerator sites={sites} addLog={addLog} googleApiKey={googleApiKey} googleCx={googleCx} unsplashApiKey={unsplashApiKey} />
            )}

            {activeTab === "bulk" && (
              <BulkPoster sites={sites} addLog={addLog} googleApiKey={googleApiKey} googleCx={googleCx} unsplashApiKey={unsplashApiKey} />
            )}

            {activeTab === "logs" && (
              <LogViewer logs={logs} />
            )}

            {activeTab === "settings" && (
              <SettingsPanel 
                googleApiKey={googleApiKey} setGoogleApiKey={setGoogleApiKey}
                googleCx={googleCx} setGoogleCx={setGoogleCx}
                unsplashApiKey={unsplashApiKey} setUnsplashApiKey={setUnsplashApiKey}
                saveSettings={saveSettings}
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

function SiteManager({ sites, setSites, addLog, user }: { sites: WPSite[], setSites: React.Dispatch<React.SetStateAction<WPSite[]>>, addLog: any, user: any }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [newSite, setNewSite] = useState<Partial<WPSite>>({ site: '', username: '', applicationPassword: '', name: '' });

  const handleAdd = async () => {
    if (!newSite.site || !newSite.username || !newSite.applicationPassword || !user) return;
    const site: WPSite = {
      id: Math.random().toString(36).substr(2, 9),
      site: newSite.site.replace(/\/$/, ""),
      username: newSite.username,
      applicationPassword: newSite.applicationPassword,
      name: newSite.name || new URL(newSite.site).hostname,
      uid: user.uid,
      createdAt: Date.now()
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/sites/${site.id}`), site);
      setNewSite({ site: '', username: '', applicationPassword: '', name: '' });
      setIsAdding(false);
      addLog(`Đã thêm website: ${site.name}`, 'success');
    } catch (error) {
      console.error("Error adding site:", error);
      addLog(`Lỗi thêm website: ${error}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const site = sites.find(s => s.id === id);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/sites/${id}`));
      addLog(`Đã xóa website: ${site?.name}`, 'info');
    } catch (error) {
      console.error("Error deleting site:", error);
    }
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

function ContentGenerator({ sites, addLog, googleApiKey, googleCx, unsplashApiKey }: { sites: WPSite[], addLog: any, googleApiKey: string, googleCx: string, unsplashApiKey: string }) {
  const [keyword, setKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{ title: string, content: string, meta: string, slug: string, imageUrl?: string, imageAlt?: string } | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [internalLinks, setInternalLinks] = useState("");

  const generateContent = async () => {
    if (!keyword) return;
    setIsGenerating(true);
    try {
      const model = "gemini-3-flash-preview";
      const currentYear = new Date().getFullYear();
      const prompt = `
        Bạn là chuyên gia SEO. Hãy viết một bài viết chuẩn SEO chuyên sâu, độ dài TỐI THIỂU 1500 từ.
        - Từ khóa chính: "${keyword}"
        - Từ khóa phụ: "${secondaryKeywords || 'Không có'}"
        - Liên kết nội bộ (Internal Links): ${internalLinks || 'Không có'}
        
        Yêu cầu BẮT BUỘC:
        1. Sử dụng công cụ tìm kiếm để cập nhật thông tin mới nhất (hiện tại là năm ${currentYear}).
        2. Bài viết phải dài ít nhất 1500 từ. Hãy viết thật chi tiết, phân tích sâu từng khía cạnh.
        3. Phân bổ từ khóa chính và từ khóa phụ một cách tự nhiên vào tiêu đề, mở bài, các thẻ H2, H3 và kết luận.
        4. Chèn các liên kết nội bộ (nếu có) vào văn bản một cách tự nhiên bằng thẻ <a>.
        5. Bài viết phải có phần mở đầu, ít nhất 6-8 mục chính (sections) để đảm bảo độ dài, phần FAQ (5 câu hỏi) và kết luận.
        6. Trả về ĐÚNG định dạng JSON sau, không thêm bất kỳ ký tự nào khác:
        {
          "title": "Tiêu đề bài viết",
          "introduction": "Đoạn mở đầu dẫn dắt (chứa từ khóa)",
          "featured_image_keyword": "từ khóa tiếng Anh ngắn gọn để tìm ảnh đại diện",
          "sections": [
            { 
              "heading": "Tiêu đề mục 1 (H2)", 
              "content": "Nội dung chi tiết mục 1 (dùng HTML cơ bản như <ul>, <b>, <h3>, <a>)",
              "image_keyword": "từ khóa tiếng Anh ngắn gọn để tìm ảnh minh họa cho mục này"
            },
            { "heading": "Tiêu đề mục 2 (H2)", "content": "Nội dung chi tiết mục 2", "image_keyword": "english keyword" }
          ],
          "faqs": [
            { "question": "Câu hỏi 1", "answer": "Trả lời 1" }
          ],
          "conclusion": "Đoạn kết luận (chứa từ khóa)",
          "meta": "Meta description (dưới 160 ký tự, chứa từ khóa chính)",
          "slug": "url-slug-than-thien"
        }
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: { 
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const data = safeJsonParse(response.text || "{}");
      const slug = data.slug || keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      // Fetch featured image
      let featuredImage = "";
      if (unsplashApiKey || (googleApiKey && googleCx)) {
        featuredImage = await fetchSingleImage(data.featured_image_keyword || keyword, unsplashApiKey, googleApiKey, googleCx) || "";
      }
      if (!featuredImage) {
        featuredImage = `https://picsum.photos/seed/${encodeURIComponent(keyword)}/1200/630`;
      }

      // Fetch section images
      const sectionImages: (string | null)[] = [];
      if (data.sections && Array.isArray(data.sections)) {
        if (unsplashApiKey || (googleApiKey && googleCx)) {
          const promises = data.sections.map((sec: any) => 
            fetchSingleImage(sec.image_keyword || sec.heading, unsplashApiKey, googleApiKey, googleCx)
          );
          const results = await Promise.all(promises);
          sectionImages.push(...results);
        } else {
          // No API keys, no section images
          data.sections.forEach(() => sectionImages.push(null));
        }
      }
      
      let finalHtml = buildArticleHtml(data, sectionImages);
      
      // Extract Search Grounding URLs
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        finalHtml += `\n<h2>Nguồn tham khảo</h2>\n<ul>\n`;
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            finalHtml += `<li><a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer">${chunk.web.title}</a></li>\n`;
          }
        });
        finalHtml += `</ul>\n`;
      }
      
      // Generate alt text for featured image
      const altTextPrompt = `Tạo một thẻ alt (alternative text) ngắn gọn, chuẩn SEO cho hình ảnh đại diện của bài viết có tiêu đề: "${data.title}". Từ khóa chính: "${keyword}". Trả về CHỈ nội dung thẻ alt, không có ngoặc kép hay giải thích.`;
      const altResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: altTextPrompt }] }]
      });
      const featuredImageAlt = altResponse.text?.trim() || keyword;

      setGeneratedContent({ 
        title: data.title, 
        content: finalHtml, 
        meta: data.meta, 
        slug: slug, 
        imageUrl: featuredImage,
        imageAlt: featuredImageAlt
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
          filename: `${generatedContent.slug}.jpg`,
          altText: generatedContent.imageAlt
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
          status: scheduleDate ? 'future' : 'publish',
          date: scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Nhập từ khóa chính..."
                className="w-full pl-12 pr-4 py-3 lg:py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base lg:text-lg"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Từ khóa phụ (cách nhau bằng dấu phẩy)..."
                className="w-full px-4 py-3 lg:py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base lg:text-lg"
                value={secondaryKeywords}
                onChange={e => setSecondaryKeywords(e.target.value)}
              />
            </div>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Liên kết nội bộ (Ví dụ: https://example.com/bai-1, https://example.com/bai-2)..."
              className="w-full px-4 py-3 lg:py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base lg:text-lg"
              value={internalLinks}
              onChange={e => setInternalLinks(e.target.value)}
            />
          </div>
          <button 
            onClick={generateContent}
            disabled={isGenerating || !keyword}
            className="w-full sm:w-auto self-end bg-blue-600 text-white px-6 lg:px-8 py-3 lg:py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                <input 
                  type="text" 
                  value={generatedContent.title}
                  onChange={e => setGeneratedContent({...generatedContent, title: e.target.value})}
                  className="w-full text-xl lg:text-2xl font-bold mb-4 outline-none border-b border-transparent hover:border-gray-200 focus:border-blue-500 transition-colors"
                />
                <textarea 
                  value={generatedContent.content} 
                  onChange={(e) => setGeneratedContent({...generatedContent, content: e.target.value})}
                  className="w-full h-[500px] mb-12 p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Lên lịch đăng (Tùy chọn)</label>
                  <input 
                    type="datetime-local" 
                    className="w-full p-3 rounded-xl border border-gray-200 outline-none text-sm"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                  />
                </div>

                <button 
                  onClick={publishToWP}
                  disabled={isPosting || !selectedSiteId}
                  className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPosting ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                  {scheduleDate ? "Lên lịch đăng" : "Đăng ngay"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function BulkPoster({ sites, addLog, googleApiKey, googleCx, unsplashApiKey }: { sites: WPSite[], addLog: any, googleApiKey: string, googleCx: string, unsplashApiKey: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleInterval, setScheduleInterval] = useState(60); // minutes
  
  // Use a ref to track paused state inside the async loop
  const isPausedRef = React.useRef(isPaused);
  const isProcessingRef = React.useRef(isProcessing);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

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
          secondaryKeywords: r.secondary_keywords || "",
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

    if (isProcessing && isPaused) {
      setIsPaused(false);
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    const total = jobs.reduce((acc, job) => acc + job.count, 0);
    setProgress({ current: 0, total });

    let currentCount = 0;
    let currentScheduleTime = scheduleDate ? new Date(scheduleDate).getTime() : 0;

    for (const job of jobs) {
      for (let i = 0; i < job.count; i++) {
        // Check if stopped
        if (!isProcessingRef.current) return;

        // Wait if paused
        while (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!isProcessingRef.current) return; // Check again in case stopped while paused
        }
        try {
          const model = "gemini-3-flash-preview";
          const currentYear = new Date().getFullYear();
          const prompt = `
            Bạn là chuyên gia SEO. Hãy viết một bài viết chuẩn SEO chuyên sâu, độ dài TỐI THIỂU 1500 từ.
            - Từ khóa chính: "${job.keyword}"
            - Từ khóa phụ: "${job.secondaryKeywords || 'Không có'}"
            
            Yêu cầu BẮT BUỘC:
            1. Sử dụng công cụ tìm kiếm để cập nhật thông tin mới nhất (hiện tại là năm ${currentYear}).
            2. Bài viết phải dài ít nhất 1500 từ. Hãy viết thật chi tiết, phân tích sâu từng khía cạnh.
            3. Phân bổ từ khóa chính và từ khóa phụ một cách tự nhiên vào tiêu đề, mở bài, các thẻ H2, H3 và kết luận.
            4. Bài viết phải có phần mở đầu, ít nhất 6-8 mục chính (sections) để đảm bảo độ dài, phần FAQ (5 câu hỏi) và kết luận.
            5. Trả về ĐÚNG định dạng JSON sau, không thêm bất kỳ ký tự nào khác:
            {
              "title": "Tiêu đề bài viết",
              "introduction": "Đoạn mở đầu dẫn dắt (chứa từ khóa)",
              "featured_image_keyword": "từ khóa tiếng Anh ngắn gọn để tìm ảnh đại diện",
              "sections": [
                { 
                  "heading": "Tiêu đề mục 1 (H2)", 
                  "content": "Nội dung chi tiết mục 1 (dùng HTML cơ bản như <ul>, <b>, <h3>)",
                  "image_keyword": "từ khóa tiếng Anh ngắn gọn để tìm ảnh minh họa cho mục này"
                },
                { "heading": "Tiêu đề mục 2 (H2)", "content": "Nội dung chi tiết mục 2", "image_keyword": "english keyword" }
              ],
              "faqs": [
                { "question": "Câu hỏi 1", "answer": "Trả lời 1" }
              ],
              "conclusion": "Đoạn kết luận (chứa từ khóa)",
              "meta": "Meta description (dưới 160 ký tự, chứa từ khóa chính)",
              "slug": "url-slug-than-thien"
            }
          `;
          const aiResponse = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: { 
              responseMimeType: "application/json",
              tools: [{ googleSearch: {} }]
            }
          });
          const data = safeJsonParse(aiResponse.text || "{}");
          const slug = data.slug || job.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

          // Fetch featured image
          let featuredImage = "";
          if (unsplashApiKey || (googleApiKey && googleCx)) {
            featuredImage = await fetchSingleImage(data.featured_image_keyword || job.keyword, unsplashApiKey, googleApiKey, googleCx) || "";
          }
          if (!featuredImage) {
            featuredImage = `https://picsum.photos/seed/${encodeURIComponent(job.keyword)}/1200/630`;
          }

          // Fetch section images
          const sectionImages: (string | null)[] = [];
          if (data.sections && Array.isArray(data.sections)) {
            if (unsplashApiKey || (googleApiKey && googleCx)) {
              const promises = data.sections.map((sec: any) => 
                fetchSingleImage(sec.image_keyword || sec.heading, unsplashApiKey, googleApiKey, googleCx)
              );
              const results = await Promise.all(promises);
              sectionImages.push(...results);
            } else {
              data.sections.forEach(() => sectionImages.push(null));
            }
          }
          
          let finalHtml = buildArticleHtml(data, sectionImages);

          // Extract Search Grounding URLs
          const chunks = aiResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (chunks && chunks.length > 0) {
            finalHtml += `\n<h2>Nguồn tham khảo</h2>\n<ul>\n`;
            chunks.forEach((chunk: any) => {
              if (chunk.web?.uri && chunk.web?.title) {
                finalHtml += `<li><a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer">${chunk.web.title}</a></li>\n`;
              }
            });
            finalHtml += `</ul>\n`;
          }

          // Generate alt text for featured image
          const altTextPrompt = `Tạo một thẻ alt (alternative text) ngắn gọn, chuẩn SEO cho hình ảnh đại diện của bài viết có tiêu đề: "${data.title}". Từ khóa chính: "${job.keyword}". Trả về CHỈ nội dung thẻ alt, không có ngoặc kép hay giải thích.`;
          const altResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ parts: [{ text: altTextPrompt }] }]
          });
          const featuredImageAlt = altResponse.text?.trim() || job.keyword;

          let mediaId = undefined;
          if (featuredImage) {
            try {
              const mediaResponse = await axios.post("/api/wp/media", {
                site: site.site,
                username: site.username,
                password: site.applicationPassword,
                imageUrl: featuredImage,
                filename: `${slug}.jpg`,
                altText: featuredImageAlt
              });
              mediaId = mediaResponse.data.id;
            } catch (e: any) {
              const errorMsg = e.response?.data?.message || e.message;
              addLog(`Lỗi tải ảnh lên (${site.name}): ${errorMsg}`, 'error', site.name);
              console.error("Failed to upload featured image in bulk", e);
            }
          }

          let postStatus = 'publish';
          let postDate = undefined;
          
          if (currentScheduleTime > 0) {
            postStatus = 'future';
            postDate = new Date(currentScheduleTime).toISOString();
            currentScheduleTime += scheduleInterval * 60000; // Add interval in milliseconds
          }

          await axios.post("/api/wp/post", {
            site: site.site,
            username: site.username,
            password: site.applicationPassword,
            postData: {
              title: data.title,
              content: finalHtml,
              status: postStatus,
              date: postDate,
              slug: slug,
              featured_media: mediaId,
              categories: job.category ? [parseInt(job.category)] : [],
              meta: {
                _yoast_wpseo_metadesc: data.meta
              }
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
                <p className="text-xs text-gray-400 mt-1">Định dạng: keyword, secondary_keywords, category, tags, number_of_posts</p>
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Lên lịch từ (Tùy chọn)</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-3 rounded-xl border border-gray-200 outline-none text-sm"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Khoảng cách (Phút)</label>
                <input 
                  type="number" 
                  min="1"
                  className="w-full p-3 rounded-xl border border-gray-200 outline-none text-sm"
                  value={scheduleInterval}
                  onChange={e => setScheduleInterval(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={startBulkProcess}
                disabled={isProcessing || jobs.length === 0 || !selectedSiteId}
                className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing && !isPaused ? <Loader2 className="animate-spin" /> : <Send className="w-5 h-5" />}
                {isProcessing ? (isPaused ? "Tiếp tục" : "Đang xử lý...") : "Bắt đầu đăng hàng loạt"}
              </button>
              
              {isProcessing && (
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="px-6 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all"
                >
                  {isPaused ? "Tiếp tục" : "Tạm dừng"}
                </button>
              )}
              
              {isProcessing && (
                <button
                  onClick={() => {
                    setIsProcessing(false);
                    setIsPaused(false);
                  }}
                  className="px-6 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-all"
                >
                  Dừng hẳn
                </button>
              )}
            </div>
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
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Từ khóa chính</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Từ khóa phụ</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Danh mục</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase">Thẻ (Tags)</th>
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase text-center">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr key={i} className="border-b border-[#F3F4F6] hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium">{job.keyword}</td>
                    <td className="p-4 text-sm text-gray-500">{job.secondaryKeywords || '-'}</td>
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

function SettingsPanel({ 
  googleApiKey, setGoogleApiKey, 
  googleCx, setGoogleCx,
  unsplashApiKey, setUnsplashApiKey,
  saveSettings
}: { 
  googleApiKey: string, setGoogleApiKey: any, 
  googleCx: string, setGoogleCx: any,
  unsplashApiKey: string, setUnsplashApiKey: any,
  saveSettings: (key: string, cx: string, unsplashKey: string) => void
}) {
  const handleSave = () => {
    saveSettings(googleApiKey, googleCx, unsplashApiKey);
    alert("Đã lưu cài đặt!");
  };

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
        
        <div className="space-y-8">
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

          <div className="pt-6 border-t border-gray-100">
            <h4 className="font-bold text-gray-800 mb-2">Unsplash API</h4>
            <p className="text-sm text-gray-500 mb-4">
              Cấu hình API để lấy ảnh chất lượng cao, miễn phí bản quyền từ Unsplash.
            </p>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Access Key</label>
              <input 
                type="password" 
                placeholder="Nhập Access Key của Unsplash..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-base"
                value={unsplashApiKey}
                onChange={e => setUnsplashApiKey(e.target.value)}
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
          >
            Lưu cài đặt
          </button>
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

