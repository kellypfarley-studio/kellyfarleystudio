import type { NotesState } from "../types/appTypes";

export type NotesSectionProps = {
  notes: NotesState;
  onChange: (patch: Partial<NotesState>) => void;
};

export default function NotesSection({ notes, onChange }: NotesSectionProps) {
  return (
    <div className="card bottomBand notesGrid">
      <div>
        <div className="panelTitle">Customer’s notes for project:</div>
        <textarea value={notes.customerNotes} onChange={(e) => onChange({ customerNotes: e.target.value })} />
        <div className="muted smallLabel">DFA Agreement (PDF export will include signature pages later)</div>
      </div>

      <div>
        <div className="panelTitle">Artist notes:</div>
        <textarea value={notes.artistNotes} onChange={(e) => onChange({ artistNotes: e.target.value })} />
      </div>
    </div>
  );
}
