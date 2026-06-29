import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./social-links.component').then((m) => m.SocialLinksComponent),
    data: { title: 'Social Links' },
  },
];
