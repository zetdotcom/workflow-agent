import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stages, type Board, type Change, type Document, type Stage } from "../server/model";
import "./style.css";

const archivePath = "#/archive";
const boardPath = "#/board";
const changePath = (id: string) => boardPath + "/" + encodeURIComponent(id);
const stageIndex = (stage: Stage) => stages.indexOf(stage);
const changeKey = (id: string) => /^[A-Za-z][A-Za-z0-9]*-\d+(?=-|$)/.exec(id)?.[0] ?? id;
const ticketKey = (id: string) => id.split("-")[0];

function RichText({ text }: { text: string }) {
  return <div className="markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    img: ({ alt }) => <span>{alt}</span>,
    a: ({ href, children }) => /^https?:\/\//i.test(href ?? "")
      ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>
  }}>{text}</Markdown></div>;
}

function TicketDocument({ document }: { document: Document }) {
  const [expanded, setExpanded] = useState(false);
  return <details onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>{document.label}</summary>
    {expanded && <RichText text={document.markdown} />}
  </details>;
}

function useBoard() {
  const [board, setBoard] = useState<Board>();
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const stream = new EventSource("/api/events");
    let active: AbortController | undefined;
    stream.addEventListener("update", async () => {
      active?.abort();
      const request = new AbortController();
      active = request;
      try {
        const response = await fetch("/api/board", { signal: request.signal });
        if (!response.ok) throw new Error(await response.text());
        const snapshot: Board = await response.json();
        if (!request.signal.aborted) { setBoard(snapshot); setError(""); }
      } catch (cause) {
        if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not read the workflow.");
      }
    });
    stream.onopen = () => setOnline(true);
    stream.onerror = () => setOnline(false);
    return () => { stream.close(); active?.abort(); };
  }, []);
  return { board, error, online };
}

function StageLabel({ stage }: { stage: Stage }) {
  return <span className={"stage s" + stageIndex(stage)}><i aria-hidden="true" />{stage}</span>;
}

function Card({ change }: { change: Change }) {
  const done = change.tickets.filter(ticket => ticket.stage === "Done").length;
  const count = change.tickets.length;
  return <a className="card" href={changePath(change.id)}>
    <div className="card-top"><code>{changeKey(change.id)}</code><span aria-hidden="true">↗</span></div>
    <h3>{change.title}</h3>
    <progress aria-label="Completed tickets" max={count || 1} value={done} />
    <small>{done} of {count} done</small>
  </a>;
}

type PanelProps = { title: string; id: string; close: string; children: React.ReactNode };
function Panel({ title, id, close, children }: PanelProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => { ref.current?.querySelector<HTMLElement>(".sheet-body")?.scrollTo(0, 0); }, [id]);
  return <dialog ref={ref} aria-labelledby="detail-title" onCancel={event => { event.preventDefault(); location.hash = close; }}
    onClick={event => { if (event.target === ref.current) location.hash = close; }}>
    <div className="sheet">
      <header className="sheet-bar"><code>{id}</code><a href={close} aria-label="Close details" className="close">×</a></header>
      <div className="sheet-body"><h2 id="detail-title">{title}</h2>{children}</div>
    </div>
  </dialog>;
}

function App() {
  const { board, error, online } = useBoard();
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const [, page, selected, sub] = hash.split("/");
  const archive = page === "archive";
  const change = !archive && board?.changes.find(item => encodeURIComponent(item.id) === selected);
  const ticket = change && change.tickets.find(item => encodeURIComponent(item.id) === sub);
  const record = archive && board?.archive.find(item => encodeURIComponent(item.folder) === selected);
  const count = archive ? board?.archive.length : board?.changes.length;
  useEffect(() => {
    document.title = (archive ? "Archive" : "Change board") + (board ? " · " + board.repository : "") + " · wf-agent";
  }, [archive, board?.repository]);

  return <>
    <header className="topbar">
      <a className="brand" href={boardPath}><span className="mark" aria-hidden="true">w</span>workflow-agent</a>
      <span className="repo">{board?.repository}</span>
      <nav aria-label="Workspace"><a href={boardPath} aria-current={!archive ? "page" : undefined}>Board</a><a href={archivePath} aria-current={archive ? "page" : undefined}>Archive</a></nav>
    </header>
    <main>
      <div className="page-heading"><div>
        {count !== undefined && <p className="kicker">{count} {archive ? "archived" : "active"} {count === 1 ? "change" : "changes"}</p>}
        <h1>{archive ? "Archive" : "Change board"}</h1></div>
        <div className="connection" role="status"><i className={online && !error ? "live" : ""} />{error ? "Read error" : online ? "Live updates" : "Connecting…"}</div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!board && !error && <p>Reading workflow…</p>}
      {board && !archive && <div className="lanes">{stages.map(stage => {
        const items = board.changes.filter(item => item.stage === stage);
        return <section className={"lane s" + stageIndex(stage)} key={stage} aria-label={stage}>
          <h2><StageLabel stage={stage} /><span className="count">{items.length}</span></h2>
          {items.map(item => <Card change={item} key={item.id} />)}
          {!items.length && <p className="empty">No changes</p>}
        </section>;
      })}</div>}
      {board && archive && <section className="archive-list" aria-label="Archived changes">
        {board.archive.map(item => <a key={item.folder} href={archivePath + "/" + encodeURIComponent(item.folder)}>
          <div><code>{changeKey(item.id)}</code><h3>{item.title}</h3></div>
          <span className="outcome">{item.outcome}</span><time>{item.date}</time><span aria-hidden="true">↗</span>
        </a>)}
        {!board.archive.length && <p className="empty">No archived changes</p>}
      </section>}
    </main>
    {change && !ticket && <Panel title={change.title} id={changeKey(change.id)} close={boardPath}>
      <StageLabel stage={change.stage} />
      {change.goal && <section><h3>Goal</h3><RichText text={change.goal} /></section>}
      <section><h3>Tickets <small>{change.tickets.length}</small></h3>
        {change.tickets.map(item => <a className="ticket-row" key={item.id} href={changePath(change.id) + "/" + encodeURIComponent(item.id)}>
          <code>{ticketKey(item.id)}</code><strong>{item.title}</strong><StageLabel stage={item.stage} />
        </a>)}
        {!change.tickets.length && <p>No tickets yet.</p>}
      </section>
    </Panel>}
    {change && ticket && <Panel title={ticket.title} id={changeKey(change.id) + " / " + ticketKey(ticket.id)} close={boardPath}>
      <a className="back" href={changePath(change.id)}>← {change.title}</a><StageLabel stage={ticket.stage} />
      {([["Goal", ticket.goal], ["Scope", ticket.scope], ["Delivery criteria", ticket.criteria]] as const).map(([label, value]) =>
        value && <section key={label}><h3>{label}</h3><RichText text={value} /></section>)}
      <section><h3>Documents</h3>{ticket.documents.map(doc =>
        <TicketDocument key={ticket.id + doc.label} document={doc} />)}</section>
    </Panel>}
    {record && <Panel title={record.title} id={changeKey(record.id)} close={archivePath}>
      <p className="archive-meta">{record.date} · {record.outcome}</p>
      <RichText text={record.summary.replace(/^# [^\n]+\n?/, "")} />
    </Panel>}
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
