import { INavData } from '@coreui/angular';

export type AppNavItem = INavData & {
  name: string;
  url: string;
};

export const navItems: INavData[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' },
  },
  {
    name: 'Cycles',
    url: '/cycles',
    iconComponent: { name: 'cil-loop' },
  },
  {
    title: true,
    name: 'Operations',
  },
  {
    name: 'Emergency',
    url: '/emergency',
    iconComponent: { name: 'cilWarning' },
    badge: {
      color: 'danger',
      text: '!',
    },
  },
  {
    name: 'Treasury',
    url: '/treasury',
    iconComponent: { name: 'cil-dollar' },
  },
  {
    name: 'Settings',
    url: '/settings',
    iconComponent: { name: 'cil-settings' },
  },
];

export function getHeaderNavItems(): AppNavItem[] {
  return navItems.filter(
    (item): item is AppNavItem => !!item.url && !!item.name && !item.title
  );
}
