import { useEffect, useRef, useState } from "react";
import { Nav } from "../components/Nav";
import { useAuth } from "../hooks/useAuth";
import { useAgent, type AIConfig } from "../hooks/useAgent";

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  github: [
    { value: "openai/gpt-4.1", label: "GPT-4.1" },
    { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
};

export function Create() {
  const { user, loading, signIn, githubToken } = useAuth();
  const agent = useAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [provider, setProvider] = useState(() => localStorage.getItem("fas_provider") || "github");
  const [model, setModel] = useState(() => localStorage.getItem("fas_model") || "openai/gpt-4.1");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => { agent.loadHistory(); }, [agent.currentProjectId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agent.messages]);
  useEffect(() => { localStorage.setItem("fas_provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("fas_model", model); }, [model]);

  if (loading) return null;

  const handleSend = async () => {
    const msg = inputValue.trim();
    if (!msg || agent.isStreaming) return;
    const key = provider === "github" ? (githubToken || "") : apiKey;
    if (!key) { alert(provider === "github" ? "GitHub Models not available. Sign out and back in." : "Enter your API key in settings."); return; }
    setInputValue("");
    await agent.sendMessage(msg, { provider, model, apiKey: key, temperature, maxTokens: 16384 } as AIConfig);
  };

  const previewUrl = agent.deployState?.phase === "live" ? agent.deployState.appUrl : null;

  if (!user) {
    return (
      <>
        <Nav />
        <main className="flex flex-col items-center justify-center text-center min-h-[60vh] py-16 px-6 max-w-[640px] mx-auto">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">VibeCode</h1>
          <p className="text-lg mb-8 text-[var(--muted)] max-w-[480px]">
            Describe the app you want. An AI agent builds it, deploys it, and you get a live app on FreeAppStore — in minutes.
          </p>
          <div className="flex flex-col items-center gap-3">
            <button onClick={() => signIn('github')} className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white bg-[var(--accent)]">
              Sign in with GitHub
            </button>
            <button onClick={() => signIn('google')} className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white bg-[var(--accent)]">
              Sign in with Google
            </button>
          </div>
          <p className="text-sm mt-3 text-[var(--muted)]">Free to use. AI runs through GitHub Models — no API key needed.</p>
        </main>
      </>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <Nav />
      <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2">
        {/* Chat */}
        <div className="flex flex-col overflow-hidden border-r border-[var(--line)]">
          <Toolbar
            agent={agent}
            provider={provider} setProvider={setProvider}
            model={model} setModel={setModel}
            apiKey={apiKey} setApiKey={setApiKey}
            temperature={temperature} setTemperature={setTemperature}
            settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen}
          />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
            {agent.messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 shrink-0 px-3 py-2 border-t border-[var(--line)] bg-[var(--panel)]">
            <textarea
              name="message"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Build me a meditation timer..."
              rows={1}
              className="flex-1 resize-none border border-[var(--line)] rounded-lg px-[0.6rem] py-[0.4rem] bg-[var(--paper)] text-[var(--ink)] text-[0.86rem] min-h-[34px] max-h-[100px] font-[inherit]"
            />
            <button
              onClick={handleSend}
              disabled={agent.isStreaming}
              className="self-end px-[0.85rem] py-[0.4rem] bg-[var(--accent)] text-white border-0 rounded-lg font-semibold text-[0.82rem] cursor-pointer"
              style={{ opacity: agent.isStreaming ? 0.5 : 1 }}
            >
              Send
            </button>
          </div>
        </div>
        {/* Preview */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 shrink-0 px-3 py-[0.35rem] border-b border-[var(--line)] bg-[var(--panel)] text-[0.78rem]">
            <span className="font-bold">Preview</span>
            {previewUrl && (
              <>
                <a href={previewUrl} target="_blank" rel="noopener" className="text-xs text-[var(--accent)] font-mono">{previewUrl.replace("https://", "")}</a>
                <a href={previewUrl} target="_blank" rel="noopener" className="ml-auto text-xs font-semibold text-[var(--accent)]">Open in new tab</a>
              </>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center bg-[var(--paper)] min-h-0 overflow-hidden">
            {previewUrl ? <iframe src={previewUrl} title="Preview" className="w-full h-full border-0" /> :
             agent.deployState ? <DeployLog state={agent.deployState} /> :
             <div className="text-center p-8 text-[var(--muted)]"><p>Your app will appear here once deployed.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

const selCls = "px-[0.4rem] py-[0.2rem] border border-[var(--line)] rounded-[0.3rem] bg-[var(--paper)] text-[var(--ink)] font-[inherit] text-[0.78rem]";
const btnCls = "bg-transparent border border-[var(--line)] rounded-[0.3rem] px-[0.4rem] py-[0.15rem] cursor-pointer text-[var(--ink)] text-[0.78rem]";

function Toolbar({ agent, provider, setProvider, model, setModel, apiKey, setApiKey, temperature, setTemperature, settingsOpen, setSettingsOpen }: any) {
  return (
    <>
      <div className="flex items-center gap-2 shrink-0 px-3 py-[0.35rem] border-b border-[var(--line)] bg-[var(--panel)] text-[0.78rem]">
        <select name="project" value={agent.currentProjectId || ""} onChange={(e) => agent.switchProject(e.target.value)} className={selCls}>
          {agent.projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => { const n = prompt("Project name:"); if (n) agent.createProject(n.trim()); }} className={btnCls}>+</button>
        <span className="ml-auto text-[var(--muted)] tabular-nums">
          In: <strong>{agent.tokensIn.toLocaleString()}</strong> Out: <strong>{agent.tokensOut.toLocaleString()}</strong>
        </span>
        <button onClick={() => setSettingsOpen(!settingsOpen)} className={btnCls}>&#9881;</button>
      </div>
      {settingsOpen && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 px-3 py-[0.35rem] border-b border-[var(--line)] bg-[var(--panel)] text-[0.78rem]">
          <select name="provider" value={provider} onChange={(e) => { setProvider(e.target.value); setModel(MODEL_OPTIONS[e.target.value]?.[0]?.value || ""); }} className={selCls}>
            <option value="github">GitHub Models</option><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option><option value="google">Google</option>
          </select>
          <select name="model" value={model} onChange={(e) => setModel(e.target.value)} className={selCls}>
            {(MODEL_OPTIONS[provider] || []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {provider !== "github" && <input name="api-key" type="password" autoComplete="current-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" className={`${selCls} w-[140px]`} />}
          <select name="temperature" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className={selCls}>
            <option value={0}>Temp 0</option><option value={0.3}>Temp 0.3</option><option value={0.7}>Temp 0.7</option><option value={1}>Temp 1</option>
          </select>
        </div>
      )}
    </>
  );
}

function Message({ role, content }: { role: string; content: string }) {
  const base = "max-w-[88%] px-3 py-[0.55rem] rounded-[0.75rem] text-[0.86rem] leading-[1.5] whitespace-pre-wrap break-words";
  const variants: Record<string, string> = {
    user:      `${base} self-end bg-[var(--accent)] text-white rounded-br-[0.15rem]`,
    assistant: `${base} self-start bg-[var(--panel)] border border-[var(--line)] rounded-bl-[0.15rem]`,
    tool:      `${base} self-start text-[0.72rem] font-mono bg-[var(--panel)] border border-[var(--line)] text-[var(--muted)] py-[0.25rem] px-[0.5rem] rounded-[0.35rem]`,
    system:    `self-center text-[0.78rem] text-[var(--muted)]`,
  };
  return <div className={variants[role] ?? base}>{content}</div>;
}

const DEPLOY_STEPS = ["GitHub repo", "CF Pages", "Custom domain", "DNS", "Store listing", "Pushing code", "Building", "Live"];

function DeployLog({ state }: { state: { phase: string; steps?: { name: string; status: string }[]; appUrl?: string; error?: string } }) {
  return (
    <div className="w-full p-6 text-[0.82rem]">
      <h3 className="font-bold mb-3">Deploying your app</h3>
      {DEPLOY_STEPS.map((name) => {
        const step = state.steps?.find((s) => s.name === name);
        let status = "pending";
        if (step) status = step.status === "ok" ? "done" : step.status === "skip" ? "skip" : "fail";
        else if (state.phase === "live") status = "done";
        else if (state.phase === "pushing" && name === "Pushing code") status = "active";
        else if (state.phase === "building" && name === "Building") status = "active";
        const dotColor = { done: "#16a34a", skip: "#d97706", fail: "#dc2626", active: "var(--accent)", pending: "var(--line)" }[status];
        return (
          <div key={name} className={`flex items-center gap-2 py-1 ${["done", "active"].includes(status) ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
            {name}
          </div>
        );
      })}
      {state.phase === "live" && state.appUrl && (
        <div className="mt-3 p-2 rounded font-semibold text-[#16a34a] bg-[color-mix(in_srgb,#16a34a_10%,var(--panel))]">
          Live! <a href={state.appUrl} target="_blank" rel="noopener" className="text-[#16a34a]">{state.appUrl.replace("https://", "")}</a>
        </div>
      )}
      {state.phase === "error" && <div className="mt-3 p-2 rounded text-sm text-[#dc2626]">{state.error}</div>}
    </div>
  );
}
