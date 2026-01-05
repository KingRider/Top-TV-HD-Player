
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
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hlsReady, setHlsReady] = useState(false);

  // Tenta travar em landscape automaticamente se suportado
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          await (screen.orientation as any).lock('landscape');
        }
      } catch (err) {
        console.warn("Não foi possível travar a orientação automaticamente:", err);
      }
    };
    lockLandscape();
  }, []);

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
      playPromiseRef.current = null;
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
        console.error("Playback failed:", error);
      }
      throw error;
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
          setShowControls(true);
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
        safePlay().catch(() => setShowControls(true));
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
    const onVolumeChange = () => setIsMuted(video.muted || video.volume === 0);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [initPlayer]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      await safePlay();
    } else {
      await safePause();
    }
    handleActivity();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    handleActivity();
  };

  const refreshStream = (e: React.MouseEvent) => {
    e.stopPropagation();
    initPlayer();
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
        muted={isMuted}
      />

      {/* Indicador de Buffering Elaborado */}
      {isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-black/30 backdrop-blur-[2px]">
          <div className="flex items-end gap-1.5 h-12 mb-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div 
                key={i}
                className="w-1.5 bg-red-600 rounded-full animate-wave"
                style={{ 
                  animationDelay: `${i * 0.15}s`,
                  height: '100%'
                }}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-white/80 text-[10px] md:text-xs font-black tracking-[0.4em] uppercase animate-pulse">
              Buffering
            </span>
            <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-red-600/50 w-full animate-progress-ind"></div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10 pointer-events-none">
        <img src={logoUrl} alt="Top TV" className="h-10 md:h-16 drop-shadow-2xl opacity-80" />
      </div>

      {isPlaying && isMuted && showControls && (
        <button 
          onClick={toggleMute}
          className="absolute top-6 right-6 md:top-10 md:right-10 z-40 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 animate-in slide-in-from-right duration-300"
        >
          <MuteIcon size={18} />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white">Sem Áudio - Toque para Ativar</span>
        </button>
      )}

      <div className={`absolute inset-0 z-30 flex flex-col justify-end transition-opacity duration-500 ease-in-out ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>

        <div className="relative p-6 md:p-12 space-y-8">
          
          <div className="flex items-center justify-between w-full max-w-6xl mx-auto px-2">
            
            {/* Esquerda: Ferramentas (Refresh e Mute) */}
            <div className="flex flex-1 items-center gap-3 md:gap-4 justify-start">
              <button 
                onClick={refreshStream}
                className="p-3.5 md:p-4 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 transition-all active:scale-90 group"
                title="Atualizar"
              >
                <RefreshIcon size={24} />
              </button>
              
              <button 
                onClick={toggleMute}
                className="p-3.5 md:p-4 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 transition-all active:scale-90 group"
                title={isMuted ? "Ativar Áudio" : "Mutar"}
              >
                {isMuted ? <MuteIcon size={24} /> : <VolumeIcon size={24} />}
              </button>
            </div>

            {/* Centro: Play/Pause Principal Centralizado */}
            <div className="flex flex-none items-center justify-center">
              <button 
                onClick={togglePlay}
                className="p-6 md:p-8 rounded-full bg-red-600 hover:bg-red-500 shadow-[0_0_30px_rgba(220,38,38,0.3)] shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center transform hover:scale-105"
              >
                {isPlaying ? <PauseIcon size={44} /> : <PlayIcon size={44} />}
              </button>
            </div>

            {/* Direita: Espaçador para simetria visual */}
            <div className="flex flex-1 justify-end opacity-0 pointer-events-none hidden md:flex">
              <div className="p-4 w-[120px]"></div> 
            </div>
            <div className="flex flex-1 md:hidden"></div>
          </div>

          <div className="w-full max-w-6xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
                Top TV Live Stream
              </span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[9px]">HD 1080P</span>
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
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes progress-ind {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-wave {
          animation: wave 1.2s ease-in-out infinite;
          transform-origin: bottom;
        }
        .animate-progress-ind {
          animation: progress-ind 1.5s ease-in-out infinite;
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

const VolumeIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
);

const MuteIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <line x1="23" y1="9" x2="17" y2="15"></line>
    <line x1="17" y1="9" x2="23" y2="15"></line>
  </svg>
);

export default VideoPlayer;
