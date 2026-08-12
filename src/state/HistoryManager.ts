export interface HistoryAction {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

export class HistoryManager {
  private static instance: HistoryManager;
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistory: number = 40;
  private listeners: Array<() => void> = [];

  private constructor() {
    // Attach global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Avoid triggering inside input or textarea
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        this.redo();
      } else {
        e.preventDefault();
        this.undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
    }
  };

  public record(action: Omit<HistoryAction, 'id' | 'timestamp'>) {
    const entry: HistoryAction = {
      ...action,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };

    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // New action invalidates redo stack
    this.redoStack = [];
    this.notify();
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop()!;
    try {
      action.undo();
      this.redoStack.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error('History undo failed:', err);
      return false;
    }
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop()!;
    try {
      action.redo();
      this.undoStack.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error('History redo failed:', err);
      return false;
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoStack(): ReadonlyArray<HistoryAction> {
    return this.undoStack;
  }

  public getRedoStack(): ReadonlyArray<HistoryAction> {
    return this.redoStack;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}
