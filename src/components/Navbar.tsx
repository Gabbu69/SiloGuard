import { Wheat, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
}

export default function Navbar({ isConnected }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 glass-card-static px-4 sm:px-6 py-3 flex items-center justify-between border-b border-rice-500/10">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rice-500 to-rice-700 flex items-center justify-center shadow-lg shadow-rice-500/20">
            <Wheat className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rice-400 status-dot" />
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Smart Rice Storage Monitor
          </h1>
          <p className="text-[11px] text-rice-400/70 font-medium tracking-widest uppercase hidden sm:block">
            SiloGuard • USM IoT Dashboard
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800/80 border border-dark-600/50">
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-rice-500" />
            <span className="text-xs font-medium text-rice-400">Live</span>
            <span className="w-2 h-2 rounded-full bg-rice-500 status-dot" />
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">Offline</span>
            <span className="w-2 h-2 rounded-full bg-red-500" />
          </>
        )}
      </div>
    </nav>
  );
}
