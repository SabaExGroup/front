import { Component, Input } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  FormControlDirective,
  TableDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { buildPeakWindowGroup } from '../../settings-form.util';

@Component({
  selector: 'app-settings-peak-windows',
  templateUrl: './settings-peak-windows.component.html',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    FormControlDirective,
    ButtonDirective,
    TableDirective,
    IconDirective,
  ],
})
export class SettingsPeakWindowsComponent {
  private readonly fb = new FormBuilder();

  @Input({ required: true }) form!: FormGroup;

  get peakWindows(): FormArray | null {
    return this.form.get('strategy.cycleSchedule.peakWindows') as FormArray | null;
  }

  addWindow(): void {
    const schedule = this.ensureCycleScheduleGroup();
    let arr = schedule.get('peakWindows') as FormArray | null;
    if (!arr) {
      arr = this.fb.array([]);
      schedule.addControl('peakWindows', arr);
    }
    arr.push(buildPeakWindowGroup(this.fb, { days: [1, 2, 3, 4, 5], startHourUtc: 14, endHourUtc: 22, label: 'new_window' }));
  }

  removeWindow(index: number): void {
    this.peakWindows?.removeAt(index);
  }

  private ensureCycleScheduleGroup(): FormGroup {
    let strategy = this.form.get('strategy') as FormGroup | null;
    if (!strategy) {
      strategy = this.fb.group({});
      this.form.addControl('strategy', strategy);
    }
    let schedule = strategy.get('cycleSchedule') as FormGroup | null;
    if (!schedule) {
      schedule = this.fb.group({});
      strategy.addControl('cycleSchedule', schedule);
    }
    return schedule;
  }

  asGroup(control: unknown): FormGroup {
    return control as FormGroup;
  }
}
