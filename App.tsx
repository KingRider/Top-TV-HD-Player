
import React, { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import LoadingScreen from './components/LoadingScreen';

const STREAM_URL = 'https://isaocorp.cloudecast.com/toptv/index.m3u8';
const LOGO_URL = 'https://i.imgur.com/oyiG5iZ.png';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial delay to show the brand loading screen
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      {isLoading ? (
        <LoadingScreen logoUrl={LOGO_URL} />
      ) : (
        <div className="w-full h-full animate-in fade-in zoom-in-95 duration-1000">
          <VideoPlayer 
            src={STREAM_URL} 
            logoUrl={LOGO_URL} 
          />
        </div>
      )}

      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-900 blur-[150px] rounded-full" />
      </div>
    </div>
  );
};

export default App;
