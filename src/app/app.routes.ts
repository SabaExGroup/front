import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () => import('./layout').then((m) => m.DefaultLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        data: { title: 'Dashboard' },
        loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes),
      },
      {
        path: 'cycles',
        data: { title: 'Cycles' },
        loadChildren: () => import('./views/cycles/routes').then((m) => m.routes),
      },
      {
        path: 'settings',
        data: { title: 'Settings' },
        loadChildren: () => import('./views/settings/routes').then((m) => m.routes),
      },
      {
        path: 'emergency',
        data: { title: 'Emergency' },
        loadChildren: () => import('./views/emergency/routes').then((m) => m.routes),
      },
      {
        path: 'treasury',
        data: { title: 'Treasury' },
        loadChildren: () => import('./views/treasury/routes').then((m) => m.routes),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () => import('./views/pages/login/login.component').then((m) => m.LoginComponent),
    data: { title: 'Login' },
  },
  {
    path: '404',
    loadComponent: () => import('./views/pages/page404/page404.component').then((m) => m.Page404Component),
    data: { title: 'Page 404' },
  },
  {
    path: '500',
    loadComponent: () => import('./views/pages/page500/page500.component').then((m) => m.Page500Component),
    data: { title: 'Page 500' },
  },
  { path: '**', redirectTo: 'dashboard' },
];
