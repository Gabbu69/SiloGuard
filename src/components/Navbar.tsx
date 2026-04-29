import { Printer } from 'lucide-react';

interface NavbarProps {
  isConnected: boolean;
  onPrint: () => void;
}

export default function Navbar({ isConnected, onPrint }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 glass-card-static px-4 sm:px-6 py-3 flex items-center justify-between border-b border-rice-500/10">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl overflow-hidden shadow-lg shadow-rice-500/20 border border-rice-500/20">
            <img
              src="/logo.png"
              alt="SiloGuard Logo"
              className="w-full h-full object-cover"
            />
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

      {/* Right Side Actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Print Button */}
        <button
          onClick={onPrint}
          className="group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 bg-dark-700/80 hover:bg-rice-600 text-white text-xs font-semibold rounded-full border border-dark-600 hover:border-rice-500 transition-all duration-300 shadow-lg hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] backdrop-blur-md"
        >
          <Printer className="w-3.5 h-3.5 text-rice-400 group-hover:text-white group-hover:animate-bounce" />
          <span className="tracking-wide hidden sm:block">Generate Report</span>
          <span className="tracking-wide sm:hidden">Report</span>
        </button>

        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-800/80 border border-dark-600/50">
          {isConnected ? (
            <>
              <span className="text-xs font-medium text-rice-400">Live</span>
              <span className="w-2 h-2 rounded-full bg-rice-500 status-dot" />
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-red-400">Offline</span>
              <span className="w-2 h-2 rounded-full bg-red-500" />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
