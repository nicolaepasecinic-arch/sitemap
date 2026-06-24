import React, { useEffect, useState } from 'react';
import { X, Copy, Check, RefreshCw, Bot } from 'lucide-react';
import { getApiBase, apiGetMcpToken, apiRegenerateMcpToken, hasBackend } from '../api';

/* "Connect to AI" — shows the per-account MCP endpoint URL + token so an external
   AI client (e.g. Claude) can connect and manage this user's projects. */
export default function ConnectAI({ onClose }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  const base = getApiBase();
  const url = token ? `${base}/mcp?token=${token}` : '';

  useEffect(() => {
    if (!hasBackend()) { setErr('Connect to AI needs the backend running (set REACT_APP_API_URL).'); setLoading(false); return; }
    apiGetMcpToken().then((r) => setToken(r.token)).catch((e) => setErr(e.message || 'Could not load your token')).finally(() => setLoading(false));
  }, []);

  const copy = (text, which) => { try { navigator.clipboard?.writeText(text); } catch (e) {} setCopied(which); setTimeout(() => setCopied(''), 1500); };
  const regen = async () => {
    if (!window.confirm('Generate a new token? The current one will stop working.')) return;
    setLoading(true);
    try { const r = await apiRegenerateMcpToken(); setToken(r.token); } catch (e) { setErr(e.message || 'Failed'); } finally { setLoading(false); }
  };

  const Field = ({ label, value, which }) => (
    <div className="mb-3">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
        <span className="flex-1 text-sm text-gray-700 truncate font-mono">{value}</span>
        <button onClick={() => copy(value, which)} className="shrink-0 text-gray-400 hover:text-[#473AE0]" title="Copy">
          {copied === which ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-6" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[94vw] p-7" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center"><Bot size={17} /></span>
            <h2 className="text-xl font-bold text-gray-800">Connect to AI</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 flex items-center justify-center"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-500 mt-1 mb-5">Connect an external AI client (like Claude) to your Qoders Map account. It can then read and edit all your projects through the MCP server. Keep this token private — anyone with it can access your projects.</p>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : err ? (
          <div className="text-sm text-red-500 py-2">{err}</div>
        ) : (
          <>
            <Field label="MCP server URL (includes your token)" value={url} which="url" />
            <Field label="Token only" value={token} which="token" />
            <div className="flex items-center justify-between mt-4">
              <button onClick={regen} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"><RefreshCw size={14} /> Regenerate token</button>
              <button onClick={() => copy(url, 'url')} className="bg-[#473AE0] text-white rounded-full px-5 py-2 text-sm font-medium hover:bg-[#3a2fc0]">Copy URL</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
