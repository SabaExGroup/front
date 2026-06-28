import { Component, inject } from '@angular/core';
import {
  ToastBodyComponent,
  ToastComponent,
  ToasterComponent,
  ToastHeaderComponent,
} from '@coreui/angular';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <c-toaster placement="top-end" class="p-3">
      @for (toast of toastService.toasts(); track toast.id) {
        <c-toast
          [autohide]="toast.autohide"
          [delay]="toast.delay"
          [color]="toast.color"
          (visibleChange)="onVisibleChange($event, toast.id)"
          visible
        >
          @if (toast.title) {
            <c-toast-header>{{ toast.title }}</c-toast-header>
          }
          <c-toast-body>{{ toast.message }}</c-toast-body>
        </c-toast>
      }
    </c-toaster>
  `,
  imports: [
    ToasterComponent,
    ToastComponent,
    ToastHeaderComponent,
    ToastBodyComponent,
  ],
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  onVisibleChange(visible: boolean, id: number): void {
    if (!visible) {
      this.toastService.remove(id);
    }
  }
}
