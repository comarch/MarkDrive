// Cap keeps the LCS table ((rows + 1) * (cols + 1) * 4 bytes) bounded; 2000
// lines is about 16 MB per diff, safe for mobile browsers.
const MAX_DIFF_LINES = 2000;

export interface DiffRow {
  type: "equal" | "removed" | "added";
  left?: string;
  leftNumber?: number;
  right?: string;
  rightNumber?: number;
}

export interface MergeResult {
  content: string;
  hasConflicts: boolean;
}

interface Change {
  start: number;
  end: number;
  replacement: string[];
}

interface MergeEvent {
  side: "local" | "remote";
  change: Change;
}

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.split("\n");
}

function appendRemovedRows(rows: DiffRow[], lines: string[]): void {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line !== undefined) {
      rows.push({
        type: "removed",
        left: line,
        leftNumber: index + 1,
      });
    }
  }
}

function appendAddedRows(rows: DiffRow[], lines: string[]): void {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line !== undefined) {
      rows.push({
        type: "added",
        right: line,
        rightNumber: index + 1,
      });
    }
  }
}

function computeDiffRows(aLines: string[], bLines: string[]): DiffRow[] {
  const rows: DiffRow[] = [];

  if (aLines.length > MAX_DIFF_LINES || bLines.length > MAX_DIFF_LINES) {
    // Avoid quadratic memory and time growth for very large documents.
    appendRemovedRows(rows, aLines);
    appendAddedRows(rows, bLines);
    return rows;
  }

  const width = bLines.length + 1;
  const table = new Uint32Array((aLines.length + 1) * width);
  const tableIndex = (row: number, column: number): number =>
    row * width + column;
  const tableValue = (row: number, column: number): number =>
    table[tableIndex(row, column)] ?? 0;

  for (let aIndex = aLines.length - 1; aIndex >= 0; aIndex -= 1) {
    const aLine = aLines[aIndex];

    if (aLine === undefined) {
      continue;
    }

    for (let bIndex = bLines.length - 1; bIndex >= 0; bIndex -= 1) {
      const bLine = bLines[bIndex];

      if (bLine === undefined) {
        continue;
      }

      if (aLine === bLine) {
        table[tableIndex(aIndex, bIndex)] =
          tableValue(aIndex + 1, bIndex + 1) + 1;
      } else {
        const skipA = tableValue(aIndex + 1, bIndex);
        const skipB = tableValue(aIndex, bIndex + 1);
        table[tableIndex(aIndex, bIndex)] = skipA >= skipB ? skipA : skipB;
      }
    }
  }

  let aIndex = 0;
  let bIndex = 0;

  while (aIndex < aLines.length || bIndex < bLines.length) {
    const aLine = aLines[aIndex];
    const bLine = bLines[bIndex];

    if (aLine !== undefined && bLine !== undefined && aLine === bLine) {
      rows.push({
        type: "equal",
        left: aLine,
        leftNumber: aIndex + 1,
        right: bLine,
        rightNumber: bIndex + 1,
      });
      aIndex += 1;
      bIndex += 1;
    } else if (aIndex < aLines.length && bIndex < bLines.length) {
      const skipA = tableValue(aIndex + 1, bIndex);
      const skipB = tableValue(aIndex, bIndex + 1);

      if (skipA >= skipB) {
        if (aLine !== undefined) {
          rows.push({
            type: "removed",
            left: aLine,
            leftNumber: aIndex + 1,
          });
        }
        aIndex += 1;
      } else {
        if (bLine !== undefined) {
          rows.push({
            type: "added",
            right: bLine,
            rightNumber: bIndex + 1,
          });
        }
        bIndex += 1;
      }
    } else if (aIndex < aLines.length) {
      if (aLine !== undefined) {
        rows.push({
          type: "removed",
          left: aLine,
          leftNumber: aIndex + 1,
        });
      }
      aIndex += 1;
    } else {
      if (bLine !== undefined) {
        rows.push({
          type: "added",
          right: bLine,
          rightNumber: bIndex + 1,
        });
      }
      bIndex += 1;
    }
  }

  return rows;
}

export function diffLines(a: string, b: string): DiffRow[] {
  return computeDiffRows(splitLines(a), splitLines(b));
}

function buildChanges(baseLines: string[], targetLines: string[]): Change[] {
  const changes: Change[] = [];
  const rows = computeDiffRows(baseLines, targetLines);
  let baseIndex = 0;
  let currentChange: Change | null = null;

  const flushChange = (): void => {
    if (currentChange !== null) {
      changes.push(currentChange);
      currentChange = null;
    }
  };

  for (const row of rows) {
    if (row.type === "equal") {
      flushChange();
      baseIndex += 1;
    } else if (row.type === "removed") {
      if (currentChange === null) {
        currentChange = {
          start: baseIndex,
          end: baseIndex,
          replacement: [],
        };
      }
      currentChange.end += 1;
      baseIndex += 1;
    } else {
      if (currentChange === null) {
        currentChange = {
          start: baseIndex,
          end: baseIndex,
          replacement: [],
        };
      }

      if (row.right !== undefined) {
        currentChange.replacement.push(row.right);
      }
    }
  }

  flushChange();
  return changes;
}

function changesOverlap(left: Change, right: Change): boolean {
  const leftIsInsertion = left.start === left.end;
  const rightIsInsertion = right.start === right.end;

  if (leftIsInsertion && rightIsInsertion) {
    return left.start === right.start;
  }

  if (leftIsInsertion) {
    return (
      left.start === right.start ||
      (right.start < left.start && left.start < right.end)
    );
  }

  if (rightIsInsertion) {
    return (
      right.start === left.start ||
      (left.start < right.start && right.start < left.end)
    );
  }

  return left.start < right.end && right.start < left.end;
}

function buildChangeClusters(
  localChanges: Change[],
  remoteChanges: Change[],
): MergeEvent[][] {
  const events: MergeEvent[] = [
    ...localChanges.map((change) => ({ side: "local" as const, change })),
    ...remoteChanges.map((change) => ({ side: "remote" as const, change })),
  ];

  events.sort((left, right) => {
    if (left.change.start !== right.change.start) {
      return left.change.start - right.change.start;
    }

    if (left.change.end !== right.change.end) {
      return left.change.end - right.change.end;
    }

    return left.side === "local" ? -1 : 1;
  });

  const clusters: MergeEvent[][] = [];
  let currentCluster: MergeEvent[] = [];

  for (const event of events) {
    const overlapsCurrent = currentCluster.some((currentEvent) =>
      changesOverlap(currentEvent.change, event.change),
    );

    if (currentCluster.length === 0 || overlapsCurrent) {
      currentCluster.push(event);
    } else {
      clusters.push(currentCluster);
      currentCluster = [event];
    }
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters;
}

function renderChanges(
  baseLines: string[],
  start: number,
  end: number,
  changes: Change[],
): string[] {
  const rendered: string[] = [];
  let cursor = start;

  for (const change of changes) {
    if (change.start > cursor) {
      rendered.push(...baseLines.slice(cursor, change.start));
    }

    rendered.push(...change.replacement);
    cursor = Math.max(cursor, change.end);
  }

  if (cursor < end) {
    rendered.push(...baseLines.slice(cursor, end));
  }

  return rendered;
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function conflictBlock(
  localLines: string[],
  baseLines: string[],
  remoteLines: string[],
): string[] {
  // Marker-like input remains plain text; only generated markers delimit conflicts.
  return [
    "<<<<<<< LOCAL",
    ...localLines,
    "||||||| BASE",
    ...baseLines,
    "=======",
    ...remoteLines,
    ">>>>>>> REMOTE",
  ];
}

export function threeWayMerge(
  base: string,
  local: string,
  remote: string,
): MergeResult {
  const baseLines = splitLines(base);
  const localChanges = buildChanges(baseLines, splitLines(local));
  const remoteChanges = buildChanges(baseLines, splitLines(remote));
  const clusters = buildChangeClusters(localChanges, remoteChanges);
  const mergedLines: string[] = [];
  let baseCursor = 0;
  let hasConflicts = false;

  for (const cluster of clusters) {
    let start = cluster[0]?.change.start;
    let end = cluster[0]?.change.end;

    if (start === undefined || end === undefined) {
      continue;
    }

    for (const event of cluster) {
      start = Math.min(start, event.change.start);
      end = Math.max(end, event.change.end);
    }

    if (start > baseCursor) {
      mergedLines.push(...baseLines.slice(baseCursor, start));
    }

    const localEvents = cluster.filter((event) => event.side === "local");
    const remoteEvents = cluster.filter((event) => event.side === "remote");
    const localClusterChanges = localEvents.map((event) => event.change);
    const remoteClusterChanges = remoteEvents.map((event) => event.change);
    const baseClusterLines = baseLines.slice(start, end);

    if (localEvents.length === 0) {
      mergedLines.push(
        ...renderChanges(baseLines, start, end, remoteClusterChanges),
      );
    } else if (remoteEvents.length === 0) {
      mergedLines.push(
        ...renderChanges(baseLines, start, end, localClusterChanges),
      );
    } else {
      const localClusterLines = renderChanges(
        baseLines,
        start,
        end,
        localClusterChanges,
      );
      const remoteClusterLines = renderChanges(
        baseLines,
        start,
        end,
        remoteClusterChanges,
      );

      if (arraysEqual(localClusterLines, remoteClusterLines)) {
        mergedLines.push(...localClusterLines);
      } else {
        mergedLines.push(
          ...conflictBlock(
            localClusterLines,
            baseClusterLines,
            remoteClusterLines,
          ),
        );
        hasConflicts = true;
      }
    }

    baseCursor = Math.max(baseCursor, end);
  }

  mergedLines.push(...baseLines.slice(baseCursor));

  return {
    content: mergedLines.join("\n"),
    hasConflicts,
  };
}
