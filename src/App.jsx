import { useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';

const SUBSYSTEMS = [
  {
    key: 'rpm',
    label: 'Stirring Motor',
    unit: 'RPM',
    controlTopic: 'bioreactor/control/rpm',
    sensorTopic: 'bioreactor/sensors/rpm',
    ackTopic: 'bioreactor/ack/rpm',
    step: '10',
  },
  {
    key: 'temp',
    label: 'Temperature',
    unit: '°C',
    controlTopic: 'bioreactor/control/temp',
    sensorTopic: 'bioreactor/sensors/temp',
    ackTopic: 'bioreactor/ack/temp',
    step: '0.5',
  },
  {
    key: 'ph',
    label: 'pH Level',
    unit: 'pH',
    controlTopic: 'bioreactor/control/ph',
    sensorTopic: 'bioreactor/sensors/ph',
    ackTopic: 'bioreactor/ack/ph',
    step: '0.1',
  },
];

export default function App() {
  const clientRef = useRef(null);
  const [status, setStatus] = useState('Disconnected');
  const [readings, setReadings] = useState({ rpm: '--', temp: '--', ph: '--' });
  const [confirmed, setConfirmed] = useState({ rpm: '--', temp: '--', ph: '--' });
  const [targets, setTargets] = useState({ rpm: '150', temp: '37.0', ph: '7.0' });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const client = mqtt.connect(import.meta.env.VITE_MQTT_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
      clientId: `web_ui_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 2000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      setStatus('Connected');
      client.subscribe(['bioreactor/sensors/#', 'bioreactor/ack/#', 'bioreactor/debug']);
    });

    client.on('message', (topic, message) => {
      const value = message.toString();

      if (topic === 'bioreactor/sensors/rpm') setReadings((p) => ({ ...p, rpm: value }));
      else if (topic === 'bioreactor/sensors/temp') setReadings((p) => ({ ...p, temp: value }));
      else if (topic === 'bioreactor/sensors/ph') setReadings((p) => ({ ...p, ph: value }));
      else if (topic === 'bioreactor/ack/rpm') setConfirmed((p) => ({ ...p, rpm: value }));
      else if (topic === 'bioreactor/ack/temp') setConfirmed((p) => ({ ...p, temp: value }));
      else if (topic === 'bioreactor/ack/ph') setConfirmed((p) => ({ ...p, ph: value }));
      else if (topic === 'bioreactor/debug') {
        const line = `[${new Date().toLocaleTimeString()}] ${value}`;
        setLogs((prev) => [line, ...prev].slice(0, 20));
      }
    });

    client.on('close', () => setStatus('Disconnected'));
    client.on('error', () => setStatus('Error'));

    return () => {
      if (client) client.end();
    };
  }, []);

  const sendCommand = (subsystem) => {
    const value = targets[subsystem.key].trim();
    if (!value || !clientRef.current || !clientRef.current.connected) return;
    clientRef.current.publish(subsystem.controlTopic, value);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Bioreactor Control Dashboard</h1>
        <span
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.875rem',
            fontWeight: 600,
            backgroundColor: status === 'Connected' ? '#dcfce7' : '#fee2e2',
            color: status === 'Connected' ? '#166534' : '#991b1b',
          }}
        >
          {status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {SUBSYSTEMS.map((sub) => (
          <div
            key={sub.key}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '1.25rem',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem' }}>{sub.label}</h2>

            <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Live Sensor Reading</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {readings[sub.key]} <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{sub.unit}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#0f766e', fontWeight: 600 }}>
              ESP32 Active Set-Point: {confirmed[sub.key]} {confirmed[sub.key] !== '--' ? sub.unit : ''}
            </div>

            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', color: '#374151' }}>
              New Target ({sub.unit})
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                step={sub.step}
                value={targets[sub.key]}
                onChange={(e) => setTargets((prev) => ({ ...prev, [sub.key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && sendCommand(sub)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
              <button
                onClick={() => sendCommand(sub)}
                disabled={status !== 'Connected'}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: status === 'Connected' ? '#2563eb' : '#9ca3af',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: status === 'Connected' ? 'pointer' : 'not-allowed',
                }}
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: '10px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#38bdf8' }}>Live ESP32 MQTT Console (bioreactor/debug)</div>
        {logs.length === 0 ? (
          <div style={{ color: '#64748b' }}>Waiting for ESP32 messages...</div>
        ) : (
          logs.map((entry, idx) => <div key={idx} style={{ padding: '0.15rem 0' }}>{entry}</div>)
        )}
      </div>
    </div>
  );
}