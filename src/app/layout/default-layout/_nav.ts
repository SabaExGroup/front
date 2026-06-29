import { INavData } from '@coreui/angular';

export type AppNavItem = INavData & {
  name: string;
  url?: string;
  requireTokenOwnerReuse?: boolean;
};

export const navItems: AppNavItem[] = [
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
    name: 'Token Owner Pool',
    url: '/token-owners',
    iconComponent: { name: 'cilUser' },
    requireTokenOwnerReuse: true,
  },
  {
    name: 'Social Links',
    url: '/social-links',
    iconComponent: { name: 'cilShare' },
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
