import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BoardSelection, ChatEntry, ChatSummary, ChatView, HostPrompt } from "../server/chat-model";
import { RichText } from "./rich-text";
import "./chat.css";

async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/" + path, body === undefined ? { signal } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal
  });
  if (!response.ok) throw new Error(await response.text() || "The board request failed.");
  return response.json();
}

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

type Props = { host: HTMLElement | null; revision: number; selectedPath: string; selection?: BoardSelection };
export function ChatDock({ host, revision, selectedPath, selection }: Props) {
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>();
  const [id, setId] = useState("");
  const [view, setView] = useState<ChatView>();
  const [refresh, setRefresh] = useState(0);
  const [text, setText] = useState("");
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

  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    void (async () => {
      const list = await api<ChatSummary[]>("chats", undefined, abort.signal);
      setChats(list);
      const selected = id || list[0]?.id;
      if (selected && selected !== id) { setId(selected); return; }
      if (selected) setView(await api<ChatView>("chats/" + selected, undefined, abort.signal));
    })().catch(cause => { if (!abort.signal.aborted) setError(cause.message); });
    return () => abort.abort();
  }, [id, active, revision, refresh]);

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
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete this request."); }
    finally { setBusy(false); setRefresh(value => value + 1); }
  }
  async function createChat() {
    const created = await api<{ id: string }>("chats", {});
    setId(created.id); setView(undefined); follow.current = true;
    return created.id;
  }
  const canSend = Boolean(text.trim() && chats && !busy && (!id || current) && !current?.running);
  function send() {
    if (!canSend) return;
    setExpanded(true); setMention(undefined); follow.current = true;
    void perform(async () => {
      const chatId = id || await createChat();
      await api("chats/" + chatId + "/messages", { text, files, selection });
      setText(""); setFiles([]);
    });
  }
  function command(operation: string, params: unknown) {
    void perform(async () => { await api("chats/" + id + "/" + operation, params); });
  }
  function toggle() {
    setActive(true); setExpanded(!expanded); setMention(undefined);
  }

  return createPortal(<section className={"chat-dock" + (expanded ? " is-open" : "")} aria-label="Codex chat">
    {expanded && <div className="chat-panel">
      <header className="chat-head"><strong>Codex</strong>
        <select aria-label="Saved chats" value={id} disabled={busy || !chats?.length} onChange={event => {
          setId(event.target.value); setText(""); setFiles([]); setMention(undefined); setError(""); follow.current = true;
        }}>
          {!chats?.length && <option value="">New chat</option>}
          {chats?.map(chat => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={() => void perform(async () => {
          await createChat(); setText(""); setFiles([]); setMention(undefined); input.current?.focus();
        })}>New chat</button>
        <button type="button" aria-label="Collapse chat" onClick={toggle}>−</button>
      </header>
      <div className="chat-history" ref={history} onScroll={event => {
        const el = event.currentTarget;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      }}>
        {current?.entries.map(entry => <Entry key={entry.id} entry={entry} />)}
        {current?.running && <p className="chat-working">Codex is working…</p>}
        {proposal && <div className="chat-approval"><strong>Authorize workflow</strong>
          <code>{["wf", proposal.command, proposal.change, proposal.ticket].filter(Boolean).join(" ")}</code>
          <p>{proposal.reason}</p><small>{proposal.stage} · {proposal.directory}</small>
          {proposal.branch && <small>Branch {proposal.branch} · {proposal.head?.slice(0, 9)}</small>}
          {proposal.remote && <small>Publish to {proposal.remote} · {proposal.destinations?.join(", ")}</small>}
          {proposal.spec && <details><summary>Specification</summary><RichText text={proposal.spec} /></details>}
          {proposal.plan && <details><summary>Implementation plan</summary><RichText text={proposal.plan} /></details>}
          <p>{proposal.command === "to-pr" ? "Includes implementation, verification, review, and PR publication when checks pass." : "Includes repairing the change’s status file if it is out of date."}</p>
          <div className="chat-actions"><button type="button" disabled={busy || current?.running} onClick={() => command("decision", { id: proposal.id, approve: false })}>Decline</button>
            <button type="button" className="primary" disabled={busy || current?.running} onClick={() => command("decision", { id: proposal.id, approve: true })}>Authorize and run</button></div>
        </div>}
        {current?.prompt && <Permission key={current.prompt.id} prompt={current.prompt} disabled={busy}
          respond={(approve, answers) => command("permission", { id: current.prompt!.id, approve, answers })} />}
      </div>
    </div>}
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-form" onSubmit={event => { event.preventDefault(); send(); }}>
      {mention && <div className="mention-list" role="listbox" id="file-suggestions" aria-label="Repository files">
        {matches.map((path, index) => <button key={path} id={"file-option-" + index} type="button" role="option"
          aria-selected={index === choice} onMouseDown={event => event.preventDefault()} onClick={() => attach(path)}>
          <span>{path.slice(path.lastIndexOf("/") + 1)} {path === selectedPath && <small>Current selection</small>}</span><code>{path}</code>
        </button>)}
        {!matches.length && <span className="mention-empty">{searching ? "Searching files…" : "No matching files"}</span>}
      </div>}
      {files.length > 0 && <div className="chat-files">{files.map(path => <button key={path} type="button" title={path} aria-label={"Remove " + path}
        onClick={() => setFiles(files.filter(value => value !== path))}>@{path} ×</button>)}</div>}
      <div className="chat-input-row">{expanded ? <button type="button" aria-label="Mention a repository file" onClick={() => {
        const start = input.current?.selectionStart ?? text.length;
        const end = input.current?.selectionEnd ?? start;
        const prefix = start && !/\s/.test(text[start - 1]) ? " @" : "@";
        const value = text.slice(0, start) + prefix + text.slice(end);
        setText(value); findMention(value, start + prefix.length);
        requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + prefix.length, start + prefix.length); });
      }}>@</button> : <button className="chat-toggle" type="button" aria-label="Show or hide saved chats" aria-expanded={expanded} onClick={toggle}>Chats</button>}
        <textarea ref={input} rows={1} aria-label="Message Codex" placeholder="Ask Codex…   @ to add a file" value={text}
          aria-controls={mention ? "file-suggestions" : undefined} aria-activedescendant={mention && matches[choice] ? "file-option-" + choice : undefined}
          onFocus={() => setActive(true)} onChange={event => { setText(event.target.value); findMention(event.target.value, event.target.selectionStart); }}
          onClick={event => findMention(text, event.currentTarget.selectionStart)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
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
