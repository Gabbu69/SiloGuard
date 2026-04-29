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
      return <Fan className="w-4 h-4 text-blue-400" />;
    case 'Buzzer Triggered':
      return <Volume2 className="w-4 h-4 text-red-400" />;
    case 'Threshold Exceeded':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400" />;
  }
}

function getAlertColor(type: string) {
  switch (type) {
    case 'Fan Activated': return '#3b82f6';
    case 'Buzzer Triggered': return '#ef4444';
    case 'Threshold Exceeded': return '#f59e0b';
    default: return '#94a3b8';
  }
}

export default function AlertsPanel({ alerts, isLoading }: AlertsPanelProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="skeleton w-5 h-5 rounded" />
          <div className="skeleton h-4 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Recent Alerts
          </h3>
        </div>
        {alerts.length > 0 && (
          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-semibold border border-amber-500/20">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No alerts triggered</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const borderColor = getAlertColor(alert.type);
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-dark-800/50 border border-dark-600/30 hover:border-dark-600/60 transition-colors"
                style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
              >
                <div className="mt-0.5">{getAlertIcon(alert.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {alert.type}
                    </span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {formatTimestamp(alert.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-400">
                      Sensor: <span className="text-slate-300 font-medium">{alert.sensor}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">•</span>
                    <span className="text-[11px] text-slate-400">
                      Value: <span className="text-slate-300 font-medium">{alert.value?.toFixed(1)}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">•</span>
                    <span className="text-[11px] text-slate-400">
                      MRI: <span className="text-slate-300 font-medium">{alert.mri_score}</span>
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
