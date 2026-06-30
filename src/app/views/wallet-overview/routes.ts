import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./wallet-overview.component').then((m) => m.WalletOverviewComponent),
    data: { title: 'Wallet Overview' },
  },
];
