import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { chatProviders, type ChatProvider } from "../server/chat-model";
import { api } from "./api";

type Settings = { provider: ChatProvider | null };

export function useProjectSettings(revision: number) {
  const [provider, setProvider] = useState<ChatProvider | null>();
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const settings = await api<Settings>("settings", undefined, controller.signal);
      if (!controller.signal.aborted) { setProvider(settings.provider); setError(""); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not read project settings.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { request.current?.abort(); window.removeEventListener("focus", refresh); };
  }, [revision, refresh]);

  async function save(choice: ChatProvider, expectedProvider: ChatProvider | null) {
    try {
      const result = await api<Settings>("settings", { provider: choice, expectedProvider });
      setProvider(result.provider);
      setError("");
    } finally { await refresh(); }
  }

  return { provider, error, refresh, save };
}

export function ProviderForm({ provider, setup, save, close }: {
  provider: ChatProvider | null; setup?: boolean;
  save: (choice: ChatProvider, expected: ChatProvider | null) => Promise<void>; close: () => void;
}) {
  const name = useId();
  const [draft, setDraft] = useState({ choice: provider, expected: provider });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stale = draft.expected !== provider;
  const choice = stale ? provider : draft.choice;

  async function submit() {
    if (!choice || stale || busy || choice === provider) return;
    setBusy(true); setError("");
    try { await save(choice, draft.expected); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the provider."); }
    finally { setBusy(false); }
  }

  return <form className="provider-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <fieldset disabled={busy}>
      <legend>{setup ? "Choose a chat provider" : "Chat provider"}</legend>
      <p>Your messages, the selected board document and attached files go to this provider.</p>
      <div className="provider-choices">{(Object.keys(chatProviders) as ChatProvider[]).map(id =>
        <label key={id}><input type="radio" name={name} value={id} checked={choice === id} onChange={() => {
          setDraft({ choice: id, expected: provider }); setError("");
        }} />{chatProviders[id]}</label>)}</div>
    </fieldset>
    <p>Codex also supports repository search and approved workflow actions. This project preference is saved locally outside the repository.</p>
    {(error || stale) && <p role="alert">{error || "Another window changed the project provider. Select a provider again to update it."}</p>}
    <div className="provider-actions"><button type="button" disabled={busy} onClick={close}>{setup ? "Set up later" : "Cancel"}</button>
      <button type="submit" className="primary" disabled={!choice || choice === provider || busy || stale}>Save provider</button></div>
  </form>;
}

export function SettingsDialog({ children, close }: { children: ReactNode; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog className="settings-dialog" ref={dialog} aria-labelledby={title}
    onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2 id={title}>Project settings</h2><button className="close" aria-label="Close settings" onClick={close}>×</button></header>
    {children}
  </dialog>;
}
