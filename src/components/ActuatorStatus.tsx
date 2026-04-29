import { Fan, Volume2, Power } from 'lucide-react';

interface ActuatorStatusProps {
  fanOn: boolean;
  buzzerOn: boolean;
  isLoading: boolean;
  onToggleFan: (value: boolean) => void;
  onToggleBuzzer: (value: boolean) => void;
}

export default function ActuatorStatus({
  fanOn,
  buzzerOn,
  isLoading,
  onToggleFan,
  onToggleBuzzer,
}: ActuatorStatusProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="skeleton h-4 w-32 mb-4" />
        <div className="space-y-4">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Power className="w-5 h-5 text-rice-400" />
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Actuator Control
        </h3>
      </div>

      <div className="space-y-4">
        {/* Fan Control */}
        <div
          className="flex items-center justify-between p-4 rounded-xl border transition-all duration-300"
          style={{
            backgroundColor: fanOn ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 41, 59, 0.4)',
            borderColor: fanOn ? 'rgba(59, 130, 246, 0.25)' : 'rgba(51, 65, 85, 0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300"
              style={{
                backgroundColor: fanOn ? 'rgba(59, 130, 246, 0.2)' : 'rgba(51, 65, 85, 0.4)',
              }}
            >
              <Fan
                className="w-5 h-5 transition-all duration-500"
                style={{
                  color: fanOn ? '#3b82f6' : '#64748b',
                  transform: fanOn ? 'rotate(360deg)' : 'rotate(0deg)',
                  animation: fanOn ? 'spin 2s linear infinite' : 'none',
                }}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">Exhaust Fan</div>
              <div className="text-[11px] text-slate-500">
                {fanOn ? 'Running • Active cooling' : 'Idle • Standby'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                color: fanOn ? '#3b82f6' : '#64748b',
                backgroundColor: fanOn ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              }}
            >
              {fanOn ? 'ON' : 'OFF'}
            </span>
            <button
              onClick={() => onToggleFan(!fanOn)}
              className={`toggle-switch ${fanOn ? 'active' : ''}`}
              aria-label="Toggle exhaust fan"
              style={fanOn ? { background: '#3b82f6' } : {}}
            />
          </div>
        </div>

        {/* Buzzer Control */}
        <div
          className="flex items-center justify-between p-4 rounded-xl border transition-all duration-300"
          style={{
            backgroundColor: buzzerOn ? 'rgba(239, 68, 68, 0.08)' : 'rgba(30, 41, 59, 0.4)',
            borderColor: buzzerOn ? 'rgba(239, 68, 68, 0.25)' : 'rgba(51, 65, 85, 0.3)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300"
              style={{
                backgroundColor: buzzerOn ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.4)',
              }}
            >
              <Volume2
                className="w-5 h-5 transition-colors duration-300"
                style={{ color: buzzerOn ? '#ef4444' : '#64748b' }}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">Alert Buzzer</div>
              <div className="text-[11px] text-slate-500">
                {buzzerOn ? 'Sounding • Alert active' : 'Silent • Standby'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                color: buzzerOn ? '#ef4444' : '#64748b',
                backgroundColor: buzzerOn ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              }}
            >
              {buzzerOn ? 'ON' : 'OFF'}
            </span>
            <button
              onClick={() => onToggleBuzzer(!buzzerOn)}
              className={`toggle-switch ${buzzerOn ? 'active' : ''}`}
              aria-label="Toggle alert buzzer"
              style={buzzerOn ? { background: '#ef4444' } : {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
