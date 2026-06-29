import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgScrollbar } from 'ngx-scrollbar';

import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective,
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { navItems, AppNavItem } from './_nav';
import { EmergencyService } from '../../core/services/emergency.service';
import { SettingsService } from '../../core/services/settings.service';
import { HaltBannerComponent } from '../../shared/components/halt-banner/halt-banner.component';
import { readTokenOwnerReuseEnabled } from '../../core/utils/token-owner-pool.util';

function isOverflown(element: HTMLElement) {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective,
    HaltBannerComponent,
  ]
})
export class DefaultLayoutComponent implements OnInit {
  public navItems = [...navItems];

  private readonly emergency = inject(EmergencyService);
  private readonly settingsService = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.emergency.startHaltPolling();
    this.destroyRef.onDestroy(() => this.emergency.stopHaltPolling());

    this.settingsService.get().subscribe({
      next: (settings) => {
        const reuseEnabled = readTokenOwnerReuseEnabled(settings as unknown as Record<string, unknown>);
        this.navItems = navItems.filter((item) => {
          const nav = item as AppNavItem;
          return !nav.requireTokenOwnerReuse || reuseEnabled;
        });
      },
      error: () => {
        this.navItems = [...navItems];
      },
    });
  }
}
