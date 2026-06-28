import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertComponent, ButtonDirective } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { EmergencyService } from '../../../core/services/emergency.service';

@Component({
  selector: 'app-halt-banner',
  template: `
    @if (emergency.haltStatus()?.halted) {
      <c-alert color="danger" class="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <strong>System Halted</strong>
          @if (emergency.haltStatus()?.halt?.reason) {
            — {{ emergency.haltStatus()?.halt?.reason }}
          }
          @if (emergency.haltStatus()?.halt?.since) {
            <small class="ms-2 text-body-secondary">since {{ emergency.haltStatus()?.halt?.since | date: 'short' }}</small>
          }
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <a cButton color="warning" size="sm" routerLink="/emergency">
            Resume
          </a>
          <a cButton color="light" size="sm" routerLink="/emergency">
            <svg cIcon name="cilWarning" class="me-1"></svg>
            Emergency
          </a>
        </div>
      </c-alert>
    }
  `,
  imports: [AlertComponent, ButtonDirective, RouterLink, IconDirective, DatePipe],
})
export class HaltBannerComponent {
  readonly emergency = inject(EmergencyService);
}
