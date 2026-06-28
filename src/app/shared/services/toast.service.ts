import { Injectable, signal } from '@angular/core';

export type ToastColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  title?: string;
  message: string;
  color: ToastColor;
  autohide: boolean;
  delay: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<ToastMessage[]>([]);

  show(message: string, color: ToastColor = 'info', title?: string, delay = 5000): void {
    const toast: ToastMessage = {
      id: this.nextId++,
      title,
      message,
      color,
      autohide: true,
      delay,
    };
    this.toasts.update((list) => [...list, toast]);
  }

  success(message: string, title?: string): void {
    this.show(message, 'success', title);
  }

  error(message: string, title = 'Error'): void {
    this.show(message, 'danger', title, 8000);
  }

  warning(message: string, title?: string): void {
    this.show(message, 'warning', title);
  }

  info(message: string, title?: string): void {
    this.show(message, 'info', title);
  }

  remove(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
