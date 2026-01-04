
import Hls from '../hls.js'; // Correct import
import React, { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  logoUrl: string;
}

declare global {
  interface Window {
    Hls: any;
  }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, logoUrl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sistema de controles por teclado (D-Pad da TV)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Mostrar controles em qualquer tecla
      handleActivity();

      switch(e.key) {
        case 'Enter':
        case ' ':
          togglePlay();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'Escape':
        case 'Back':
        case 'Backspace':
          // Lógica de voltar (se necessário)
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: any;

    const startPlayback = () => {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(e => {
        console.log("Autoplay blocked, waiting for user interaction", e);
      });
    };

    if (window.Hls.isSupported()) {
      hls = new window.Hls({
        capLevelToPlayerSize: true,
        debug: false,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              setError("Erro de Rede: Verifique sua internet.");
              hls.startLoad();
              break;
            default:
              setError("Erro ao carregar canal. Tentando recuperar...");
              hls.recoverMediaError();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', startPlayback);
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Auto-foco no botão para o controle remoto funcionar de imediato
    if (playButtonRef.current) playButtonRef.current.focus();

    return () => {
      if (hls) hls.destroy();
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [src]);

  const handleActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 5000); // 5 segundos para TV é melhor
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleActivity}
      onClick={togglePlay}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
    >
      {error && (
        <div className="absolute z-50 inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-10">
          <h2 className="text-red-500 text-4xl font-black mb-6">ALERTA DE TRANSMISSÃO</h2>
          <p className="text-white text-2xl mb-10">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="focusable px-12 py-4 bg-red-600 text-white text-xl font-bold rounded-lg transition-all"
          >
            RECARREGAR PLAYER
          </button>
        </div>
      )}

      <video 
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        muted={isMuted}
      />

      {/* Overlay UI otimizada para TV */}
      <div className={`absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-700 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Top Bar - Safe Area */}
        <div className="w-full p-10 flex items-start justify-between bg-gradient-to-b from-black/90 to-transparent">
          <img src={logoUrl} alt="Top TV" className="h-16 md:h-24 drop-shadow-2xl" />
          <div className="flex flex-col items-end gap-4">
            <span className="flex items-center gap-4 px-6 py-2 bg-red-600 text-white text-xl font-black rounded-full animate-pulse shadow-lg">
              <span className="w-4 h-4 bg-white rounded-full"></span>
              AO VIVO
            </span>
            <span className="text-white/60 text-lg font-bold">1080p Ultra HD</span>
          </div>
        </div>

        {/* Middle Play State Notification (Só visível se pausado) */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-12 rounded-full bg-red-600/20 backdrop-blur-xl border-4 border-white/20 animate-bounce">
              <PlayIcon size={120} />
            </div>
          </div>
        )}

        {/* Bottom Controls - Safe Area */}
        <div className="w-full p-10 bg-gradient-to-t from-black/90 to-transparent">
          <div className="glass-panel rounded-[30px] p-8 flex items-center justify-between gap-10 max-w-7xl mx-auto">
            
            <div className="flex items-center gap-10">
              <button 
                ref={playButtonRef}
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="focusable text-white transition-all p-2 rounded-xl"
              >
                {isPlaying ? <PauseIcon size={56} /> : <PlayIcon size={56} />}
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="focusable text-white transition-all p-2 rounded-xl"
              >
                {isMuted ? <MutedIcon size={56} /> : <VolumeIcon size={56} />}
              </button>

              <div className="h-16 w-1 bg-white/20" />
              
              <div className="flex flex-col">
                <span className="text-white text-3xl font-black tracking-tight">CANAL TOP TV HD</span>
                <span className="text-red-500 text-xl font-bold uppercase tracking-[0.3em] mt-1">Transmissão Digital</span>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-10">
              <div className="text-right">
                <div className="text-white/40 text-sm font-bold uppercase tracking-widest">Status da Rede</div>
                <div className="text-green-500 text-xl font-black italic">CONEXÃO ESTÁVEL</div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="focusable text-white transition-all p-2 rounded-xl"
              >
                <FullscreenIcon size={56} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// Ícones maiores para TV
const PlayIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
);

const MutedIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <line x1="23" y1="9" x2="17" y2="15"></line>
    <line x1="17" y1="9" x2="23" y2="15"></line>
  </svg>
);

const FullscreenIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
    <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
    <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
    <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
  </svg>
);

export default VideoPlayer;
