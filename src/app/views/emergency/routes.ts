import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./emergency.component').then((m) => m.EmergencyComponent),
    data: { title: 'Emergency' },
  },
];
