import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonDirective,
  FormControlDirective,
  FormLabelDirective,
  TableDirective,
} from '@coreui/angular';
import { SocialUrlKind, expandUrlPoolValue, splitUrlPoolText } from '../../../../core/utils/trend-social.util';

@Component({
  selector: 'app-social-url-pool-editor',
  templateUrl: './social-url-pool-editor.component.html',
  styleUrls: ['./social-url-pool-editor.component.scss'],
  imports: [FormsModule, ButtonDirective, FormControlDirective, FormLabelDirective, TableDirective],
})
export class SocialUrlPoolEditorComponent {
  label = input('');
  showLabel = input(true);
  kind = input.required<SocialUrlKind>();
  urls = input<string[]>([]);
  /** Bumped by parent only after load/save — avoids wiping in-progress edits when another pool changes. */
  resetKey = input(0);
  invalidUrls = input<string[]>([]);
  disabled = input(false);
  placeholder = input('https://...');

  urlsChange = output<string[]>();

  readonly rows = signal<string[]>([]);
  bulkPaste = '';

  constructor() {
    effect(() => {
      this.resetKey();
      this.rows.set([...(this.urls() ?? [])]);
    });
  }

  rowCount(): number {
    return this.rows().filter((url) => url.trim()).length;
  }

  rowInvalid(url: string): boolean {
    return this.invalidUrls().some((u) => u.trim() === url.trim());
  }

  updateRow(index: number, value: string): void {
    this.rows.update((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  commitRows(): void {
    this.urlsChange.emit(expandUrlPoolValue(this.rows()));
  }

  addRow(): void {
    this.rows.update((current) => [...current, '']);
    this.commitRows();
  }

  removeRow(index: number): void {
    this.rows.update((current) => current.filter((_, i) => i !== index));
    this.commitRows();
  }

  applyBulkPaste(): void {
    const lines = splitUrlPoolText(this.bulkPaste);
    if (lines.length === 0) return;

    const existing = expandUrlPoolValue(this.rows());
    this.rows.set([...existing, ...lines]);
    this.bulkPaste = '';
    this.commitRows();
  }
}
