import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  History, 
  ChevronLeft, 
  Languages, 
  Volume2, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  CloudRain, 
  Loader2,
  Trash2,
  Mic,
  Speaker,
  FlaskConical,
  Sprout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { analyzeImage, translateAnalysis, Language, AnalysisResult } from './services/gemini';
import { ScanHistory, WeatherData } from './types';

// --- Components ---

const DynamicBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div className="absolute inset-0 animate-gradient-bg opacity-50" />
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * 100 + '%', 
            y: Math.random() * 100 + '%',
            opacity: 0.1
          }}
          animate={{ 
            y: [null, '-20px', '20px', '0px'],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ 
            duration: 10 + Math.random() * 10, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute"
        >
          <Sprout className="w-12 h-12 text-primary/20" />
        </motion.div>
      ))}
    </div>
  );
};

const SkeletonLoader = ({ type = 'result' }: { type?: 'result' | 'history' }) => (
  <div className="space-y-6 animate-pulse">
    {type === 'result' ? (
      <>
        <div className="w-full aspect-video rounded-3xl skeleton" />
        <div className="h-32 rounded-3xl skeleton" />
        <div className="space-y-3">
          <div className="h-12 w-full rounded-2xl skeleton" />
          <div className="h-40 w-full rounded-3xl skeleton" />
        </div>
      </>
    ) : (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 w-full rounded-[2rem] skeleton" />
        ))}
      </div>
    )}
  </div>
);

const LanguageSelector = ({ current, onChange }: { current: Language, onChange: (l: Language) => void }) => {
  const langs: { val: Language, label: string }[] = [
    { val: 'en', label: 'EN' },
    { val: 'ta', label: 'TA' },
    { val: 'te', label: 'TE' }
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
      {langs.map(l => (
        <button
          key={l.val}
          onClick={() => onChange(l.val)}
          className={cn(
            "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all duration-300",
            current === l.val 
              ? "bg-white text-primary shadow-sm scale-105" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};

const WeatherWidget = ({ data }: { data: WeatherData | null }) => {
  if (!data) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-[2.5rem] p-6 shadow-sm flex items-center gap-5"
    >
      <div className="bg-white p-4 rounded-[1.5rem] shadow-sm">
        <CloudRain className="w-8 h-8 text-amber-500" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Weather Alert</span>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
        </div>
        <h4 className="font-bold text-slate-800 mt-1">{data.condition} <span className="text-xs font-normal opacity-50">• {data.temp}°C</span></h4>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
          {data.risk === 'High' ? 'Severe weather risk detected. Take immediate action to protect crops.' : 'Moderate weather risk. Monitor your fields closely.'}
        </p>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [screen, setScreen] = useState<'home' | 'scan' | 'result' | 'history'>('home');
  const [language, setLanguage] = useState<Language>('en');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [translatedResult, setTranslatedResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenCharIndex, setSpokenCharIndex] = useState<number>(-1);
  const [spokenLength, setSpokenLength] = useState<number>(0);
  const [isTranslating, setIsTranslating] = useState(false);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'symptoms' | 'treatment' | 'prevention'>('symptoms');

  // Pre-load voices for TTS reliability
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load weather
  useEffect(() => {
    // Mock weather data
    setTimeout(() => {
      setWeather({
        condition: 'Cloudy',
        temp: 28,
        risk: 'High humidity detected. Risk of fungal diseases like Powdery Mildew is elevated. Monitor leaves closely.',
        location: 'Current Location'
      });
    }, 1500);
  }, []);

  // Load history
  useEffect(() => {
    const saved = localStorage.getItem('agroai_history');
    if (saved) setHistory(JSON.parse(saved));
    
    // Fetch weather
    fetch('/api/weather')
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error("Weather fetch failed", err));
  }, []);

  // Automatic translation when language changes
  useEffect(() => {
    const handleTranslation = async () => {
      if (!result) return;
      
      if (language === 'en') {
        setTranslatedResult(null);
        return;
      }

      setIsTranslating(true);
      try {
        const translated = await translateAnalysis(result, language);
        setTranslatedResult(translated);
      } catch (err) {
        console.error("Translation failed", err);
      } finally {
        setIsTranslating(false);
      }
    };

    handleTranslation();
  }, [language, result]);

  // Handle camera stream when screen changes to 'scan'
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCameraStream = async () => {
      if (screen === 'scan') {
        setCameraError(null);
        try {
          const streamResponse = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          stream = streamResponse;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access failed", err);
          setCameraError("Camera access denied or not available. Please check permissions.");
          setTimeout(() => setScreen('home'), 3000);
        }
      }
    };

    startCameraStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [screen]);

  const saveToHistory = (res: AnalysisResult, img: string) => {
    const newEntry: ScanHistory = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      image: img,
      result: res,
      language: language
    };
    const updated = [newEntry, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('agroai_history', JSON.stringify(updated));
  };

  const startCamera = () => {
    setScreen('scan');
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Ensure video is ready and has dimensions
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setImage(dataUrl);
          processImage(dataUrl);
        }
      } else {
        console.warn("Video not ready for capture. Current state:", video.readyState);
        // Fallback: try to capture anyway if it's at least playing
        if (video.currentTime > 0) {
          const context = canvas.getContext('2d');
          if (context) {
            canvas.width = video.clientWidth || 640;
            canvas.height = video.clientHeight || 480;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setImage(dataUrl);
            processImage(dataUrl);
          }
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImage(dataUrl);
        processImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imgData: string) => {
    setLoading(true);
    try {
      const analysis = await analyzeImage(imgData);
      setResult(analysis);
      // Translation is now handled by useEffect
      saveToHistory(analysis, imgData);
      setScreen('result');
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Please try again.");
      setScreen('home');
    } finally {
      setLoading(false);
    }
  };

  const speakResult = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpokenCharIndex(-1);
      return;
    }

    const res = translatedResult || result;
    if (!res) return;

    const textToSpeak = res.rawMarkdown.replace(/[#*`]/g, '').replace(/\n/g, '. ');
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    if (language === 'ta') utterance.lang = 'ta-IN';
    else if (language === 'te') utterance.lang = 'te-IN';
    else utterance.lang = 'en-US';

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setSpokenCharIndex(event.charIndex);
        setSpokenLength(event.charLength);
      }
    };

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpokenCharIndex(-1);
    };

    window.speechSynthesis.speak(utterance);
  };

  const renderHighlightedText = (text: string, index: number, length: number) => {
    if (index === -1) return <ReactMarkdown>{text}</ReactMarkdown>;
    
    const strippedText = text.replace(/[#*`]/g, '');
    const before = strippedText.substring(0, index);
    const highlight = strippedText.substring(index, index + length);
    const after = strippedText.substring(index + length);

    return (
      <div className="relative">
        <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm">
          {before}
          <motion.span 
            initial={{ backgroundColor: 'transparent' }}
            animate={{ backgroundColor: '#fef08a' }}
            className="text-slate-900 font-bold rounded px-1 transition-all duration-200 shadow-sm"
          >
            {highlight}
          </motion.span>
          {after}
        </div>
        {isSpeaking && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3"
          >
            <div className="w-2 h-2 bg-green-600 rounded-full animate-ping" />
            <p className="text-[10px] font-bold text-green-800 uppercase tracking-wider">Reading analysis aloud...</p>
          </motion.div>
        )}
      </div>
    );
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('agroai_history', JSON.stringify(updated));
  };

  const openHistoryItem = (item: ScanHistory) => {
    setImage(item.image);
    setResult(item.result);
    setLanguage(item.language);
    setTranslatedResult(null); // Will be re-translated by useEffect if needed
    setScreen('result');
  };

  return (
    <div className="min-h-screen font-sans text-slate-900 pb-24 relative">
      <DynamicBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 px-6 py-4 flex justify-between items-center shadow-sm">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setScreen('home')}
        >
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Agro<span className="text-primary">AI</span></h1>
        </motion.div>
        <LanguageSelector current={language} onChange={setLanguage} />
      </header>

      <main className="max-w-md mx-auto px-6 pt-6">
        <AnimatePresence mode="wait">
          {/* Home Screen */}
          {screen === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="space-y-8"
            >
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-primary to-primary-dark rounded-[2.5rem] p-8 text-white shadow-2xl shadow-primary/30 overflow-hidden relative"
              >
                <div className="relative z-10">
                  <h2 className="text-3xl font-bold leading-tight">Protect Your <br/>Crops with AI</h2>
                  <p className="mt-3 text-white/80 text-sm font-medium">Instant disease detection and expert treatment advice.</p>
                </div>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -right-12 -bottom-12 opacity-10"
                >
                  <CheckCircle2 className="w-56 h-56" />
                </motion.div>
              </motion.div>

              <div className="grid grid-cols-2 gap-5">
                <motion.button 
                  whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startCamera}
                  className="glass-card rounded-[2rem] p-6 flex flex-col items-center gap-4 border border-white/40 ripple group"
                >
                  <div className="bg-primary/10 p-4 rounded-2xl group-hover:bg-primary/20 transition-colors">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <span className="font-bold text-slate-800">Scan Crop</span>
                </motion.button>

                <motion.button 
                  whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="glass-card rounded-[2rem] p-6 flex flex-col items-center gap-4 border border-white/40 ripple group"
                >
                  <div className="bg-slate-100 p-4 rounded-2xl group-hover:bg-slate-200 transition-colors">
                    <Upload className="w-8 h-8 text-slate-600" />
                  </div>
                  <span className="font-bold text-slate-700">Upload</span>
                </motion.button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <WeatherWidget data={weather} />
              <div className="space-y-5">
                <div className="flex justify-between items-center px-2">
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> Recent Scans
                  </h3>
                  <button onClick={() => setScreen('history')} className="text-sm font-bold text-primary hover:underline">View All</button>
                </div>
                
                <div className="space-y-4">
                  {history.slice(0, 3).map(item => (
                    <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.9)" }}
                      onClick={() => openHistoryItem(item)}
                      className="glass-card p-4 rounded-[2rem] border border-white/40 flex items-center gap-4 ripple"
                    >
                      <div className="relative">
                        <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" alt="Scan" />
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                          item.result.severity === 'Healthy' ? "bg-green-500" :
                          item.result.severity === 'Medium' ? "bg-amber-500" :
                          "bg-red-500"
                        )} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-slate-800">{item.result.crop || 'Unknown Crop'}</h4>
                        <p className="text-xs text-slate-500 font-medium">{item.result.disease || 'Healthy'}</p>
                      </div>
                      <div className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                        item.result.severity === 'Healthy' ? "bg-green-100 text-green-700" :
                        item.result.severity === 'Medium' ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {item.result.severity}
                      </div>
                    </motion.div>
                  ))}
                  {history.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-[2rem] border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-medium italic">No scans yet. Start by scanning a crop!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Scan Screen */}
          {screen === 'scan' && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black"
            >
              <div className="absolute top-8 left-8 z-[70]">
                <button 
                  onClick={() => { stopCamera(); setScreen('home'); }}
                  className="bg-white/10 backdrop-blur-xl p-4 rounded-2xl text-white shadow-2xl border border-white/10 btn-press"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>

              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover z-10"
              />
              
              {cameraError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-10 text-center">
                  <div className="bg-white rounded-[2.5rem] p-8 space-y-5 premium-shadow">
                    <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-bold text-xl text-slate-800">{cameraError}</p>
                      <p className="text-sm text-slate-500 font-medium">Returning to home screen...</p>
                    </div>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />

              {/* Capture Button Container */}
              <div className="absolute bottom-12 left-0 right-0 z-30 flex flex-col items-center gap-6 pointer-events-none">
                <div className="bg-black/20 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
                  <p className="text-white text-xs font-bold tracking-widest uppercase drop-shadow-md">
                    Align crop and capture
                  </p>
                </div>

                <button 
                  onClick={captureImage}
                  disabled={loading}
                  className={cn(
                    "w-24 h-24 bg-white rounded-full border-[6px] border-white/30 flex items-center justify-center transition-all shadow-[0_0_40px_rgba(255,255,255,0.4)] pointer-events-auto btn-press",
                    loading ? "opacity-50 scale-90" : "hover:scale-105"
                  )}
                >
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                    loading ? "bg-slate-400" : "bg-primary shadow-inner"
                  )}>
                    {loading ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <div className="w-6 h-6 bg-white rounded-full shadow-sm" />
                    )}
                  </div>
                </button>
              </div>
              
              {/* Corner Guides */}
              <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/30 rounded-[3rem] relative overflow-hidden">
                  {/* Scanning Line */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary/60 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-scan z-30" />
                  <div className="absolute inset-0 bg-primary/5 animate-pulse-soft" />
                  
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Result Screen */}
          {screen === 'result' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-10"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setScreen('home')}
                  className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-xl">Analysis Result</h2>
              </div>

              {loading || isTranslating ? (
                <div className="space-y-6">
                  <SkeletonLoader type="result" />
                </div>
              ) : result && (
                <div className="space-y-6">
                  {/* Image Preview */}
                  <div className="relative rounded-3xl overflow-hidden shadow-lg aspect-video bg-slate-200">
                    <img src={image!} className="w-full h-full object-cover" alt="Captured" />
                    
                    {/* Focus Area Overlay */}
                    {result.focusArea && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute border-2 border-red-500 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.6)] pointer-events-none"
                        style={{
                          left: `${result.focusArea.x}%`,
                          top: `${result.focusArea.y}%`,
                          width: `${result.focusArea.width}%`,
                          height: `${result.focusArea.height}%`,
                        }}
                      >
                        <div className="absolute -top-8 left-0 bg-red-500/90 backdrop-blur-md text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-lg">
                          Affected Area
                        </div>
                      </motion.div>
                    )}

                    <div className="absolute top-4 right-4">
                      <button 
                        onClick={speakResult}
                        className={cn(
                          "p-4 rounded-2xl shadow-2xl backdrop-blur-md transition-all btn-press",
                          isSpeaking ? "bg-red-500 text-white animate-pulse" : "bg-white/90 text-primary"
                        )}
                      >
                        {isSpeaking ? <Mic className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>

                  {/* Weather Alert if high risk */}
                  {weather && weather.risk === 'High' && (
                    <WeatherWidget data={weather} />
                  )}
                  
                  {/* Disease Card */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className={cn(
                      "rounded-3xl p-6 border-l-8 shadow-sm glass-card",
                      (translatedResult || result).severity === 'Healthy' ? "border-green-500" :
                      (translatedResult || result).severity === 'Medium' ? "border-amber-500" :
                      "border-red-500"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                          {(translatedResult || result).healthStatus}
                        </span>
                        <h3 className="text-2xl font-bold mt-1">
                          {(translatedResult || result).disease === 'None' ? (translatedResult || result).crop : (translatedResult || result).disease}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold opacity-60">Confidence</span>
                        <div className="text-xl font-black">{(translatedResult || result).confidence}%</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(translatedResult || result).confidence}%` }}
                        className={cn(
                          "h-full rounded-full",
                          (translatedResult || result).severity === 'Healthy' ? "bg-green-500" :
                          (translatedResult || result).severity === 'Medium' ? "bg-amber-500" :
                          "bg-red-500"
                        )}
                      />
                    </div>
                  </motion.div>

                  {/* Tabs / Content */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card rounded-3xl border border-white/40 shadow-sm overflow-hidden"
                  >
                    <div className="flex border-b border-slate-100">
                      {(['symptoms', 'treatment', 'prevention'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            "flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all",
                            activeTab === tab 
                              ? "text-green-600 bg-green-50/50 border-b-2 border-green-600" 
                              : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="p-6">
                      <div className="prose prose-sm max-w-none">
                        {activeTab === 'symptoms' && (
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              Symptoms Observed
                            </h4>
                            <div className="text-slate-600 text-sm leading-relaxed">
                              {(translatedResult || result).symptoms}
                            </div>
                          </div>
                        )}
                        {activeTab === 'treatment' && (
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                Treatment Steps
                              </h4>
                              <ul className="space-y-3">
                                {(translatedResult || result).treatment.map((step, i) => (
                                  <li key={i} className="flex gap-3 text-sm text-slate-600">
                                    <span className="flex-shrink-0 w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                                      {i + 1}
                                    </span>
                                    {step}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* New Agricultural Recommendations */}
                            {(translatedResult || result).fertilizers && (translatedResult || result).fertilizers!.length > 0 && (
                              <div className="space-y-3 pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                  <FlaskConical className="w-3 h-3" />
                                  Recommended Fertilizers
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {(translatedResult || result).fertilizers!.map((item, i) => (
                                    <span key={i} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[11px] font-medium border border-blue-100">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(translatedResult || result).organic && (translatedResult || result).organic!.length > 0 && (
                              <div className="space-y-3 pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                  <Sprout className="w-3 h-3" />
                                  Organic Solutions
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {(translatedResult || result).organic!.map((item, i) => (
                                    <span key={i} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-[11px] font-medium border border-green-100">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(translatedResult || result).chemical && (translatedResult || result).chemical!.length > 0 && (
                              <div className="space-y-3 pt-2 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chemical Solutions</h4>
                                <div className="flex flex-wrap gap-2">
                                  {(translatedResult || result).chemical!.map((item, i) => (
                                    <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-[11px] font-medium border border-red-100">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {activeTab === 'prevention' && (
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <Info className="w-4 h-4 text-blue-500" />
                              Prevention Tips
                            </h4>
                            <div className="text-slate-600 text-sm leading-relaxed">
                              {(translatedResult || result).prevention}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {weather && weather.risk.includes('High') && (
                    <WeatherWidget data={weather} />
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setScreen('home')}
                      className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-[2rem] font-bold btn-press"
                    >
                      Done
                    </button>
                    <button 
                      onClick={startCamera}
                      className="flex-[1.5] bg-primary text-white py-4 rounded-[2rem] font-bold shadow-xl shadow-primary/20 btn-press flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Scan Again
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* History Screen */}
          {screen === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setScreen('home')}
                  className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-xl text-slate-800">Scan History</h2>
              </div>

              <div className="space-y-5">
                {history.map((item, i) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,0.9)" }}
                    onClick={() => openHistoryItem(item)}
                    className="glass-card p-5 rounded-[2.5rem] border border-white/40 flex items-center gap-5 ripple relative overflow-hidden group"
                  >
                    <div className="relative">
                      <img src={item.image} className="w-24 h-24 rounded-[1.5rem] object-cover" alt="Scan" />
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white",
                        item.result.severity === 'Healthy' ? "bg-green-500" :
                        item.result.severity === 'Medium' ? "bg-amber-500" :
                        "bg-red-500"
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-lg text-slate-800">{item.result.crop || 'Unknown'}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 font-medium mt-1">{item.result.disease || 'Healthy'}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter",
                          item.result.severity === 'Healthy' ? "bg-green-100 text-green-700" :
                          item.result.severity === 'Medium' ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {item.result.severity}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}

                {history.length === 0 && (
                  <div className="text-center py-24 glass-card rounded-[2.5rem] border border-dashed border-white/40">
                    <History className="w-20 h-20 mx-auto text-slate-200 mb-4" />
                    <p className="text-xl font-bold text-slate-800">No history found</p>
                    <p className="text-sm text-slate-400 mt-1">Your scanned crops will appear here.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 px-10 py-4 flex justify-around items-center z-40 premium-shadow">
        <button 
          onClick={() => setScreen('home')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300 btn-press", 
            screen === 'home' ? "text-primary scale-110" : "text-slate-300"
          )}
        >
          <div className={cn(
            "p-2 rounded-2xl transition-colors",
            screen === 'home' ? "bg-primary/10" : "bg-transparent"
          )}>
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>

        <button 
          onClick={startCamera}
          className="relative -top-8 bg-primary p-5 rounded-[2rem] text-white shadow-2xl shadow-primary/40 border-4 border-white btn-press"
        >
          <Camera className="w-8 h-8" />
        </button>

        <button 
          onClick={() => setScreen('history')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-300 btn-press", 
            screen === 'history' ? "text-primary scale-110" : "text-slate-300"
          )}
        >
          <div className={cn(
            "p-2 rounded-2xl transition-colors",
            screen === 'history' ? "bg-primary/10" : "bg-transparent"
          )}>
            <History className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
        </button>
      </nav>
    </div>
  );
}
