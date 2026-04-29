import { Bell, Fan, Volume2, AlertTriangle } from 'lucide-react';
import { formatTimestamp } from '../lib/thresholds';
import type { Alert } from '../lib/supabase';

interface AlertsPanelProps {
  alerts: Alert[];
  isLoading: boolean;
}

function getAlertIcon(type: string) {
  switch (type) {
    case 'Fan Activated':
      return <Fan className="w-4 h-4" />;
    case 'Buzzer Triggered':
      return <Volume2 className="w-4 h-4" />;
    case 'Threshold Exceeded':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function getAlertStyles(type: string) {
  switch (type) {
    case 'Fan Activated':
      return {
        borderClass: 'border-l-blue-500',
        bgClass: 'bg-gradient-to-r from-blue-500/10 to-transparent',
        iconWrapper: 'text-blue-400 bg-blue-500/10 ring-1 ring-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
      };
    case 'Buzzer Triggered':
      return {
        borderClass: 'border-l-red-500',
        bgClass: 'bg-gradient-to-r from-red-500/10 to-transparent',
        iconWrapper: 'text-red-400 bg-red-500/10 ring-1 ring-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
      };
    case 'Threshold Exceeded':
      return {
        borderClass: 'border-l-amber-500',
        bgClass: 'bg-gradient-to-r from-amber-500/10 to-transparent',
        iconWrapper: 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
      };
    default:
      return {
        borderClass: 'border-l-slate-500',
        bgClass: 'bg-gradient-to-r from-slate-500/10 to-transparent',
        iconWrapper: 'text-slate-400 bg-slate-500/10 ring-1 ring-slate-500/30 shadow-[0_0_15px_rgba(148,163,184,0.15)]'
      };
  }
}

export default function AlertsPanel({ alerts, isLoading }: AlertsPanelProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6 h-full">
        <div className="flex items-center gap-2 mb-6">
          <div className="skeleton w-6 h-6 rounded-md" />
          <div className="skeleton h-5 w-32 rounded-md" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 h-full flex flex-col fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500/10 rounded-lg ring-1 ring-amber-500/20">
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">
            Recent Alerts
          </h3>
        </div>
        {alerts.length > 0 && (
          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full font-bold border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
            {alerts.length} NEW
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-500">
            <div className="p-4 rounded-full bg-dark-600/20 mb-3 ring-1 ring-dark-600/30">
              <Bell className="w-8 h-8 opacity-40" />
            </div>
            <span className="text-sm font-medium">No alerts triggered</span>
            <span className="text-xs text-slate-600 mt-1">All systems operating normally</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const styles = getAlertStyles(alert.type);
            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl bg-dark-800/60 border border-dark-600/40 hover:border-dark-600/80 hover:bg-dark-700/50 transition-all duration-300 border-l-[4px] ${styles.borderClass} ${styles.bgClass}`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${styles.iconWrapper}`}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold text-slate-200 truncate">
                      {alert.type}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap bg-dark-900/50 px-2 py-0.5 rounded-md border border-dark-600/30">
                      {formatTimestamp(alert.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      Sensor: <span className="text-slate-200 font-semibold">{alert.sensor}</span>
                    </span>
                    <span className="text-[10px] text-dark-400">•</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      Value: <span className="text-slate-200 font-semibold">{alert.value?.toFixed(1)}</span>
                    </span>
                    <span className="text-[10px] text-dark-400">•</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      MRI: <span className="text-slate-200 font-semibold">{alert.mri_score}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
