import { Component, input } from '@angular/core';
import { BadgeComponent } from '@coreui/angular';
import { CycleStatus, cycleStatusBadgeColor } from '../../../core/models/enums';

@Component({
  selector: 'app-cycle-status-badge',
  template: `
    <c-badge [color]="color()">{{ status() }}</c-badge>
  `,
  imports: [BadgeComponent],
})
export class CycleStatusBadgeComponent {
  status = input.required<CycleStatus>();

  color(): string {
    return cycleStatusBadgeColor(this.status());
  }
}
