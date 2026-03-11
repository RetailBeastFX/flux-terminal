import React, { useState, useEffect } from 'react';

export function SettingsModal({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('mmt_api_key');
    if (saved) setApiKey(saved);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('mmt_api_key', apiKey.trim());
    onClose();
    // Force a reload so the new socket stream picks it up
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: '#0B0E14',
        border: '1px solid #1E293B',
        borderRadius: '8px',
        padding: '24px',
        width: '400px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        color: '#E2E8F0'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '18px', fontWeight: 600, color: '#F8FAFC' }}>Terminal Settings</h2>
        
        <div style={{ margin: '20px 0' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8' }}>
            MMT API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter your API Key"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#F8FAFC',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <p style={{ fontSize: '11px', color: '#64748B', marginTop: '8px', lineHeight: 1.4 }}>
            Required for aggregated futures data, real-time order books, and high-density liquidity heatmaps. Get a key at mmt.gg.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#94A3B8',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: '#3B82F6',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
