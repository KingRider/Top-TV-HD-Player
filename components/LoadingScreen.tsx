
import React from 'react';

interface LoadingScreenProps {
  logoUrl: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ logoUrl }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="relative group">
        {/* Glow effect removed as requested */}
        
        {/* The rotating logo with original colors */}
        <div className="relative animate-slow-spin">
          <img 
            src={logoUrl} 
            alt="Loading..." 
            className="w-32 h-32 md:w-48 md:h-48 object-contain transition-transform"
          />
        </div>
      </div>
      
      <div className="mt-12 flex flex-col items-center">
        <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }}></div>
        </div>
        <p className="mt-4 text-zinc-500 text-sm font-light tracking-[0.2em] uppercase animate-pulse">
          Iniciando Top TV HD
        </p>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
