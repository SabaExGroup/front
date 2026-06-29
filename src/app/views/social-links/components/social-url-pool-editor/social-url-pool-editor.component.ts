import { Component, Input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonDirective,
  FormControlDirective,
  FormLabelDirective,
} from '@coreui/angular';
import { SocialUrlKind } from '../../../../core/utils/trend-social.util';

@Component({
  selector: 'app-social-url-pool-editor',
  templateUrl: './social-url-pool-editor.component.html',
  styleUrls: ['./social-url-pool-editor.component.scss'],
  imports: [FormsModule, ButtonDirective, FormControlDirective, FormLabelDirective],
})
export class SocialUrlPoolEditorComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) kind!: SocialUrlKind;
  @Input({ required: true }) urls: string[] = [];
  @Input() invalidUrls: string[] = [];
  @Input() disabled = false;
  @Input() placeholder = 'https://...';

  urlsChange = output<string[]>();

  bulkPaste = '';

  rowInvalid(url: string): boolean {
    return this.invalidUrls.some((u) => u.trim() === url.trim());
  }

  updateRow(index: number, value: string): void {
    const next = [...this.urls];
    next[index] = value;
    this.urlsChange.emit(next);
  }

  addRow(): void {
    this.urlsChange.emit([...this.urls, '']);
  }

  removeRow(index: number): void {
    const next = this.urls.filter((_, i) => i !== index);
    this.urlsChange.emit(next);
  }

  applyBulkPaste(): void {
    const lines = this.bulkPaste
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const existing = this.urls.map((u) => u.trim()).filter(Boolean);
    this.urlsChange.emit([...existing, ...lines]);
    this.bulkPaste = '';
  }
}
