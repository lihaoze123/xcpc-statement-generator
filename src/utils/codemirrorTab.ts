import { EditorView } from "@codemirror/view";

export const insertFourSpaces = (view: EditorView): boolean => {
  view.dispatch(view.state.replaceSelection("    "));
  return true;
};

export const outdentFourSpaces = (view: EditorView): boolean => {
  const state = view.state;
  const lineNumbers = new Set<number>();

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endPos = range.empty ? range.to : Math.max(range.from, range.to - 1);
    const endLine = state.doc.lineAt(endPos).number;
    for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
      lineNumbers.add(lineNo);
    }
  }

  const changes: Array<{ from: number; to: number; insert: string }> = [];
  for (const lineNo of [...lineNumbers].sort((a, b) => a - b)) {
    const line = state.doc.line(lineNo);
    if (line.text.startsWith("    ")) {
      changes.push({ from: line.from, to: line.from + 4, insert: "" });
      continue;
    }
    if (line.text.startsWith("\t")) {
      changes.push({ from: line.from, to: line.from + 1, insert: "" });
      continue;
    }
    const match = line.text.match(/^ {1,3}/);
    if (match) {
      changes.push({ from: line.from, to: line.from + match[0].length, insert: "" });
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes, userEvent: "input.indent" });
  }
  return true;
};
