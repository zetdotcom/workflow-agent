import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stages, type Board, type Change, type Document, type Stage, type Ticket } from "../server/model";
import "./style.css";

const archivePath = "#/archive";
const boardPath = "#/board";
const ticketsPath = boardPath + "/tickets";
const changePath = (id: string) => boardPath + "/changes/" + encodeURIComponent(id);
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

function ChangeCard({ change }: { change: Change }) {
  const done = change.tickets.filter(ticket => ticket.stage === "Done").length;
  const count = change.tickets.length;
  return <a className="card" href={changePath(change.id)}>
    <div className="card-top"><code>{changeKey(change.id)}</code><span aria-hidden="true">↗</span></div>
    <h3>{change.title}</h3>
    {change.goal && <p className="goal-preview"><Markdown remarkPlugins={[remarkGfm]} skipHtml
      allowedElements={[]} unwrapDisallowed>{change.goal}</Markdown></p>}
    <progress aria-label="Completed tickets" max={count || 1} value={done} />
    <small>{done} of {count} done</small>
  </a>;
}

type PanelLinkHandler = React.MouseEventHandler<HTMLAnchorElement>;

function TicketCard({ change, ticket, scoped, openPanel }: {
  change: Change; ticket: Ticket; scoped: boolean; openPanel: PanelLinkHandler;
}) {
  const parent = changePath(change.id);
  const ticketBase = scoped ? parent + "/tickets" : ticketsPath + "/" + encodeURIComponent(change.id);
  return <article className="card ticket-card">
    <h3><a className="ticket-link" href={ticketBase + "/" + encodeURIComponent(ticket.id)} onClick={openPanel}>
      <code>{ticketKey(ticket.id)}</code>
      {ticket.title}
    </a></h3>
    <a className="parent-link" href={parent} aria-label={"Parent change " + changeKey(change.id)}>
      <code>{changeKey(change.id)}</code>
    </a>
  </article>;
}

function Lanes<Item extends { stage: Stage }>({ items, renderCard, emptyLabel }: {
  items: Item[]; renderCard: (item: Item) => React.ReactNode; emptyLabel: string;
}) {
  return <div className="lanes">{stages.map(stage => {
    const laneItems = items.filter(item => item.stage === stage);
    return <section className={"lane s" + stageIndex(stage)} key={stage} aria-label={stage}>
      <h2><StageLabel stage={stage} /><span className="count">{laneItems.length}</span></h2>
      {laneItems.map(renderCard)}
      {!laneItems.length && <p className="empty">{emptyLabel}</p>}
    </section>;
  })}</div>;
}

type PanelProps = { title: string; id: string; close: string; children: React.ReactNode };
function Panel({ title, id, close, children }: PanelProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  function dismiss() {
    if (history.state?.panelFrom === close) {
      history.back();
    } else {
      location.replace(close);
    }
  }
  return <dialog ref={ref} aria-labelledby="detail-title" onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === ref.current) dismiss(); }}>
    <div className="sheet">
      <header className="sheet-bar"><code>{id}</code><button type="button" aria-label="Close details" className="close" onClick={dismiss}>×</button></header>
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
  const [, page, view, selected, action, scopedTicketId] = hash.split("/");
  const archive = page === "archive";
  const scoped = page === "board" && view === "changes" && Boolean(selected);
  const tickets = page === "board" && view === "tickets";
  const showTickets = scoped || tickets;
  const change = showTickets && board?.changes.find(item => encodeURIComponent(item.id) === selected);
  const ticketId = tickets ? action : action === "tickets" ? scopedTicketId : undefined;
  const ticket = change && change.tickets.find(item => encodeURIComponent(item.id) === ticketId);
  const record = archive && board?.archive.find(item => encodeURIComponent(item.folder) === view);
  const ticketChanges = scoped ? (change ? [change] : []) : board?.changes ?? [];
  const ticketCards = showTickets ? ticketChanges.flatMap(parent =>
    parent.tickets.map(item => ({ change: parent, ticket: item, stage: item.stage }))) : [];
  const count = archive ? board?.archive.length : showTickets ? ticketCards.length : board?.changes.length;
  const itemName = showTickets ? "ticket" : "change";
  const title = archive ? "Archive" : scoped && change ? change.title : "Change board";

  function openPanel(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({ panelFrom: location.hash }, "", event.currentTarget.href);
    setHash(location.hash);
  }

  useEffect(() => {
    document.title = title + (board ? " · " + board.repository : "") + " · wf-agent";
  }, [title, board?.repository]);

  return <>
    <header className="topbar">
      <a className="brand" href={boardPath}><span className="mark" aria-hidden="true">w</span>workflow-agent</a>
      <span className="repo">{board?.repository}</span>
      <nav aria-label="Workspace"><a href={boardPath} aria-current={!archive ? "page" : undefined}>Board</a><a href={archivePath} aria-current={archive ? "page" : undefined}>Archive</a></nav>
    </header>
    <main>
      {scoped && <a className="board-back" href={boardPath}>← Back to changes</a>}
      <div className="page-heading"><div>
        {scoped && change ? <p className="kicker">{changeKey(change.id)} · {count} {count === 1 ? "ticket" : "tickets"}</p>
          : board && !scoped && <p className="kicker">{count} {archive ? "archived " : tickets ? "" : "active "}{itemName}{count === 1 ? "" : "s"}</p>}
        <h1>{title}</h1></div>
        <div className="heading-actions">
          {!archive && !scoped && <nav className="view-toggle" aria-label="Board view">
            <a href={boardPath} aria-current={!tickets ? "page" : undefined}>Changes</a>
            <a href={ticketsPath} aria-current={tickets ? "page" : undefined}>Tickets</a>
          </nav>}
          {scoped && change && <a className="change-details" href={changePath(change.id) + "/details"} onClick={openPanel}>Change details</a>}
          <div className="connection" role="status"><i className={online && !error ? "live" : ""} />{error ? "Read error" : online ? "Live updates" : "Connecting…"}</div>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!board && !error && <p>Reading workflow…</p>}
      {board && !archive && !showTickets && <Lanes items={board.changes} emptyLabel="No changes"
        renderCard={item => <ChangeCard key={item.id} change={item} />} />}
      {board && showTickets && (!scoped || change) && <>
        {scoped && !ticketCards.length && <p className="board-message">No tickets yet.</p>}
        {ticketId && !ticket && <p className="board-message">This ticket is no longer on the board.</p>}
        <Lanes items={ticketCards} emptyLabel="No tickets"
          renderCard={item => <TicketCard key={JSON.stringify([item.change.id, item.ticket.id])}
            change={item.change} ticket={item.ticket} scoped={scoped} openPanel={openPanel} />} />
      </>}
      {board && scoped && !change && <p className="board-message">This change is no longer on the board.</p>}
      {board && archive && <section className="archive-list" aria-label="Archived changes">
        {board.archive.map(item => <a key={item.folder} href={archivePath + "/" + encodeURIComponent(item.folder)} onClick={openPanel}>
          <div><code>{changeKey(item.id)}</code><h3>{item.title}</h3></div>
          <span className="outcome">{item.outcome}</span><time>{item.date}</time><span aria-hidden="true">↗</span>
        </a>)}
        {!board.archive.length && <p className="empty">No archived changes</p>}
      </section>}
    </main>
    {scoped && change && action === "details" && <Panel key={hash} title={change.title} id={changeKey(change.id)} close={changePath(change.id)}>
      <StageLabel stage={change.stage} />
      {change.goal && <section><h3>Goal</h3><RichText text={change.goal} /></section>}
    </Panel>}
    {change && ticket && <Panel key={hash} title={ticket.title} id={changeKey(change.id) + " / " + ticketKey(ticket.id)}
      close={scoped ? changePath(change.id) : ticketsPath}>
      <StageLabel stage={ticket.stage} />
      {([["Goal", ticket.goal], ["Scope", ticket.scope], ["Delivery criteria", ticket.criteria]] as const).map(([label, value]) =>
        value && <section key={label}><h3>{label}</h3><RichText text={value} /></section>)}
      <section><h3>Documents</h3>{ticket.documents.map(doc =>
        <TicketDocument key={doc.label} document={doc} />)}</section>
    </Panel>}
    {record && <Panel key={hash} title={record.title} id={changeKey(record.id)} close={archivePath}>
      <p className="archive-meta">{record.date} · {record.outcome}</p>
      <RichText text={record.summary.replace(/^# [^\n]+\n?/, "")} />
    </Panel>}
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
