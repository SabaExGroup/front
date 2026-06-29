import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./token-owner-pool.component').then((m) => m.TokenOwnerPoolComponent),
    data: { title: 'Token Owner Pool' },
  },
];
