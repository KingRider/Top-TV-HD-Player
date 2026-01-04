
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: any;

    const startPlayback = () => {
      // Forçar o play e tentar tirar o mudo (navegadores podem bloquear som sem interação)
      video.play().catch(e => {
        console.log("Autoplay necessita de interação para áudio ou política do navegador.", e);
      });
    };

    if (window.Hls.isSupported()) {
      hls = new window.Hls({
        capLevelToPlayerSize: true,
        debug: false,
        enableWorker: true
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            default:
              hls.recoverMediaError();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', startPlayback);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {error && (
        <div className="absolute z-50 inset-0 flex flex-col items-center justify-center bg-black text-center p-10">
          <p className="text-white text-xl">{error}</p>
        </div>
      )}

      <video 
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        muted={false} /* Tenta iniciar com som para TV Box */
      />

      {/* Overlay de Marca (Sem Controles) */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-10">
        
        {/* Top Bar Branding */}
        <div className="w-full flex items-start justify-between">
          <img src={logoUrl} alt="Top TV" className="h-12 md:h-20 drop-shadow-lg object-contain" />
          
          <div className="flex flex-col items-end gap-2">
            <span className="flex items-center gap-2 px-4 py-1 bg-red-600 text-white text-sm md:text-lg font-black rounded-full animate-pulse shadow-lg">
              <span className="w-2 h-2 md:w-3 md:h-3 bg-white rounded-full"></span>
              AO VIVO
            </span>
          </div>
        </div>

        {/* Info Inferior Discreta */}
        <div className="w-full flex justify-end">
          <span className="text-white/30 text-xs md:text-sm font-bold tracking-widest uppercase">
            Top TV Digital HD
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
