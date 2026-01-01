import React, { useState, useRef } from 'react';
import { Download, Link as LinkIcon, AlertCircle, Loader2, Film, ArrowRight, Code, Sparkles, MessageSquare, Lightbulb, Copy, MessageCircle } from 'lucide-react';

// Service mapping with Simple Icons slugs for logos
const SERVICES = [
  { name: "Bilibili", slug: "bilibili", color: "#00A1D6" },
  { name: "Bluesky", slug: "bluesky", color: "#0285FF" },
  { name: "Dailymotion", slug: "dailymotion", color: "#FFFFFF" },
  { name: "Facebook", slug: "facebook", color: "#1877F2" },
  { name: "Instagram", slug: "instagram", color: "#E4405F" },
  { name: "Loom", slug: "loom", color: "#625DF5" },
  { name: "Ok.ru", slug: "odnoklassniki", color: "#EE8208" },
  { name: "Pinterest", slug: "pinterest", color: "#BD081C" },
  { name: "Reddit", slug: "reddit", color: "#FF4500" },
  { name: "Rutube", slug: "rutube", color: "#00C7FF" },
  { name: "Snapchat", slug: "snapchat", color: "#FFFC00" },
  { name: "Soundcloud", slug: "soundcloud", color: "#FF3300" },
  { name: "Streamable", slug: "streamable", color: "#0F90FA" },
  { name: "TikTok", slug: "tiktok", color: "#000000" },
  { name: "Tumblr", slug: "tumblr", color: "#36465D" },
  { name: "Twitch", slug: "twitch", color: "#9146FF" },
  { name: "Twitter/X", slug: "x", color: "#000000" },
  { name: "Vimeo", slug: "vimeo", color: "#1AB7EA" },
  { name: "VK", slug: "vk", color: "#0077FF" },
  { name: "YouTube", slug: "youtube", color: "#FF0000" },
  { name: "Spotify", slug: "spotify", color: "#1DB954" }
];

const App = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  
  // Gemini State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState(null);
  const [aiMode, setAiMode] = useState(null); // 'caption' or 'ideas'

  const resultRef = useRef(null);
  const aiRef = useRef(null);

  const handleInputChange = (e) => {
    setUrl(e.target.value);
    if (error) setError(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      // Clipboard access might be denied
    }
  };

  // Helper to check if a string looks like a video URL (and not an image)
  const isVideoUrl = (string) => {
    if (typeof string !== 'string' || !string.startsWith('http')) return false;
    // Exclude common image extensions
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff)$/i.test(string)) return false;
    return true;
  };

  // Helper to find a URL in a complex JSON object
  const findDownloadLink = (obj) => {
    if (!obj) return null;
    
    // 1. Direct string check
    if (typeof obj === 'string') {
      return isVideoUrl(obj) ? obj : null;
    }

    // 2. Priority Keys: Look for explicit video keys first
    const priorityKeys = ['hd', 'sd', 'mp4', 'video', 'stream', 'download_url', 'download'];
    for (const key of priorityKeys) {
      if (obj[key] && isVideoUrl(obj[key])) {
        return obj[key];
      }
    }

    // 3. Generic Keys: Look for generic keys but ensure they aren't images
    const genericKeys = ['url', 'link', 'src'];
    for (const key of genericKeys) {
      if (obj[key] && isVideoUrl(obj[key])) {
        return obj[key];
      }
    }

    // 4. Recursive Search: Go deeper, but skip image-specific container keys
    if (typeof obj === 'object') {
      for (const key in obj) {
        // Skip keys that definitely contain images to save time and avoid false positives
        if (['thumbnail', 'image', 'cover', 'poster', 'avatars', 'author'].includes(key.toLowerCase())) continue;
        
        const found = findDownloadLink(obj[key]);
        if (found) return found;
      }
    }
    return null;
  };

  // Robust fetcher with multiple fallbacks
  const fetchWithBackups = async (targetUrl) => {
    // 1. Try Direct
    try {
      const res = await fetch(targetUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           return await res.json();
        }
      }
    } catch (e) {
      console.warn("Direct fetch failed, attempting Proxy 1...");
    }

    // 2. Try CORS Proxy (corsproxy.io)
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Proxy 1 failed, attempting Proxy 2...");
    }

    // 3. Try AllOrigins (reliable fallback)
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.contents) {
          try {
             return JSON.parse(data.contents);
          } catch (parseError) {
             console.error("Failed to parse AllOrigins response");
          }
        }
      }
    } catch (e) {
      console.warn("All proxies failed.");
    }

    throw new Error("Unable to fetch video info. Network might be blocked or URL is invalid.");
  };

  const fetchVideoInfo = async () => {
    if (!url.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setAiOutput(null); // Reset AI on new fetch

    try {
      const apiEndpoint = `https://tele-social.vercel.app/down?url=${encodeURIComponent(url)}`;
      const data = await fetchWithBackups(apiEndpoint);

      console.log("API Response:", data); // Debugging

      // Attempt to extract meaningful data
      const downloadUrl = findDownloadLink(data);
      const title = data.title || data.text || data.caption || "Downloaded Video";
      const thumbnail = data.thumbnail || data.image || data.cover || null;
      const author = data.author || "Unknown";

      if (downloadUrl) {
        setResult({
          downloadUrl,
          title,
          thumbnail,
          author,
          source: data
        });
        // Scroll to result
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error("Could not find a valid video link. The link might be private or an image.");
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Please check the URL.");
    } finally {
      setLoading(false);
    }
  };

  // Gemini API Integration
  const generateAIContent = async (mode) => {
    if (!result) return;
    
    setAiLoading(true);
    setAiMode(mode);
    setAiOutput(null);
    
    // IMPORTANT: When deploying, you must add your own API Key here
    const apiKey = ""; 
    
    try {
      let prompt = "";
      if (mode === 'caption') {
        prompt = `You are a social media expert. Generate a catchy, engaging caption and 15 relevant viral hashtags for a video titled "${result.title}" by creator "${result.author}". The platform is likely a short-form video site. Return the caption first, then a line break, then the hashtags.`;
      } else if (mode === 'ideas') {
        prompt = `You are a creative director. Based on the video titled "${result.title}" by creator "${result.author}", suggest 5 unique and engaging follow-up video ideas or remix concepts that a creator could make next. Format as a numbered list with short descriptions.`;
      }

      if (!apiKey) {
         throw new Error("API Key is missing in the code.");
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        throw new Error("AI Generation failed. Please try again.");
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setAiOutput(text);
        setTimeout(() => {
          aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error("No output from AI.");
      }

    } catch (err) {
      console.error("Gemini API Error:", err);
      setAiOutput("AI feature requires a valid API Key in src/App.jsx code. Please add it to use this feature.");
    } finally {
      setAiLoading(false);
    }
  };

  // Helper to trigger the actual browser download action
  const triggerBrowserDownload = (blobUrl, fileName) => {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  };

  // Function to handle "Direct Download"
  const handleDownload = async (fileUrl, fileName) => {
    setDownloading(true);
    try {
      // 1. Sanitize filename
      const sanitizedName = (fileName || 'video').replace(/[\/\\:*?"<>|]/g, '');
      const baseName = sanitizedName.substring(0, 50).trim() || 'video';
      
      // 2. Add random suffix to ensure uniqueness every time
      const uniqueSuffix = Math.floor(Math.random() * 10000);
      let safeFileName = `${baseName}_${uniqueSuffix}.mp4`;

      // Method 1: Fetch as Blob Direct (Best case, works for Instagram/TikTok often)
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Direct fetch failed");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      triggerBrowserDownload(blobUrl, safeFileName);
      
    } catch (e) {
      console.warn("Direct download blocked (CORS), attempting Proxy Tunnel...");
      
      try {
        // Method 2: Proxy Tunnel (Forces download for Youtube/Facebook etc)
        // We route the VIDEO FILE through the proxy to bypass CORS restrictions
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fileUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Proxy fetch failed");
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        // Re-generate safe filename
        const sanitizedName = (fileName || 'video').replace(/[\/\\:*?"<>|]/g, '');
        const baseName = sanitizedName.substring(0, 50).trim() || 'video';
        const uniqueSuffix = Math.floor(Math.random() * 10000);
        let safeFileName = `${baseName}_${uniqueSuffix}.mp4`;
        
        triggerBrowserDownload(blobUrl, safeFileName);

      } catch (proxyError) {
        console.warn("Proxy tunnel failed, falling back to new tab.", proxyError);
        
        // Method 3: Fallback (Video opens in new tab)
        const link = document.createElement('a');
        link.href = fileUrl;
        
        // Even for fallback, try to suggest a name
        const sanitizedName = (fileName || 'video').replace(/[\/\\:*?"<>|]/g, '');
        const baseName = sanitizedName.substring(0, 50).trim() || 'video';
        const uniqueSuffix = Math.floor(Math.random() * 10000);
        link.download = `${baseName}_${uniqueSuffix}.mp4`;
        
        link.target = '_blank'; 
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Optional: Add toast here
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Download className="text-white w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white block leading-none">TeleSocial</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <span className="hover:text-white transition-colors cursor-pointer">How it works</span>
            <span className="hover:text-white transition-colors cursor-pointer">Supported Sites</span>
            <a href="#" className="hover:text-white transition-colors">API</a>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-grow flex flex-col items-center justify-center text-center mb-12">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800 text-xs font-medium text-indigo-400 mb-6 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Supports 20+ Social Platforms
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-2 tracking-tight leading-tight">
            Universal Social <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Media Downloader
            </span>
          </h1>
          
          {/* Subtitle / Developer Credit */}
          <div className="mb-8 flex items-center justify-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <Code className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-slate-400 tracking-wide uppercase">
              Developed by <span className="text-indigo-300">Ramzan Ahsan</span>
            </span>
          </div>
          
          <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Download videos directly from your favorite social networks. 
            No ads, no new tabs, just paste and save.
          </p>

          {/* Input Area */}
          <div className="w-full max-w-2xl relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900 ring-1 ring-slate-800 rounded-2xl p-2 flex flex-col md:flex-row items-center gap-2 shadow-2xl">
              <div className="flex-grow flex items-center w-full md:w-auto px-4 h-12 md:h-14">
                <LinkIcon className="w-5 h-5 text-slate-500 mr-3" />
                <input
                  type="text"
                  placeholder="Paste video URL here..."
                  className="bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 w-full h-full text-lg"
                  value={url}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && fetchVideoInfo()}
                />
                {url && (
                  <button 
                    onClick={() => setUrl('')}
                    className="text-slate-600 hover:text-slate-400 p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={fetchVideoInfo}
                disabled={loading || !url}
                className="w-full md:w-auto h-12 md:h-14 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Download
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <div className="absolute right-0 -bottom-8">
              <button onClick={handlePaste} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                Paste from clipboard
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 flex items-center gap-3 animate-fade-in text-left max-w-xl mx-auto">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

        </main>

        {/* Results Section */}
        {result && (
          <div ref={resultRef} className="w-full max-w-3xl mx-auto mb-20 animate-fade-in-up">
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
                
                {/* Thumbnail */}
                <div className="w-full md:w-1/2 aspect-video bg-slate-800 rounded-2xl overflow-hidden relative shadow-inner group">
                   {result.thumbnail ? (
                     <img 
                       src={result.thumbnail} 
                       alt={result.title} 
                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                     />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-600">
                       <Film className="w-12 h-12 opacity-50" />
                     </div>
                   )}
                   <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                </div>

                {/* Details */}
                <div className="w-full md:w-1/2 flex flex-col justify-between min-h-[200px]">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                       <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/20 uppercase tracking-wider">
                         Ready
                       </span>
                       <span className="text-xs text-slate-500">{result.author}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-snug">
                      {result.title}
                    </h3>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => handleDownload(result.downloadUrl, result.title)}
                      disabled={downloading}
                      className="w-full py-4 bg-white hover:bg-slate-200 text-slate-900 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      {downloading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          Download Video
                        </>
                      )}
                    </button>
                    
                    {/* Gemini AI Tools Section */}
                    <div className="pt-4 mt-2 border-t border-slate-800">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        <span className="mr-1">✨</span> Smart Social Assistant
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => generateAIContent('caption')}
                          disabled={aiLoading}
                          className="py-2.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          {aiLoading && aiMode === 'caption' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                          Viral Caption
                        </button>
                        <button 
                          onClick={() => generateAIContent('ideas')}
                          disabled={aiLoading}
                          className="py-2.5 px-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                          {aiLoading && aiMode === 'ideas' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                          Remix Ideas
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              
              {/* AI Output Section */}
              {aiOutput && (
                <div ref={aiRef} className="bg-slate-950/50 border-t border-slate-800 p-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      {aiMode === 'caption' ? 'AI Generated Caption' : 'Creative Ideas'}
                    </h4>
                    <button 
                      onClick={() => copyToClipboard(aiOutput)}
                      className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                    {aiOutput}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Services Grid with Logos */}
        <div className="border-t border-slate-800/50 pt-16">
          <h2 className="text-center text-slate-400 font-medium mb-10 text-sm uppercase tracking-widest">Supported Platforms</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
            {SERVICES.map((service) => (
              <div 
                key={service.slug} 
                className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-slate-900/30 border border-slate-800 hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all group cursor-default h-28"
              >
                <div className="w-8 h-8 relative flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                   {/* Using Simple Icons CDN for reliable SVGs */}
                   <img 
                    src={`https://cdn.simpleicons.org/${service.slug}/white`} 
                    alt={service.name}
                    className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                   />
                   {/* Fallback circle if icon fails */}
                   <div style={{display:'none'}} className="w-8 h-8 rounded-full bg-slate-700"></div>
                </div>
                <span className="text-xs font-medium text-slate-500 group-hover:text-slate-200 transition-colors text-center">
                  {service.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t border-slate-900 pt-8 pb-12 text-center">
          <div className="flex flex-col items-center gap-4">
            {/* WhatsApp Link */}
            <a
              href="https://chat.whatsapp.com/LoafyPWMGOv88oElxdwOB8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium border border-green-500/20"
            >
              <MessageCircle className="w-4 h-4" />
              Join WhatsApp Community
            </a>

            <p className="text-slate-600 text-sm">
              © {new Date().getFullYear()} TeleSocial Downloader. All rights reserved.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default App;
