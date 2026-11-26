import { isUtf8 } from "node:buffer";
import type { FileHandle } from "node:fs/promises";
import { ChatError, displayText } from "./chat-model.js";

async function readBytes(handle: FileHandle, start: number, length: number, name: string, signal?: AbortSignal) {
  const bytes = Buffer.alloc(length);
  let used = 0;
  while (used < length) {
    signal?.throwIfAborted();
    const { bytesRead } = await handle.read(bytes, used, length - used, start + used);
    if (!bytesRead) throw new ChatError(409, "File changed while reading: " + name);
    used += bytesRead;
  }
  if (bytes.includes(0)) throw new ChatError(400, "Binary file: " + name);
  return bytes;
}

// Offsets are file bytes. Inspect complete credential fields before selecting a page, even when
// their beginning or end is far from the requested offset. The two windows never retain a whole file.
class FileText {
  private origin = 0;
  private text = "";
  constructor(private handle: FileHandle, readonly size: number, private name: string, private signal?: AbortSignal) {}

  async at(position: number, minimum = 1) {
    this.signal?.throwIfAborted();
    if (position >= this.size) return "";
    if (position < this.origin || position + Math.min(minimum, this.size - position) > this.origin + this.text.length) {
      const start = Math.max(0, position - 3);
      const bytes = await readBytes(this.handle, start, Math.min(64 * 1024, this.size - start), this.name, this.signal);
      let head = 0;
      if (start) while (head < 3 && (bytes[head] & 0xc0) === 0x80) head++;
      let decoded: string;
      try {
        decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(head), { stream: start + bytes.length < this.size });
      } catch { throw new ChatError(400, "Choose a UTF-8 text file: " + this.name); }
      this.origin = start + head;
      // Redaction syntax is ASCII. Preserve UTF-8 byte offsets and Unicode whitespace for its character classes.
      this.text = decoded.replace(/[^\x00-\x7f]/gu, character => (/\s/u.test(character) ? " " : "\x80").repeat(Buffer.byteLength(character)));
    }
    return this.text.slice(position - this.origin);
  }

  async peek(position: number, length = 1) { return (await this.at(position, length)).slice(0, length); }

  async until(position: number, stop: RegExp) {
    while (position < this.size) {
      const text = await this.at(position);
      const index = text.search(stop);
      if (index >= 0) return position + index;
      position += text.length;
    }
    return this.size;
  }

  async *matches(start: number, limit: number, pattern: RegExp) {
    while (start < limit) {
      const text = await this.at(start, 64);
      // Every opener is shorter than the overlap, including a marker crossing two I/O windows.
      const used = start + text.length < this.size ? text.length - 32 : text.length;
      for (const match of text.matchAll(pattern)) {
        const index = match.index!;
        if (index >= used || start + index >= limit) break;
        const rule = match.findIndex((value, index) => index > 0 && value !== undefined);
        yield { at: start + index, prefix: rule < 0 ? match[0] : match[rule], rule };
      }
      start += used;
    }
  }
}

type Mask = { start: number; end: number; replacement: string; incomplete?: boolean };
// The capture order follows displayText. A zero-width lookahead also finds overlapping names such as "secretoken".
const credentialOpeners = /(?=(-----BEGIN )|(https?:\/\/)|(Bearer|Basic)|(api[_-]?key|token|password|secret|authorization)|(sk-|gh[pousr]_|github_pat_|xox[baprs]-|AKIA))/gi;
async function credential(file: FileText, at: number, prefix: string): Promise<Mask | undefined> {
  const after = at + prefix.length;
  const mask = (start: number, end: number, replacement = "[redacted]") => ({ start, end, replacement });
  if (prefix === "-----BEGIN ") {
    const headerEnd = await file.until(after, /[^A-Z ]/);
    if (headerEnd - after < 11 || await file.peek(headerEnd - 11, 16) !== "PRIVATE KEY-----") return;
    const length = headerEnd - after + 5;
    for await (const marker of file.matches(headerEnd + 5, file.size, /-----END /g)) {
      const tag = marker.at + marker.prefix.length;
      let matched = 0;
      while (matched < length) {
        const step = Math.min(1024, length - matched);
        if (await file.peek(after + matched, step) !== await file.peek(tag + matched, step)) break;
        matched += step;
      }
      if (matched === length) return mask(at, tag + length, "[redacted private key]");
    }
    // An unterminated private key is unsafe to expose.
    return { ...mask(at, file.size, "[redacted private key]"), incomplete: true };
  }
  if (/^https?:/i.test(prefix)) {
    const end = await file.until(after, /[\/\s?#@]/);
    if (end - after < 3 || await file.peek(end) !== "@") return;
    const colon = await file.until(after + 1, /[:\/\s?#@]/);
    if (colon < end - 1) return mask(after, end);
    return;
  }
  if (/^(api[_-]?key|token|password|secret|authorization)$/i.test(prefix)) {
    const quote = await file.peek(after);
    const separator = await file.until(after + (quote === "'" || quote === '"' ? 1 : 0), /\S/);
    if (!/[:=]/.test(await file.peek(separator))) return;
    const start = await file.until(separator + 1, /\S/);
    const first = await file.peek(start);
    if (first === '"' || first === "'") {
      const end = await file.until(start + 1, first === '"' ? /["\n]/ : /['\n]/);
      if (await file.peek(end) === first) return mask(start, end + 1);
    }
    const end = await file.until(start, /[\s,;}]/);
    return end > start ? mask(start, end) : undefined;
  }
  if (at && /\w/.test(await file.peek(at - 1))) return;
  if (/^(Bearer|Basic)$/i.test(prefix)) {
    const start = await file.until(after, /\S/);
    if (start === after) return;
    const end = await file.until(start, /[\s"']/);
    return end > start ? mask(after, end, " [redacted]") : undefined;
  }
  if (prefix === "AKIA") {
    if (/^[A-Z0-9]{16}(?!\w)/.test(await file.peek(after, 17))) return mask(at, after + 16);
    return;
  }
  if (!/^(?:sk-|gh[pousr]_|github_pat_|xox[baprs]-)$/.test(prefix)) return;
  const hyphens = prefix.endsWith("-");
  let end = await file.until(after, hyphens ? /[^\w-]/ : /[^\w]/);
  // A trailing hyphen has no word boundary before whitespace. Trim it as the shared display pattern does.
  while (hyphens && end > after) {
    const part = Math.max(after, end - 1024);
    const length = end - part;
    const tail = (await file.peek(part, length)).match(/-+$/)?.[0].length ?? 0;
    end -= tail;
    if (tail < length) break;
  }
  return end - after >= (prefix.startsWith("xox") ? 1 : 12) ? mask(at, end) : undefined;
}

export async function readPublicPage(handle: FileHandle, name: string, offset: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const before = await handle.stat({ bigint: true });
  const size = Number(before.size);
  if (offset >= size) return { path: name, text: "", nextOffset: null };
  const start = Math.max(0, offset - 3);
  const page = await readBytes(handle, start, Math.min(size - start, offset - start + 24_576 + 3), name, signal);
  const used = page.length;
  if (!offset && size <= 24_576 && !page.includes("-----BEGIN ")) {
    if (!isUtf8(page)) throw new ChatError(400, "Choose a UTF-8 text file: " + name);
    return { path: name, text: displayText(page.toString("utf8")), nextOffset: null };
  }
  let first = offset - start;
  while (first < used && (page[first] & 0xc0) === 0x80) first++;
  let last = Math.min(used, offset - start + 24_576);
  while (last < used && (page[last] & 0xc0) === 0x80) last--;
  const end = start + last;
  const search = new FileText(handle, size, name, signal);
  const fields = new FileText(handle, size, name, signal);
  // At most one interval per byte of the visible page. An overlap at its beginning can come from arbitrarily far back.
  const masks = new Map<number, Mask>();
  const consumed = [0, 0, 0, 0, 0, 0];
  for await (const marker of search.matches(0, end, credentialOpeners)) {
    if (marker.at < consumed[marker.rule]) continue;
    const part = await credential(fields, marker.at, marker.prefix);
    if (!part) continue;
    // A replacement consumes its input for this and later rules. Nested openers must never rescan it to EOF.
    for (let rule = marker.rule; rule < consumed.length; rule++) consumed[rule] = Math.max(consumed[rule], part.end);
    if (part.end <= start + first || part.start >= end) continue;
    // The shared redactor handles complete fields. Only trim a field here if the page splits it or the key is incomplete.
    if (!part.incomplete && marker.at >= start + first && part.end <= end) continue;
    const position = Math.max(start + first, part.start);
    const old = masks.get(position);
    if (!old || old.end < part.end) masks.set(position, part);
  }
  let cursor = start + first;
  let text = "";
  for (const part of [...masks.values()].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (part.end <= cursor) continue;
    if (part.start >= cursor) text += page.toString("utf8", cursor - start, part.start - start) + part.replacement;
    cursor = part.end;
  }
  if (cursor < end) text += page.toString("utf8", cursor - start, last);
  const after = await handle.stat({ bigint: true });
  if (before.size !== after.size || before.ctimeNs !== after.ctimeNs) throw new ChatError(409, "File changed while reading: " + name);
  const next = Math.max(cursor, end);
  signal?.throwIfAborted();
  return { path: name, text: displayText(text), nextOffset: next < size ? next : null };
}
