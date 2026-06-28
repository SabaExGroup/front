import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  FormControlDirective,
  FormLabelDirective,
  FormSelectDirective,
  RowComponent,
} from '@coreui/angular';
import { SettingsFieldConfig } from '../../settings-field-config';
import { getControlByPath } from '../../settings-form.util';

@Component({
  selector: 'app-settings-field-grid',
  templateUrl: './settings-field-grid.component.html',
  imports: [
    ReactiveFormsModule,
    RowComponent,
    FormLabelDirective,
    FormControlDirective,
    FormSelectDirective,
  ],
})
export class SettingsFieldGridComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) path!: string;
  @Input({ required: true }) fields!: SettingsFieldConfig[];

  control(field: SettingsFieldConfig) {
    const fullPath = this.path ? `${this.path}.${field.key}` : field.key;
    return getControlByPath(this.form, fullPath);
  }

  colClass(field: SettingsFieldConfig): string {
    return `col-md-${field.col ?? 6} mb-3`;
  }
}
