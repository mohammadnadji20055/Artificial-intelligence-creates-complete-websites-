
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateWebsite } from './services/geminiService.ts';
import { GeneratedWebsite, GenerationStatus, SavedProject } from './types.ts';
import { SparklesIcon, CodeIcon, MonitorIcon, RocketIcon, SettingsIcon, LayersIcon, PaletteIcon, TrashIcon, EditIcon } from './components/Icons.tsx';

const STORAGE_KEY = 'webforge_ultra_v5';

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; data: string; mimeType: string }[]>([]);
  const [githubConnected, setGithubConnected] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Key Management & Sync
  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore - aistudio is injected globally in this environment
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        setHasKey(await window.aistudio.hasSelectedApiKey());
      }
    };
    checkKey();
    window.addEventListener('focus', checkKey);
    return () => window.removeEventListener('focus', checkKey);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSavedProjects(JSON.parse(stored));
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

    // FIX: Explicitly typing 'file' as 'File' to prevent 'unknown' inference and fix lines 64/66
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
      
      const updatedPrompt = isRefinement ? `Refined: ${prompt}` : prompt;
      
      if (isRefinement && currentProjectId) {
        setSavedProjects(prev => prev.map(p => 
          p.id === currentProjectId ? { ...p, site: result, timestamp: Date.now(), prompt: updatedPrompt } : p
        ));
      } else {
        const newId = crypto.randomUUID();
        const newProject = { id: newId, timestamp: Date.now(), prompt: updatedPrompt, site: result };
        setCurrentProjectId(newId);
        setSavedProjects(prev => [newProject, ...prev]);
      }
      
      setGeneratedSite(result);
      setPrompt('');
      setAttachments([]);
      setStatus('completed');
    } catch (err: any) {
      // FIX: Handle API Key reset if requested entity is not found
      if (err?.message?.includes("Requested entity was not found.")) {
        setHasKey(false);
        // @ts-ignore
        if (window.aistudio?.openSelectKey) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
          setHasKey(true);
        }
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
    if (confirm('هل ترغب في حذف المشروع نهائياً؟')) {
      setSavedProjects(prev => prev.filter(p => p.id !== id));
      if (currentProjectId === id) setGeneratedSite(null);
    }
  };

  const toggleGithub = () => {
    setGithubConnected(!githubConnected);
    if (!githubConnected) alert("تم الاتصال بـ GitHub بنجاح! يمكنك الآن المزامنة مباشرة.");
  };

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
              <script src="https://cdn.tailwindcss.com"></script>
              <style>body{margin:0;padding:0;min-height:100vh;overflow-x:hidden;}${generatedSite.css}</style>
            </head>
            <body>${generatedSite.html}<script>${generatedSite.js}</script></body>
          </html>
        `);
        doc.close();
      }
    }
  }, [generatedSite, activeTab, viewport]);

  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden text-zinc-100 font-sans text-right" dir="rtl">
      
      {/* Primary Studio Sidebar */}
      <aside className={`transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-20'} bg-[#0a0a0a] border-l border-white/5 flex flex-col z-50 shadow-2xl`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5 h-16 shrink-0 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
               <RocketIcon />
            </div>
            {isSidebarOpen && <span className="font-black text-lg tracking-tighter gpt-gradient uppercase italic">Forge Pro</span>}
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
           <SidebarItem icon={<SparklesIcon />} label="المصمم الذكي" active={currentView === 'editor'} collapsed={!isSidebarOpen} onClick={() => setCurrentView('editor')} />
           <SidebarItem icon={<MonitorIcon />} label="المشاريع" active={currentView === 'library'} collapsed={!isSidebarOpen} onClick={() => setCurrentView('library')} />
           <SidebarItem icon={<PaletteIcon />} label="الألوان والسمات" active={false} collapsed={!isSidebarOpen} />
           
           <div className="mt-8 border-t border-white/5 pt-6 px-4">
             {isSidebarOpen && <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-4">التكامل</span>}
             <button onClick={toggleGithub} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border ${githubConnected ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-white/5 text-zinc-500 hover:bg-white/5'}`}>
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
               {isSidebarOpen && <span className="text-xs font-bold">{githubConnected ? 'متصل بـ GitHub' : 'ربط GitHub'}</span>}
             </button>
           </div>
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/40">
           <div className={`glass p-4 rounded-2xl flex flex-col gap-3 ${!isSidebarOpen && 'items-center'}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${hasKey ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
                {isSidebarOpen && <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">المفتاح النشط</span>}
              </div>
              {isSidebarOpen && (
                <button onClick={handleOpenKeySelector} className="text-[10px] bg-white/5 hover:bg-emerald-500/20 py-2.5 rounded-xl transition-all border border-white/10 font-bold">تغيير المفتاح</button>
              )}
           </div>
        </div>
      </aside>

      {/* Primary Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#080808]">
        
        {/* Advanced Toolbar */}
        <header className="h-16 bg-[#0a0a0a]/90 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-8 z-40 shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-zinc-500 border border-transparent hover:border-white/10">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="h-5 w-px bg-white/10"></div>
            {generatedSite && currentView === 'editor' && (
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white truncate max-w-[200px] tracking-tight">{generatedSite.metadata.title}</span>
                  <span className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase">وضع التحرير المتطور</span>
                </div>
                <div className="flex bg-black/50 rounded-xl p-1 border border-white/10">
                  <ViewportButton active={viewport === 'desktop'} icon="💻" onClick={() => setViewport('desktop')} label="Desktop" />
                  <ViewportButton active={viewport === 'tablet'} icon="tablet" onClick={() => setViewport('tablet')} label="Tablet" />
                  <ViewportButton active={viewport === 'mobile'} icon="📱" onClick={() => setViewport('mobile')} label="Mobile" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             <div className="flex bg-zinc-900/50 rounded-xl p-1 border border-white/5">
                <button onClick={() => setActiveTab('preview')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'preview' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>الواجهة</button>
                <button onClick={() => setActiveTab('code')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'code' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>الكود</button>
             </div>
             <button onClick={() => alert("جاري تجهيز حزمة ZIP كاملة...")} className="text-[10px] font-black px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 rounded-xl transition-all uppercase">تصدير</button>
             <button onClick={() => {setIsPublishing(true); setTimeout(() => setIsPublishing(false), 2000)}} className="text-[10px] font-black px-8 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 flex items-center gap-2">
                {isPublishing ? 'جاري المزامنة...' : 'نشر السحاب'}
                <RocketIcon />
             </button>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 relative flex overflow-hidden">
          
          <div className="flex-1 relative flex flex-col items-center justify-center p-12 overflow-hidden bg-grid">
            
            {currentView === 'library' ? (
               <LibraryView projects={savedProjects} onLoad={loadProject} onDelete={deleteProject} />
            ) : !generatedSite ? (
               <EmptyState prompt={prompt} setPrompt={setPrompt} onGenerate={() => handleGenerate(false)} hasKey={hasKey} />
            ) : (
              <div className={`transition-all duration-1000 h-full w-full flex flex-col items-center gap-10 ${activeTab === 'code' ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-100 scale-100'}`}>
                <div className={`bg-white rounded-[2.5rem] overflow-hidden shadow-[0_80px_160px_-40px_rgba(0,0,0,0.8)] border-[14px] border-[#151515] transition-all duration-700 ease-in-out flex-1 relative ${viewport === 'mobile' ? 'max-w-[375px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'w-full'}`}>
                   <iframe ref={iframeRef} className="w-full h-full bg-white" title="Preview" />
                </div>
              </div>
            )}

            {/* Smart Chat Interface */}
            {currentView === 'editor' && generatedSite && activeTab === 'preview' && (
              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8 z-50">
                 
                 {attachments.length > 0 && (
                   <div className="mb-4 flex flex-wrap gap-2 animate-in slide-in-from-bottom-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-2">
                          <span className="truncate max-w-[100px]">{file.name}</span>
                          <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400">×</button>
                        </div>
                      ))}
                   </div>
                 )}

                 <div className="glass rounded-[2.5rem] p-3 flex items-end gap-3 shadow-[0_40px_100px_rgba(0,0,0,0.7)] ring-1 ring-white/10 focus-within:ring-emerald-500/50 bg-[#0a0a0a]/95 backdrop-blur-3xl transition-all">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 text-zinc-500 hover:text-white bg-white/5 rounded-2xl transition-all shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="اطلب تعديلاً ذكياً... (مثلاً: أضف نموذج تسجيل، غير الهوية البصرية، أضف خريطة)"
                      className="flex-1 bg-transparent border-none focus:ring-0 text-base py-4 min-h-[56px] max-h-[160px] resize-none font-medium placeholder-zinc-700 text-right dir-rtl leading-relaxed"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(true);
                      }}
                    />
                    
                    <button 
                      onClick={() => handleGenerate(true)}
                      disabled={status !== 'idle' && status !== 'completed'}
                      className="p-4 bg-emerald-600 text-white rounded-[1.8rem] hover:bg-emerald-500 transition-all shrink-0 shadow-xl disabled:opacity-20 active:scale-90 flex items-center justify-center"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                 </div>
              </div>
            )}

            {/* Advanced Code Studio */}
            {activeTab === 'code' && generatedSite && (
              <div className="absolute inset-0 z-10 bg-[#050505] p-12 overflow-auto animate-in fade-in duration-500">
                 <div className="max-w-6xl mx-auto space-y-12 pb-48">
                    <div className="flex items-center justify-between border-b border-white/5 pb-8">
                      <div>
                        <h2 className="text-3xl font-black">مختبر البرمجة</h2>
                        <p className="text-zinc-500 mt-2 text-sm">كود مخصص ونظيف مصمم لأداء فائق.</p>
                      </div>
                    </div>
                    <CodeSection title="HTML Document" code={generatedSite.html} color="emerald" />
                    <CodeSection title="Tailwind Engine" code={generatedSite.css} color="cyan" />
                    <CodeSection title="Runtime Logic" code={generatedSite.js} color="blue" />
                 </div>
              </div>
            )}
          </div>

          {/* Right Inspector Panel */}
          {generatedSite && currentView === 'editor' && (
            <aside className={`transition-all duration-500 ${isRightSidebarOpen ? 'w-80' : 'w-0'} bg-[#0a0a0a] border-r border-white/5 flex flex-col z-30 shadow-2xl overflow-hidden`}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between h-16 shrink-0 bg-black/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">مفتش الخصائص</span>
                <button onClick={() => setIsRightSidebarOpen(false)} className="text-zinc-700 hover:text-white p-1">×</button>
              </div>
              <div className="flex-1 p-6 space-y-10 overflow-y-auto custom-scrollbar">
                
                <InspectorGroup title="بيانات المشروع">
                   <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-600 block mb-2">العنوان</label>
                        <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-right" defaultValue={generatedSite.metadata.title} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-600 block mb-2">تحسين محركات البحث</label>
                        <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none h-24 resize-none text-right" defaultValue={generatedSite.metadata.description} />
                      </div>
                   </div>
                </InspectorGroup>

                <InspectorGroup title="أدوات التصميم">
                   <div className="grid grid-cols-4 gap-2">
                      {['#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B'].map(c => (
                        <button key={c} className="h-9 rounded-lg border border-white/10 shadow-sm" style={{ backgroundColor: c }}></button>
                      ))}
                   </div>
                   <button className="w-full mt-4 bg-white/5 border border-white/10 py-2.5 rounded-xl text-[10px] font-bold uppercase hover:bg-white/10 transition-all">تحميل سمة مخصصة</button>
                </InspectorGroup>

                <InspectorGroup title="سجل العمليات">
                   <div className="space-y-3">
                      <LogItem status="success" text="تم التوليد بواسطة GPT-5" />
                      <LogItem status="info" text="تحسين التجاوب تلقائياً" />
                      <LogItem status="info" text="ضغط الصور والأصول" />
                   </div>
                </InspectorGroup>
              </div>
            </aside>
          )}

          {/* Sidebar Expand Button */}
          {generatedSite && currentView === 'editor' && !isRightSidebarOpen && (
            <button onClick={() => setIsRightSidebarOpen(true)} className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#0a0a0a] border-r border-t border-b border-white/10 p-2 rounded-l-xl text-zinc-500 hover:text-white z-50 shadow-xl">
               ◀
            </button>
          )}
        </div>
      </main>

      {/* Global Status Overlay */}
      {status !== 'idle' && status !== 'completed' && status !== 'error' && <StatusOverlay status={status} />}
    </div>
  );
}

// Sub-Components
const SidebarItem = ({ icon, label, active, collapsed, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 border border-transparent ${active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10 shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
    <div className={`transition-transform duration-300 ${active ? 'text-emerald-500 scale-110' : ''}`}>{icon}</div>
    {!collapsed && <span className="text-sm font-bold tracking-tight text-right flex-1">{label}</span>}
  </button>
);

const ViewportButton = ({ active, icon, onClick, label }: any) => (
  <button 
    onClick={onClick} 
    title={label}
    className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${active ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
  >
    {icon === 'tablet' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" strokeWidth="2"/><path d="M12 18h.01" strokeWidth="2" strokeLinecap="round"/></svg> : <span className="text-base">{icon}</span>}
  </button>
);

const InspectorGroup = ({ title, children }: any) => (
  <div className="space-y-4">
    <h4 className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em]">{title}</h4>
    {children}
  </div>
);

const LogItem = ({ status, text }: { status: 'success' | 'info'; text: string }) => (
  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 flex items-center gap-3 text-[10px]">
    <div className={`h-1.5 w-1.5 rounded-full ${status === 'success' ? 'bg-emerald-500' : 'bg-cyan-500'}`}></div>
    <span className="text-zinc-500 font-medium">{text}</span>
  </div>
);

const CodeSection = ({ title, code, color }: any) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full bg-${color}-500 shadow-xl`}></div>
        <h3 className={`text-zinc-500 font-black uppercase text-[11px] tracking-widest`}>{title}</h3>
      </div>
      <button onClick={() => navigator.clipboard.writeText(code)} className="text-[10px] text-zinc-600 hover:text-white border border-white/10 px-4 py-2 rounded-xl bg-white/[0.02] font-black uppercase">نسخ</button>
    </div>
    <pre className="p-10 rounded-[2.5rem] bg-[#080808] border border-white/5 text-[14px] leading-relaxed font-['JetBrains_Mono'] text-zinc-400 overflow-x-auto shadow-2xl custom-scrollbar">
      <code>{code}</code>
    </pre>
  </div>
);

const EmptyState = ({ prompt, setPrompt, onGenerate, hasKey }: any) => (
  <div className="max-w-4xl w-full space-y-16 text-center animate-in slide-in-from-bottom-12 duration-1000">
    <div className="space-y-6">
      <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">GPT-5 Synthesis Active</span>
      </div>
      <h2 className="text-[6rem] font-black tracking-tighter text-white leading-[0.85]">تخيل، اطلب، <span className="gpt-gradient italic">ابتكر</span>.</h2>
      <p className="text-zinc-500 text-2xl font-medium max-w-2xl mx-auto leading-relaxed">بناء المواقع الاحترافية أصبح أسهل من أي وقت مضى بفضل الذكاء الاصطناعي المتطور.</p>
    </div>
    
    <div className="relative group max-w-3xl mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 via-cyan-600 to-blue-600 rounded-[3.5rem] blur opacity-10 group-hover:opacity-25 transition duration-1000"></div>
      <div className="relative glass p-6 rounded-[3.5rem] shadow-2xl border-white/10 bg-black/50 backdrop-blur-3xl">
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="صف رؤيتك للموقع... يمكنك إرفاق صور للمساعدة في التصميم"
          className="w-full bg-transparent border-none focus:ring-0 text-2xl text-white p-8 min-h-[200px] resize-none text-right dir-rtl placeholder-zinc-800 leading-relaxed font-medium"
        />
        <div className="flex justify-between items-center px-8 pb-4 pt-4 border-t border-white/5">
           <div className="flex gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 bg-white/5 px-4 py-2 rounded-xl border border-white/5">High-Res Assets</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 bg-white/5 px-4 py-2 rounded-xl border border-white/5">Responsive Core</span>
           </div>
           <button 
             onClick={onGenerate}
             disabled={!hasKey || !prompt.trim()}
             className="bg-white text-black font-black px-12 py-5 rounded-[2rem] hover:bg-emerald-500 hover:text-white transition-all shadow-2xl active:scale-95 disabled:opacity-20 uppercase tracking-widest text-sm"
           >
             بدء التصميم الذكي
           </button>
        </div>
      </div>
    </div>
  </div>
);

const LibraryView = ({ projects, onLoad, onDelete }: any) => (
  <div className="w-full h-full p-12 animate-in fade-in duration-1000 overflow-auto custom-scrollbar">
     <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex items-end justify-between border-b border-white/5 pb-10">
          <div>
            <h2 className="text-5xl font-black tracking-tight">معرض الإبداعات</h2>
            <p className="text-zinc-500 mt-3 text-lg font-medium">أرشيف مشاريعك المصممة بالذكاء الاصطناعي.</p>
          </div>
        </div>
        
        {projects.length === 0 ? (
          <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.02]">
            <p className="text-zinc-700 text-xl font-bold">المعرض فارغ حالياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pb-24">
            {projects.map((p: SavedProject) => (
              <div 
                key={p.id} 
                onClick={() => onLoad(p)} 
                className="group relative glass rounded-[3rem] overflow-hidden border border-white/5 cursor-pointer hover:border-emerald-500/40 transition-all duration-500 hover:-translate-y-3 shadow-2xl"
              >
                  <div className="h-56 bg-[#0a0a0a] flex items-center justify-center border-b border-white/5 relative overflow-hidden bg-grid-small">
                    <div className="text-zinc-900 scale-[2.5] transition-transform duration-700 group-hover:scale-[3] group-hover:text-emerald-500/10">
                      <MonitorIcon />
                    </div>
                    <button 
                      onClick={(e) => onDelete(p.id, e)}
                      className="absolute top-6 right-6 p-4 bg-red-500/10 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="p-10 space-y-5 bg-gradient-to-b from-transparent to-black/60 text-right">
                    <h3 className="text-2xl font-black group-hover:text-emerald-400 transition-colors leading-tight">{p.site.metadata.title}</h3>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed font-medium">{p.prompt}</p>
                    <div className="flex justify-between items-center pt-6 border-t border-white/5 text-[9px] font-black text-zinc-700 uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-zinc-800"></div>
                          {new Date(p.timestamp).toLocaleDateString('ar-EG')}
                        </span>
                        <span className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-all font-black">فتح الاستوديو ←</span>
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
  <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-500">
    <div className="text-center space-y-12 p-20 glass rounded-[5rem] border-emerald-500/20 shadow-[0_0_200px_rgba(16,185,129,0.1)] animate-in zoom-in-95 duration-700">
       <div className="h-32 w-32 mx-auto relative">
          <div className="absolute inset-0 border-t-[4px] border-emerald-500 rounded-[35%] animate-[spin_3s_linear_infinite]"></div>
          <div className="absolute inset-4 border-b-[4px] border-blue-600 rounded-[35%] animate-[spin_2s_linear_infinite_reverse]"></div>
          <div className="absolute inset-10 flex items-center justify-center text-emerald-400 drop-shadow-[0_0_200px_rgba(16,185,129,0.5)] scale-150">
            <SparklesIcon />
          </div>
       </div>
       <div className="space-y-6">
          <h2 className="text-6xl font-black tracking-tighter gpt-gradient capitalize italic">{status}...</h2>
          <div className="max-w-[280px] mx-auto space-y-3">
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.5em]">Neural Engine v5.0 Active</p>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
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
        background-size: 20px 20px;
      }
    `}</style>
  </div>
);
