import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./cycles-list/cycles-list.component').then((m) => m.CyclesListComponent),
    data: { title: 'Cycles' },
  },
  {
    path: ':id',
    loadComponent: () => import('./cycle-detail/cycle-detail.component').then((m) => m.CycleDetailComponent),
    data: { title: 'Cycle Detail' },
  },
];
