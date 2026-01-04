
import React, { useEffect, useRef, useState, useCallback } from 'react';

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
  const hlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hlsReady, setHlsReady] = useState(false);

  // Safe Play utility to prevent "interrupted by pause" errors
  const safePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (playPromiseRef.current) {
        await playPromiseRef.current;
      }
      
      const promise = video.play();
      if (promise !== undefined) {
        playPromiseRef.current = promise;
        await promise;
        playPromiseRef.current = null;
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Playback failed:", error);
      }
      playPromiseRef.current = null;
    }
  }, []);

  const safePause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch (e) {}
    }
    video.pause();
  }, []);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  const handleActivity = () => {
    setShowControls(true);
    hideControlsAfterDelay();
  };

  useEffect(() => {
    const checkHls = () => {
      if (window.Hls) setHlsReady(true);
      else setTimeout(checkHls, 100);
    };
    checkHls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const initPlayer = useCallback(() => {
    if (!hlsReady || !videoRef.current) return;

    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const Hls = window.Hls;
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        manifestLoadingMaxRetry: Infinity,
        levelLoadingMaxRetry: Infinity,
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        safePlay().catch(() => {
          video.muted = true;
          safePlay();
        });
      });

      hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              initPlayer();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      const onMetadata = () => {
        safePlay();
        video.removeEventListener('loadedmetadata', onMetadata);
      };
      video.addEventListener('loadedmetadata', onMetadata);
    }
  }, [src, hlsReady, safePlay]);

  useEffect(() => {
    initPlayer();
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
    };
  }, [initPlayer]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) await safePlay();
    else await safePause();
    handleActivity();
  };

  const refreshStream = (e: React.MouseEvent) => {
    e.stopPropagation();
    initPlayer();
    handleActivity();
  };

  const toggleRotation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (document.fullscreenElement) {
        const orientation = screen.orientation.type.includes('portrait') ? 'landscape' : 'portrait';
        await (screen.orientation as any).lock(orientation);
      } else {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          await (screen.orientation as any).lock('landscape');
        }
      }
    } catch (err) {
      console.warn("Rotação não suportada ou bloqueada pelo navegador:", err);
    }
    handleActivity();
  };

  return (
    <div 
      ref={containerRef}
      onClick={handleActivity}
      onMouseMove={handleActivity}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      <video 
        ref={videoRef}
        className="w-full h-full object-contain pointer-events-none"
        playsInline
        autoPlay
      />

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      )}

      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10 pointer-events-none">
        <img src={logoUrl} alt="Top TV" className="h-10 md:h-16 drop-shadow-2xl opacity-80" />
      </div>

      <div className={`absolute inset-0 z-30 flex flex-col justify-end transition-opacity duration-500 ease-in-out ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>

        <div className="relative p-6 md:p-12 space-y-8">
          
          {/* Layout de Controles Centralizado */}
          <div className="flex items-center justify-between w-full max-w-6xl mx-auto px-2">
            
            {/* Esquerda: Ferramentas (flex-1 para empurrar o centro) */}
            <div className="flex flex-1 items-center gap-3 md:gap-4 justify-start">
              <button 
                onClick={refreshStream}
                className="p-3.5 md:p-4 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 transition-all active:scale-90 group"
                title="Atualizar"
              >
                <RefreshIcon size={24} />
              </button>

              <button 
                onClick={toggleRotation}
                className="p-3.5 md:p-4 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 transition-all active:scale-90 group"
                title="Girar Tela"
              >
                <RotateIcon size={24} />
              </button>
            </div>

            {/* Centro: Play/Pause Principal (flex-none) */}
            <div className="flex flex-none items-center justify-center">
              <button 
                onClick={togglePlay}
                className="p-6 md:p-8 rounded-full bg-red-600 hover:bg-red-500 shadow-[0_0_30px_rgba(220,38,38,0.3)] shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center transform hover:scale-105"
              >
                {isPlaying ? <PauseIcon size={44} /> : <PlayIcon size={44} />}
              </button>
            </div>

            {/* Direita: Espaço Vazio para Simetria (flex-1) */}
            <div className="flex flex-1 justify-end opacity-0 pointer-events-none hidden md:flex">
              <div className="p-4 w-[116px]"></div> {/* Compensa o tamanho dos botões da esquerda */}
            </div>
            {/* Mobile spacer if needed */}
            <div className="flex flex-1 md:hidden"></div>
          </div>

          <div className="w-full max-w-6xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
                Top TV Live Stream
              </span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[9px]">AUTO 1080P</span>
            </div>
            
            <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-red-600 w-full animate-[live-progress_8s_linear_infinite]"></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes live-progress {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

const PlayIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const RefreshIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500">
    <path d="M23 4v6h-6"></path>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

const RotateIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 12a11 11 0 0 1-22 0 11 11 0 0 1 22 0z" opacity="0.2"></path>
    <path d="M15 3h6v6"></path>
    <path d="M9 21H3v-6"></path>
    <path d="M21 3l-7 7"></path>
    <path d="M3 21l7-7"></path>
  </svg>
);

export default VideoPlayer;
