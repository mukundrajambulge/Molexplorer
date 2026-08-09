export interface HotkeyActionMap {
  onResetView?: () => void;
  onZoomSelection?: () => void;
  onClearSelection?: () => void;
  onToggleSequence?: () => void;
  onToggleCamera?: () => void;
  onExportSession?: () => void;
}

export class HotkeyManager {
  private actions: HotkeyActionMap;
  private listener: ((e: KeyboardEvent) => void) | null = null;

  constructor(actions: HotkeyActionMap) {
    this.actions = actions;
  }

  public register(): void {
    if (this.listener) return;

    this.listener = (e: KeyboardEvent) => {
      // Ignore key events when typing inside input or textarea elements
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && key === 's') {
        e.preventDefault();
        this.actions.onExportSession?.();
        return;
      }

      if (!ctrl && !e.shiftKey && !e.altKey) {
        if (key === 'r') {
          e.preventDefault();
          this.actions.onResetView?.();
        } else if (key === 'z') {
          e.preventDefault();
          this.actions.onZoomSelection?.();
        } else if (key === 'c') {
          e.preventDefault();
          this.actions.onClearSelection?.();
        } else if (key === 's') {
          e.preventDefault();
          this.actions.onToggleSequence?.();
        } else if (key === 'p') {
          e.preventDefault();
          this.actions.onToggleCamera?.();
        }
      }
    };

    window.addEventListener('keydown', this.listener);
  }

  public unregister(): void {
    if (this.listener) {
      window.removeEventListener('keydown', this.listener);
      this.listener = null;
    }
  }

  public updateActions(actions: HotkeyActionMap): void {
    this.actions = actions;
  }
}
