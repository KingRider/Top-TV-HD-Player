
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
      // If there's an existing play promise, we wait for it
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
      if (error.name === 'AbortError') {
        // Expected if play() is interrupted, we can ignore this
        console.log("Play request was aborted (expected behavior during rapid state changes).");
      } else {
        console.error("Playback failed:", error);
      }
      playPromiseRef.current = null;
    }
  }, []);

  const safePause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // If a play is in progress, wait for it to finish before pausing
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch (e) {
        // ignore play errors when we are trying to pause
      }
    }
    video.pause();
  }, []);

  // Sistema de Auto-Hide dos controles
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

  // Check for HLS Library
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
      // Configurações estilo ExoPlayer: Buffering agressivo e baixa latência
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30, // 30 segundos de buffer
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
          // Fallback se o navegador bloquear autoplay com som
          video.muted = true;
          safePlay();
        });
      });

      // Recuperação automática de erros (ExoPlayer behavior)
      hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          console.warn('Fatal error detected, attempting recovery...', data.type);
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
    
    if (videoRef.current.paused) {
      await safePlay();
    } else {
      await safePause();
    }
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
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none"
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      <video 
        ref={videoRef}
        className="w-full h-full object-contain pointer-events-none"
        playsInline
        autoPlay
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
        </div>
      )}

      {/* Overlay de Marca (Permanente) */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10 pointer-events-none">
        <img src={logoUrl} alt="Top TV" className="h-10 md:h-16 drop-shadow-2xl opacity-80" />
      </div>

      {/* Cinematic Controls */}
      <div className={`absolute inset-0 z-30 flex flex-col justify-end transition-opacity duration-500 ease-in-out ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Sombra inferior para legibilidade */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>

        <div className="relative p-6 md:p-12 space-y-6">
          
          {/* Main Control Row */}
          <div className="flex items-center justify-center gap-8">
            <button 
              onClick={refreshStream}
              className="p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all active:scale-90"
              title="Atualizar"
            >
              <RefreshIcon size={32} />
            </button>

            <button 
              onClick={togglePlay}
              className="p-6 rounded-full bg-red-600 hover:bg-red-500 shadow-xl shadow-red-900/20 transition-all active:scale-95 flex items-center justify-center"
            >
              {isPlaying ? <PauseIcon size={48} /> : <PlayIcon size={48} />}
            </button>

            <div className="w-[32px] md:w-[64px]" /> {/* Spacer */}
          </div>

          {/* Progress / Live Indicator */}
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-white/60 text-xs font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                Transmissão ao Vivo
              </span>
              <span>1080p Ultra HD</span>
            </div>
            
            {/* Live Progress Bar (Mimics ExoPlayer) */}
            <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-red-600 w-full animate-[live-progress_10s_linear_infinite]"></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes live-progress {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

// Icons Components
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"></path>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

export default VideoPlayer;
