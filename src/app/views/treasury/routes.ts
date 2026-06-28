import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./treasury.component').then((m) => m.TreasuryComponent),
    data: { title: 'Treasury' },
  },
];
