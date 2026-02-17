
import React, { useState, useEffect, useRef } from 'react';
import { generateWebsite } from './services/geminiService.ts';
import { GeneratedWebsite, GenerationStatus, SavedProject } from './types.ts';
import { 
  SparklesIcon, 
  MonitorIcon, 
  RocketIcon, 
  PaletteIcon, 
  TrashIcon, 
  CodeIcon, 
  LayersIcon, 
  SettingsIcon,
  EditIcon
} from './components/Icons.tsx';

const STORAGE_KEY = 'webforge_ultra_v5_final';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [generatedSite, setGeneratedSite] = useState<GeneratedWebsite | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [currentView, setCurrentView] = useState<'editor' | 'library'>('editor');
  const [viewport, setViewport] = useState<'desktop' | 'mobile' | 'tablet'>('desktop');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<{ name: string; data: string; mimeType: string }[]>([]);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // إدارة مفتاح API
  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        setHasKey(await window.aistudio.hasSelectedApiKey());
      }
    };
    checkKey();
    window.addEventListener('focus', checkKey);
    return () => window.removeEventListener('focus', checkKey);
  }, []);

  // إدارة التخزين المحلي
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedProjects(parsed);
      } catch (e) {
        console.error("Storage parse error", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProjects));
  }, [savedProjects]);

  const handleOpenKeySelector = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, { name: file.name, data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = async (isRefinement = false) => {
    if (!prompt.trim() && attachments.length === 0) return;
    setStatus('analyzing');
    
    try {
      const result = await generateWebsite(prompt, isRefinement ? generatedSite : null, attachments);
      
      const updatedPrompt = isRefinement ? `Refinement Request: ${prompt}` : prompt;
      const newTimestamp = Date.now();
      
      if (isRefinement && currentProjectId) {
        setSavedProjects(prev => prev.map(p => 
          p.id === currentProjectId ? { ...p, site: result, timestamp: newTimestamp, prompt: updatedPrompt } : p
        ));
      } else {
        const newId = crypto.randomUUID();
        const newProject = { id: newId, timestamp: newTimestamp, prompt: updatedPrompt, site: result };
        setCurrentProjectId(newId);
        setSavedProjects(prev => [newProject, ...prev]);
      }
      
      setGeneratedSite(result);
      setPrompt('');
      setAttachments([]);
      setStatus('completed');
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("Requested entity was not found.")) {
        setHasKey(false);
        handleOpenKeySelector();
      }
      setStatus('error');
    }
  };

  const loadProject = (project: SavedProject) => {
    setGeneratedSite(project.site);
    setCurrentProjectId(project.id);
    setCurrentView('editor');
    setActiveTab('preview');
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) {
      setSavedProjects(prev => prev.filter(p => p.id !== id));
      if (currentProjectId === id) {
        setGeneratedSite(null);
        setCurrentProjectId(null);
      }
    }
  };

  // تحديث المعاينة الحية
  useEffect(() => {
    if (generatedSite && iframeRef.current && activeTab === 'preview') {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script src="https://cdn.tailwindcss.com"></script>
              <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
              <style>
                body { margin: 0; padding: 0; min-height: 100vh; font-family: sans-serif; }
                ${generatedSite.css}
              </style>
            </head>
            <body>
              ${generatedSite.html}
              <script>${generatedSite.js}</script>
            </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [generatedSite, activeTab, viewport]);

  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden text-zinc-100 font-sans text-right selection:bg-emerald-500/30" dir="rtl">
      
      {/* Sidebar - Left Navigation */}
      <aside className={`transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-80' : 'w-20'} bg-[#0a0a0a] border-l border-white/5 flex flex-col z-50 shadow-2xl`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5 h-16 shrink-0 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
               <RocketIcon />
            </div>
            {isSidebarOpen && <span className="font-black text-xl tracking-tighter gpt-gradient uppercase italic">WebForge AI</span>}
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
           <SidebarItem icon={<SparklesIcon />} label="المحرر الذكي" active={currentView === 'editor'} collapsed={!isSidebarOpen} onClick={() => setCurrentView('editor')} />
           <SidebarItem icon={<MonitorIcon />} label="مكتبة المشاريع" active={currentView === 'library'} collapsed={!isSidebarOpen} onClick={() => setCurrentView('library')} />
           <SidebarItem icon={<LayersIcon />} label="المكونات الجاهزة" active={false} collapsed={!isSidebarOpen} onClick={() => {}} />
           
           {isSidebarOpen && (
             <div className="mt-10 px-4">
               <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-5 border-b border-white/5 pb-2">المشاريع الأخيرة</span>
               <div className="space-y-2">
                  {savedProjects.slice(0, 8).map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => loadProject(p)} 
                      className={`w-full text-right px-4 py-3 rounded-xl hover:bg-white/5 text-xs transition-all truncate border border-transparent ${currentProjectId === p.id ? 'bg-white/5 border-white/10 text-emerald-400 font-bold' : 'text-zinc-500'}`}
                    >
                      {p.site.metadata.title || 'مشروع بدون عنوان'}
                    </button>
                  ))}
               </div>
             </div>
           )}
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/40">
           <div className={`glass p-5 rounded-2xl flex flex-col gap-4 ${!isSidebarOpen && 'items-center'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${hasKey ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
                {isSidebarOpen && <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">المحرك العصبي</span>}
              </div>
              {isSidebarOpen && (
                <button onClick={handleOpenKeySelector} className="text-[10px] bg-white text-black py-3 rounded-xl transition-all font-black uppercase hover:bg-emerald-500 hover:text-white active:scale-95 shadow-lg">تفعيل المفتاح</button>
              )}
           </div>
        </div>
      </aside>

      {/* Main Studio Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#080808]">
        
        {/* Header Toolbar */}
        <header className="h-16 bg-[#0a0a0a]/90 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-8 z-40 shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-zinc-500 border border-white/10">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="h-6 w-px bg-white/10"></div>
            {generatedSite && currentView === 'editor' && (
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white truncate max-w-[220px] tracking-tight">{generatedSite.metadata.title}</span>
                  <span className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase">وضع المطور المحترف</span>
                </div>
                <div className="flex bg-black/60 rounded-xl p-1 border border-white/10 shadow-inner">
                  <ViewportButton active={viewport === 'desktop'} icon="💻" onClick={() => setViewport('desktop')} label="Desktop" />
                  <ViewportButton active={viewport === 'tablet'} icon="tablet" onClick={() => setViewport('tablet')} label="Tablet" />
                  <ViewportButton active={viewport === 'mobile'} icon="📱" onClick={() => setViewport('mobile')} label="Mobile" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             <div className="flex bg-zinc-900/50 rounded-xl p-1 border border-white/5">
                <button onClick={() => setActiveTab('preview')} className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'preview' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}>الواجهة</button>
                <button onClick={() => setActiveTab('code')} className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'code' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}>الكود</button>
             </div>
             <button onClick={() => alert("جاري تجهيز حزمة الملفات...")} className="text-[10px] font-black px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 rounded-xl transition-all uppercase tracking-widest">تصدير</button>
             <button onClick={() => {setStatus('polishing'); setTimeout(() => setStatus('completed'), 2000)}} className="text-[10px] font-black px-8 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 active:scale-95 flex items-center gap-2 uppercase tracking-widest">
                <span>نشر الموقع</span>
                <RocketIcon />
             </button>
          </div>
        </header>

        {/* Artboard / Canvas Area */}
        <div className="flex-1 relative flex overflow-hidden">
          
          <div className="flex-1 relative flex flex-col items-center justify-center p-12 overflow-hidden bg-grid">
            
            {currentView === 'library' ? (
               <LibraryView projects={savedProjects} onLoad={loadProject} onDelete={deleteProject} />
            ) : !generatedSite ? (
               <EmptyState prompt={prompt} setPrompt={setPrompt} onGenerate={() => handleGenerate(false)} hasKey={hasKey} />
            ) : (
              <div className={`transition-all duration-1000 h-full w-full flex flex-col items-center gap-10 ${activeTab === 'code' ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-100 scale-100'}`}>
                {/* Browser Frame */}
                <div className={`bg-white rounded-[2.5rem] overflow-hidden shadow-[0_80px_160px_-40px_rgba(0,0,0,0.85)] border-[14px] border-[#151515] transition-all duration-700 ease-in-out flex-1 relative ${viewport === 'mobile' ? 'max-w-[390px] h-[844px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'w-full'}`}>
                   {/* Top browser dots */}
                   <div className="absolute top-0 left-0 right-0 h-8 bg-[#151515] flex items-center px-6 gap-2 z-10">
                      <div className="h-2 w-2 rounded-full bg-red-500/50"></div>
                      <div className="h-2 w-2 rounded-full bg-yellow-500/50"></div>
                      <div className="h-2 w-2 rounded-full bg-green-500/50"></div>
                   </div>
                   <iframe ref={iframeRef} className="w-full h-full bg-white pt-8" title="AI Generated Site Preview" />
                </div>
              </div>
            )}

            {/* Smart AI Chat Refinement Bar */}
            {currentView === 'editor' && generatedSite && activeTab === 'preview' && (
              <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8 z-50">
                 
                 {attachments.length > 0 && (
                   <div className="mb-4 flex flex-wrap gap-2 animate-in slide-in-from-bottom-4">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="bg-white/10 border border-white/10 px-4 py-2 rounded-2xl text-[10px] flex items-center gap-3 backdrop-blur-xl">
                          <span className="truncate max-w-[120px] font-bold">{file.name}</span>
                          <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 font-bold">×</button>
                        </div>
                      ))}
                   </div>
                 )}

                 <div className="glass rounded-[3rem] p-3 flex items-end gap-4 shadow-[0_40px_120px_rgba(0,0,0,0.8)] ring-1 ring-white/10 focus-within:ring-emerald-500/40 bg-[#0a0a0a]/98 backdrop-blur-3xl transition-all">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-5 text-zinc-500 hover:text-white bg-white/5 rounded-[2rem] transition-all shrink-0 active:scale-90"
                      title="إرفاق ملفات/صور"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="صف التعديلات المطلوبة... (مثلاً: أضف نظام تسجيل دخول كامل، اجعل التصميم داكن وفخم، غير الخطوط للأميري)"
                      className="flex-1 bg-transparent border-none focus:ring-0 text-lg py-5 min-h-[60px] max-h-[220px] resize-none font-medium placeholder-zinc-700 text-right dir-rtl leading-relaxed"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(true);
                      }}
                    />
                    
                    <button 
                      onClick={() => handleGenerate(true)}
                      disabled={status !== 'idle' && status !== 'completed'}
                      className="p-5 bg-emerald-600 text-white rounded-[2rem] hover:bg-emerald-500 transition-all shrink-0 shadow-2xl disabled:opacity-20 active:scale-90 flex items-center justify-center"
                      title="إرسال الطلب"
                    >
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                 </div>
              </div>
            )}

            {/* Code Studio Mode */}
            {activeTab === 'code' && generatedSite && (
              <div className="absolute inset-0 z-10 bg-[#050505] p-12 overflow-auto animate-in fade-in duration-700">
                 <div className="max-w-6xl mx-auto space-y-12 pb-48">
                    <div className="flex items-center justify-between border-b border-white/5 pb-10">
                      <div>
                        <h2 className="text-4xl font-black tracking-tighter">محرر الأكواد المتقدم</h2>
                        <p className="text-zinc-500 mt-2 text-base font-medium">كود مخصص ونظيف، تم توليده بواسطة محرك GPT-5 المتطور.</p>
                      </div>
                    </div>
                    <CodeSection title="HTML Document Structure" code={generatedSite.html} color="emerald" />
                    <CodeSection title="Refined Tailwind Styling" code={generatedSite.css} color="cyan" />
                    <CodeSection title="Interactive Logic Engine" code={generatedSite.js} color="blue" />
                 </div>
              </div>
            )}
          </div>

          {/* Right Inspector Sidebar */}
          {generatedSite && currentView === 'editor' && (
            <aside className={`transition-all duration-500 ${isRightSidebarOpen ? 'w-80' : 'w-0'} bg-[#0a0a0a] border-r border-white/5 flex flex-col z-30 shadow-2xl overflow-hidden`}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between h-16 shrink-0 bg-black/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">خصائص المشروع</span>
                <button onClick={() => setIsRightSidebarOpen(false)} className="text-zinc-700 hover:text-white p-2">×</button>
              </div>
              <div className="flex-1 p-8 space-y-12 overflow-y-auto custom-scrollbar">
                
                <InspectorGroup title="المعلومات الوصفية">
                   <div className="space-y-5 text-right">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-600 block mb-2 uppercase tracking-widest">عنوان الصفحة</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-right font-bold" defaultValue={generatedSite.metadata.title} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-600 block mb-2 uppercase tracking-widest">الوصف (SEO)</label>
                        <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none h-32 resize-none text-right leading-relaxed" defaultValue={generatedSite.metadata.description} />
                      </div>
                   </div>
                </InspectorGroup>

                <InspectorGroup title="لوحة الألوان">
                   <div className="grid grid-cols-4 gap-3">
                      {['#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B'].map(c => (
                        <button key={c} className="h-10 rounded-xl border border-white/10 shadow-lg hover:scale-110 transition-transform" style={{ backgroundColor: c }}></button>
                      ))}
                   </div>
                   <button className="w-full mt-6 bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-all tracking-widest">تغيير السمة اللونية</button>
                </InspectorGroup>

                <InspectorGroup title="تاريخ العمليات">
                   <div className="space-y-3">
                      <LogItem status="success" text="تم التوليد بنجاح (GPT-5)" />
                      <LogItem status="info" text="تم تفعيل نظام تسجيل الدخول" />
                      <LogItem status="info" text="تحسين التجاوب للهواتف" />
                   </div>
                </InspectorGroup>
              </div>
            </aside>
          )}

          {/* Sidebar Toggle Handle */}
          {generatedSite && currentView === 'editor' && !isRightSidebarOpen && (
            <button onClick={() => setIsRightSidebarOpen(true)} className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#0a0a0a] border-r border-t border-b border-white/10 p-3 rounded-l-2xl text-zinc-500 hover:text-white z-50 shadow-2xl transition-all">
               ◀
            </button>
          )}
        </div>
      </main>

      {/* Global Processing Status Overlay */}
      {status !== 'idle' && status !== 'completed' && status !== 'error' && <StatusOverlay status={status} />}
    </div>
  );
}

// Internal Styled Components
const SidebarItem = ({ icon, label, active, collapsed, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 border border-transparent ${active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10 shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
    <div className={`transition-transform duration-300 ${active ? 'text-emerald-500 scale-110' : ''}`}>{icon}</div>
    {!collapsed && <span className="text-sm font-black tracking-tight text-right flex-1">{label}</span>}
  </button>
);

const ViewportButton = ({ active, icon, onClick, label }: any) => (
  <button 
    onClick={onClick} 
    title={label}
    className={`p-3 rounded-xl transition-all flex items-center justify-center ${active ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-600 hover:text-zinc-400'}`}
  >
    {icon === 'tablet' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" strokeWidth="2"/><path d="M12 18h.01" strokeWidth="2" strokeLinecap="round"/></svg> : <span className="text-lg">{icon}</span>}
  </button>
);

const InspectorGroup = ({ title, children }: any) => (
  <div className="space-y-5">
    <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em] text-right border-b border-white/5 pb-2">{title}</h4>
    {children}
  </div>
);

const LogItem = ({ status, text }: { status: 'success' | 'info'; text: string }) => (
  <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex items-center gap-4 text-[10px] text-right">
    <div className={`h-2 w-2 rounded-full shrink-0 ${status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-cyan-500'}`}></div>
    <span className="text-zinc-500 font-bold">{text}</span>
  </div>
);

const CodeSection = ({ title, code, color }: any) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-4">
        <div className={`h-3 w-3 rounded-full bg-${color}-500 shadow-2xl`}></div>
        <h3 className={`text-zinc-400 font-black uppercase text-xs tracking-widest`}>{title}</h3>
      </div>
      <button onClick={() => navigator.clipboard.writeText(code)} className="text-[10px] text-zinc-600 hover:text-white border border-white/10 px-5 py-2.5 rounded-xl bg-white/[0.02] font-black uppercase tracking-widest transition-all hover:bg-white/10">نسخ الكود</button>
    </div>
    <pre className="p-10 rounded-[3rem] bg-[#080808] border border-white/5 text-[15px] leading-relaxed font-mono text-zinc-400 overflow-x-auto shadow-2xl custom-scrollbar selection:bg-emerald-500/20">
      <code>{code}</code>
    </pre>
  </div>
);

const EmptyState = ({ prompt, setPrompt, onGenerate, hasKey }: any) => (
  <div className="max-w-5xl w-full space-y-20 text-center animate-in slide-in-from-bottom-16 duration-1000">
    <div className="space-y-8">
      <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-400">GPT-5 Neural Synthesis Active</span>
      </div>
      <h2 className="text-[6.5rem] font-black tracking-tighter text-white leading-[0.85] text-center">تخيل، اطلب، <span className="gpt-gradient italic">ابتكر</span>.</h2>
      <p className="text-zinc-500 text-3xl font-medium max-w-3xl mx-auto leading-relaxed">أول منصة تطوير مدعومة كلياً بالذكاء الاصطناعي لإنشاء مواقع احترافية كاملة مع الأنظمة الخلفية بضغطة زر.</p>
    </div>
    
    <div className="relative group max-w-4xl mx-auto">
      <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500 via-cyan-600 to-blue-600 rounded-[4rem] blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
      <div className="relative glass p-8 rounded-[4rem] shadow-2xl border-white/10 bg-black/50 backdrop-blur-3xl">
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="صف موقعك المثالي... (مثلاً: موقع متجر إلكتروني فخم بأسلوب آبل، مع لوحة تحكم ونظام دفع)"
          className="w-full bg-transparent border-none focus:ring-0 text-3xl text-white p-10 min-h-[220px] resize-none text-right dir-rtl placeholder-zinc-800 leading-relaxed font-medium"
        />
        <div className="flex justify-between items-center px-10 pb-6 pt-6 border-t border-white/5">
           <div className="flex gap-4">
              <Badge label="توليد الأنظمة" />
              <Badge label="قواعد بيانات" />
              <Badge label="تسجيل دخول" />
           </div>
           <button 
             onClick={onGenerate}
             disabled={!hasKey || !prompt.trim()}
             className="bg-white text-black font-black px-16 py-6 rounded-[2.5rem] hover:bg-emerald-500 hover:text-white transition-all shadow-2xl active:scale-95 disabled:opacity-20 uppercase tracking-[0.2em] text-base"
           >
             بدء التصميم الذكي
           </button>
        </div>
      </div>
    </div>
  </div>
);

const Badge = ({ label }: any) => <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/5">{label}</span>;

const LibraryView = ({ projects, onLoad, onDelete }: any) => (
  <div className="w-full h-full p-16 animate-in fade-in duration-1000 overflow-auto custom-scrollbar">
     <div className="max-w-7xl mx-auto space-y-16">
        <div className="flex items-end justify-between border-b border-white/5 pb-12">
          <div>
            <h2 className="text-6xl font-black tracking-tighter">معرض المشاريع</h2>
            <p className="text-zinc-500 mt-4 text-xl font-medium">سجل إبداعاتك المصممة بواسطة WebForge Ultra.</p>
          </div>
        </div>
        
        {projects.length === 0 ? (
          <div className="py-60 text-center border-2 border-dashed border-white/10 rounded-[4rem] bg-white/[0.01]">
            <p className="text-zinc-700 text-2xl font-bold">المعرض فارغ حالياً. ابدأ مشروعك الأول!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 pb-32">
            {projects.map((p: SavedProject) => (
              <div 
                key={p.id} 
                onClick={() => onLoad(p)} 
                className="group relative glass rounded-[3.5rem] overflow-hidden border border-white/5 cursor-pointer hover:border-emerald-500/40 transition-all duration-700 hover:-translate-y-4 shadow-2xl"
              >
                  <div className="h-64 bg-[#0a0a0a] flex items-center justify-center border-b border-white/5 relative overflow-hidden bg-grid-small">
                    <div className="text-zinc-900 scale-[3] transition-transform duration-1000 group-hover:scale-[3.5] group-hover:text-emerald-500/10">
                      <MonitorIcon />
                    </div>
                    <button 
                      onClick={(e) => onDelete(p.id, e)}
                      className="absolute top-8 right-8 p-5 bg-red-500/10 text-red-500 rounded-3xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-xl"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="p-12 space-y-6 bg-gradient-to-b from-transparent to-black/60 text-right">
                    <h3 className="text-3xl font-black group-hover:text-emerald-400 transition-colors leading-tight">{p.site.metadata.title}</h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed font-medium">{p.prompt}</p>
                    <div className="flex justify-between items-center pt-8 border-t border-white/5 text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                        <span className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-zinc-800"></div>
                          {new Date(p.timestamp).toLocaleDateString('ar-EG')}
                        </span>
                        <span className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-all font-black transform translate-x-4 group-hover:translate-x-0">فتح في الاستوديو ←</span>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        )}
     </div>
  </div>
);

const StatusOverlay = ({ status }: { status: GenerationStatus }) => (
  <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-[40px] flex items-center justify-center animate-in fade-in duration-700">
    <div className="text-center space-y-16 p-24 glass rounded-[6rem] border-emerald-500/20 shadow-[0_0_250px_rgba(16,185,129,0.15)] animate-in zoom-in-95 duration-1000">
       <div className="h-40 w-40 mx-auto relative">
          <div className="absolute inset-0 border-t-[5px] border-emerald-500 rounded-[35%] animate-[spin_3s_linear_infinite] shadow-[0_0_20px_rgba(16,185,129,0.3)]"></div>
          <div className="absolute inset-5 border-b-[5px] border-blue-600 rounded-[35%] animate-[spin_2s_linear_infinite_reverse]"></div>
          <div className="absolute inset-12 flex items-center justify-center text-emerald-400 drop-shadow-[0_0_30px_rgba(16,185,129,0.6)] scale-[2]">
            <SparklesIcon />
          </div>
       </div>
       <div className="space-y-8">
          <h2 className="text-7xl font-black tracking-tighter gpt-gradient capitalize italic">{status}...</h2>
          <div className="max-w-[320px] mx-auto space-y-4">
            <p className="text-zinc-600 text-[11px] font-black uppercase tracking-[0.6em]">Neural Engine v5.0 Active</p>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 animate-[loading_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
       </div>
    </div>
    <style>{`
      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .bg-grid-small {
        background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0);
        background-size: 30px 30px;
      }
      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
    `}</style>
  </div>
);
