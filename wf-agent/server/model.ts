export const stages = ["Draft", "To Do", "In Progress", "Done"] as const;
export type Stage = typeof stages[number];

export interface Document {
  label: string;
  markdown: string;
}

export interface Ticket {
  id: string;
  title: string;
  stage: Stage;
  goal: string;
  scope: string;
  criteria: string;
  documents: Document[];
}

export interface Change {
  id: string;
  title: string;
  goal: string;
  stage: Stage;
  tickets: Ticket[];
}

export interface ArchivedChange {
  folder: string;
  id: string;
  title: string;
  date: string;
  outcome: string;
  summary: string;
}

export interface Board {
  repository: string;
  changes: Change[];
  archive: ArchivedChange[];
}
