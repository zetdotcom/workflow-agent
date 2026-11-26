import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { chatProviders, type BoardSelection, type ChatEntry, type ChatProvider, type ChatSummary, type ChatView, type HostPrompt } from "../server/chat-model";
import { api, RequestError } from "./api";
import { RichText } from "./rich-text";
import "./chat.css";

function Entry({ entry }: { entry: ChatEntry }) {
  const [open, setOpen] = useState(false);
  if (entry.kind === "tool" || entry.kind === "diff" || entry.kind === "decision") {
    return <details className={"chat-entry activity " + entry.kind} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{entry.title}</summary>{open && <pre>{entry.kind === "diff" ? entry.text.split("\n").map((line, index) =>
        <span key={index} className={line.startsWith("+") ? "addition" : line.startsWith("-") ? "deletion" : undefined}>{line}{"\n"}</span>
      ) : entry.text}</pre>}
    </details>;
  }
  return <article className={"chat-entry " + entry.kind}>
    <strong>{entry.title}</strong>
    {entry.kind === "assistant" ? <RichText text={entry.text} /> : entry.url && /^https?:\/\//i.test(entry.url) ?
      <a href={entry.url} target="_blank" rel="noreferrer">{entry.text}</a> : <p>{entry.text}</p>}
  </article>;
}

function ToolCalls({ calls }: { calls: ChatEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const labelId = listId + "-label";
  const action = expanded ? "Collapse" : "Expand";
  return <div className="chat-entry chat-tools" role="group" aria-labelledby={labelId}>
    <div className="chat-tools-head">
      <span id={labelId}>tool calls ({calls.length})</span>
      <button type="button" aria-label={action + " tool calls"} aria-expanded={expanded} aria-controls={listId}
        onClick={() => setExpanded(open => !open)}>{action}</button>
    </div>
    <div id={listId} hidden={!expanded}>{calls.map(entry => <Entry key={entry.id} entry={entry} />)}</div>
  </div>;
}

function Transcript({ entries }: { entries: ChatEntry[] }) {
  const items: (ChatEntry | ChatEntry[])[] = [];
  for (const entry of entries) {
    if (entry.kind !== "tool") {
      items.push(entry);
      continue;
    }
    const previous = items.at(-1);
    if (Array.isArray(previous)) previous.push(entry);
    else items.push([entry]);
  }
  return items.map(item => Array.isArray(item)
    ? <ToolCalls key={item[0].id} calls={item} />
    : <Entry key={item.id} entry={item} />);
}

function Permission({ prompt, disabled, respond }: { prompt: HostPrompt; disabled: boolean; respond: (approve: boolean, answers: Record<string, string>) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return <div className="chat-approval">
    <strong>{prompt.title}</strong><pre>{prompt.detail}</pre>
    {prompt.questions?.map(q => <label key={q.id}>{q.question}
      {q.options.length > 0 && <small>{q.options.join(" / ")}</small>}
      <input value={answers[q.id] ?? ""} onChange={event => setAnswers({ ...answers, [q.id]: event.target.value })} />
    </label>)}
    <div className="chat-actions"><button type="button" disabled={disabled} onClick={() => respond(false, {})}>Decline</button>
      <button type="button" className="primary" disabled={disabled || prompt.questions?.some(q => !q.optional && !answers[q.id]?.trim())}
        onClick={() => respond(true, answers)}>{prompt.questions ? "Send answer" : "Allow"}</button></div>
  </div>;
}

type Props = {
  host: HTMLElement | null; revision: number; selectedPath: string; selection?: BoardSelection;
  projectProvider: ChatProvider | null; openSettings: () => void; refreshSettings: () => Promise<void>;
};
export function ChatDock({ host, revision, selectedPath, selection, projectProvider, openSettings, refreshSettings }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>();
  const [id, setId] = useState<string>();
  const [view, setView] = useState<ChatView>();
  const [refresh, setRefresh] = useState(0);
  const [text, setText] = useState("");
  const [draftProvider, setDraftProvider] = useState<ChatProvider | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [mention, setMention] = useState<{ start: number; end: number; query: string }>();
  const [matches, setMatches] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [choice, setChoice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const current = view?.id === id ? view : undefined;
  const proposal = current?.proposal;
  const savedProvider = current?.provider ?? chats?.find(chat => chat.id === id)?.provider;
  const hasDraft = Boolean(text || files.length);
  const provider = id ? savedProvider : (hasDraft && draftProvider ? draftProvider : projectProvider);
  const providerName = provider ? chatProviders[provider] : "";
  const canCompose = Boolean(projectProvider && provider === projectProvider && id !== undefined && (!id || current));

  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      const list = await api<ChatSummary[]>("chats", undefined, abort.signal);
      if (abort.signal.aborted) return;
      setChats(list);
      if (id === undefined) { setId(list.find(chat => chat.provider === projectProvider)?.id ?? ""); return; }
      if (id) {
        const chat = await api<ChatView>("chats/" + id, undefined, abort.signal);
        if (!abort.signal.aborted) setView(chat);
      }
    })().catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [id, projectProvider, revision, refresh]);

  useEffect(() => {
    if (follow.current && history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [current, expanded]);
  useEffect(() => {
    const element = history.current;
    if (!element) return;
    const observer = new ResizeObserver(() => { if (follow.current) element.scrollTop = element.scrollHeight; });
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, host]);

  useEffect(() => {
    if (!mention) { setMatches([]); return; }
    const abort = new AbortController();
    setSearching(true);
    const preferred = selectedPath && selectedPath.toLowerCase().includes(mention.query.toLowerCase()) && !files.includes(selectedPath);
    setMatches(preferred ? [selectedPath] : []);
    setChoice(0);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: mention.query, selected: selectedPath });
      api<string[]>("files?" + params, undefined, abort.signal)
        .then(paths => setMatches(paths.filter(path => !files.includes(path))))
        .catch(cause => { if (!abort.signal.aborted) setError(cause.message); })
        .finally(() => { if (!abort.signal.aborted) setSearching(false); });
    }, 70);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [mention, files, selectedPath]);

  function findMention(value: string, caret: number) {
    const match = /(?:^|\s)@(?:"([^"\n]*)|([^\s@"]*))$/.exec(value.slice(0, caret));
    setMention(match ? { start: match.index + match[0].indexOf("@"), end: caret, query: match[1] ?? match[2] } : undefined);
  }
  function attach(path: string) {
    if (!mention) return;
    setFiles(previous => [...new Set([...previous, path])]);
    setText(text.slice(0, mention.start) + text.slice(mention.end));
    const caret = mention.start;
    setMention(undefined);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret); });
  }
  async function perform(operation: () => Promise<void>) {
    setError(""); setBusy(true);
    try { await operation(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete this request.");
      if (cause instanceof RequestError && cause.status === 409) await refreshSettings();
    }
    finally { setBusy(false); setRefresh(value => value + 1); }
  }
  async function createChat(expectedProvider: ChatProvider) {
    const created = await api<{ id: string }>("chats", { expectedProvider });
    setId(created.id); setView(undefined); follow.current = true;
    return created.id;
  }
  function clearDraft() {
    setText(""); setFiles([]); setMention(undefined); setDraftProvider(null);
  }
  function startChat() {
    if (!projectProvider || busy) return;
    setExpanded(true);
    void perform(async () => {
      await createChat(projectProvider); clearDraft(); input.current?.focus();
    });
  }
  function changeDraft(value: string) {
    if (!id && !hasDraft) setDraftProvider(projectProvider);
    setText(value);
  }
  const canSend = Boolean(canCompose && text.trim() && !busy && !current?.running);
  function send() {
    if (!canSend || !projectProvider) return;
    setExpanded(true); setMention(undefined); follow.current = true;
    void perform(async () => {
      const chatId = id || await createChat(projectProvider);
      await api("chats/" + chatId + "/messages", { text, files, selection, expectedProvider: projectProvider });
      clearDraft();
    });
  }
  function command(operation: string, params: unknown) {
    void perform(async () => { await api("chats/" + id + "/" + operation, params); });
  }
  function toggle() {
    setExpanded(!expanded); setMention(undefined);
  }

  return createPortal(<section className={"chat-dock" + (expanded ? " is-open" : "")} aria-label={(providerName || "Board") + " chat"}>
    {expanded && <div className="chat-panel">
      <header className="chat-head"><strong>{providerName || "Chats"}</strong>
        <select aria-label="Saved chats" value={id ?? ""} disabled={busy || !chats?.length} onChange={event => {
          setId(event.target.value); clearDraft(); setError(""); follow.current = true;
        }}>
          {!id && <option value="">New chat</option>}
          {chats?.map(chat => <option key={chat.id} value={chat.id}>{chat.title} · {chatProviders[chat.provider]}</option>)}
        </select>
        <button type="button" disabled={busy || !projectProvider} onClick={startChat}>New chat</button>
        <button type="button" aria-label="Collapse chat" onClick={toggle}>−</button>
      </header>
      <div className="chat-history" ref={history} onScroll={event => {
        const el = event.currentTarget;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      }}>
        {current && <Transcript key={current.id} entries={current.entries} />}
        {current?.running && <p className="chat-working">{providerName} is working…</p>}
        {proposal && <div className="chat-approval"><strong>Authorize workflow</strong>
          <code>{["wf", proposal.command, proposal.change, proposal.ticket].filter(Boolean).join(" ")}</code>
          <small>Runs with {providerName}</small>
          <p>{proposal.reason}</p><small>{proposal.stage} · {proposal.directory}</small>
          {proposal.branch && <small>Branch {proposal.branch} · {proposal.head?.slice(0, 9)}</small>}
          {proposal.remote && <small>Publish to {proposal.remote} · {proposal.destinations?.join(", ")}</small>}
          {proposal.spec && <details><summary>Specification</summary><RichText text={proposal.spec} /></details>}
          {proposal.plan && <details><summary>Implementation plan</summary><RichText text={proposal.plan} /></details>}
          <p>{proposal.command === "to-pr" ? "Includes implementation, verification, review, and PR publication when checks pass." : "Includes repairing the change’s status file if it is out of date."}</p>
          <div className="chat-actions"><button type="button" disabled={busy || current?.running} onClick={() => command("decision", { id: proposal.id, approve: false })}>Decline</button>
            <button type="button" className="primary" disabled={busy || current?.running || !canCompose}
              onClick={() => command("decision", { id: proposal.id, approve: true, expectedProvider: projectProvider })}>Authorize and run</button></div>
        </div>}
        {current?.prompt && <Permission key={current.prompt.id} prompt={current.prompt} disabled={busy}
          respond={(approve, answers) => command("permission", { id: current.prompt!.id, approve, answers })} />}
      </div>
    </div>}
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-form" onSubmit={event => { event.preventDefault(); send(); }}>
      {!projectProvider && <p className="chat-provider-note">Choose a provider to send messages. <button type="button" onClick={openSettings}>Open Settings</button></p>}
      {provider && projectProvider && provider !== projectProvider && <p className="chat-provider-note">
        {id ? "This chat" : "This draft"} uses {providerName}. The project now uses {chatProviders[projectProvider]}.{" "}
        <button type="button" disabled={busy} onClick={startChat}>Start a {chatProviders[projectProvider]} chat</button>{" · "}
        <button type="button" onClick={openSettings}>Open Settings</button>
      </p>}
      {mention && canCompose && <div className="mention-list" role="listbox" id="file-suggestions" aria-label="Repository files">
        {matches.map((path, index) => <button key={path} id={"file-option-" + index} type="button" role="option"
          aria-selected={index === choice} onMouseDown={event => event.preventDefault()} onClick={() => attach(path)}>
          <span>{path.slice(path.lastIndexOf("/") + 1)} {path === selectedPath && <small>Current selection</small>}</span><code>{path}</code>
        </button>)}
        {!matches.length && <span className="mention-empty">{searching ? "Searching files…" : "No matching files"}</span>}
      </div>}
      {files.length > 0 && <div className="chat-files">{files.map(path => <button key={path} type="button" title={path} aria-label={"Remove " + path}
        onClick={() => setFiles(files.filter(value => value !== path))}>@{path} ×</button>)}</div>}
      <div className="chat-input-row">{expanded ? <button type="button" disabled={!canCompose || busy} aria-label="Mention a repository file" onClick={() => {
        const start = input.current?.selectionStart ?? text.length;
        const end = input.current?.selectionEnd ?? start;
        const prefix = start && !/\s/.test(text[start - 1]) ? " @" : "@";
        const value = text.slice(0, start) + prefix + text.slice(end);
        changeDraft(value); findMention(value, start + prefix.length);
        requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + prefix.length, start + prefix.length); });
      }}>@</button> : <button className="chat-toggle" type="button" aria-label="Show or hide saved chats" aria-expanded={expanded} onClick={toggle}>Chats</button>}
        {!expanded && providerName && <strong className="composer-provider">{providerName}</strong>}
        <textarea ref={input} rows={1} readOnly={!canCompose || busy} aria-label={providerName ? "Message " + providerName : "Chat message"}
          placeholder={providerName ? "Ask " + providerName + "…   @ to add a file" : ""} value={text}
          aria-controls={mention ? "file-suggestions" : undefined} aria-activedescendant={mention && matches[choice] ? "file-option-" + choice : undefined}
          onChange={event => { changeDraft(event.target.value); findMention(event.target.value, event.target.selectionStart); }}
          onClick={event => { if (canCompose) findMention(text, event.currentTarget.selectionStart); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || !canCompose || busy) return;
            if (mention && ["ArrowDown", "ArrowUp"].includes(event.key) && matches.length) {
              event.preventDefault(); const next = (choice + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
              setChoice(next); document.getElementById("file-option-" + next)?.scrollIntoView({ block: "nearest" });
            } else if (mention && (event.key === "Tab" || event.key === "Enter") && matches[choice] && !event.shiftKey) {
              event.preventDefault(); attach(matches[choice]);
            } else if (event.key === "Escape" && mention) { event.preventDefault(); event.stopPropagation(); setMention(undefined); }
            else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
          }} />
        {current?.running ? <button type="button" disabled={busy} onClick={() => command("stop", {})}>Stop</button> :
          <button type="submit" className="primary send" aria-label="Send message" disabled={!canSend}>↑</button>}
      </div>
    </form>
  </section>, host ?? document.body);
}
