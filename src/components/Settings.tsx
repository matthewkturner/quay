import type { QuaySettings } from '../types';
import { CloseIcon } from './Icons';

interface Props {
  settings: QuaySettings;
  onChange: (settings: QuaySettings) => void;
  onClose: () => void;
}

export function Settings({ settings, onChange, onClose }: Props) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="settings-body">
          <label className="settings-row">
            <span className="settings-label">Font size</span>
            <div className="settings-control">
              <button
                className="settings-step-btn"
                onClick={() =>
                  onChange({
                    ...settings,
                    fontSize: Math.max(8, settings.fontSize - 1),
                  })
                }
              >
                -
              </button>
              <span className="settings-value">{settings.fontSize}px</span>
              <button
                className="settings-step-btn"
                onClick={() =>
                  onChange({
                    ...settings,
                    fontSize: Math.min(24, settings.fontSize + 1),
                  })
                }
              >
                +
              </button>
            </div>
          </label>
          <label className="settings-row">
            <span className="settings-label">Theme</span>
            <div className="settings-control">
              <button
                className={`settings-toggle ${settings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, theme: 'dark' })}
              >
                Dark
              </button>
              <button
                className={`settings-toggle ${settings.theme === 'light' ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, theme: 'light' })}
              >
                Light
              </button>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
