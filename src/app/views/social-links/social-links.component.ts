import { Component, computed, inject, OnInit, signal, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertComponent,
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormLabelDirective,
  RowComponent,
  SpinnerComponent,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TrendSocialService } from '../../core/services/trend-social.service';
import { ToastService } from '../../shared/services/toast.service';
import { TrendSocialPoolsSnapshot } from '../../core/models/api.types';
import {
  buildSocialPoolsPayload,
  expandUrlPoolValue,
  formatSocialPoolsSaveError,
  hasValidationErrors,
  inferInvalidUrlKind,
  normalizeSocialPoolsSnapshot,
  parseInvalidUrlsFromError,
  poolsAreEmpty,
  SocialUrlKind,
  validateSocialPools,
} from '../../core/utils/trend-social.util';
import { SocialUrlPoolEditorComponent } from './components/social-url-pool-editor/social-url-pool-editor.component';

type SocialTab = 'twitter' | 'telegram' | 'website';

interface SocialTabConfig {
  id: SocialTab;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-social-links-page',
  templateUrl: './social-links.component.html',
  styleUrls: ['./social-links.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    FormsModule,
    FormLabelDirective,
    FormControlDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    SpinnerComponent,
    AlertComponent,
    BadgeComponent,
    TabDirective,
    TabPanelComponent,
    TabsComponent,
    TabsContentComponent,
    TabsListComponent,
    IconDirective,
    RouterLink,
    SocialUrlPoolEditorComponent,
  ],
})
export class SocialLinksComponent implements OnInit {
  private readonly trendSocial = inject(TrendSocialService);
  private readonly toast = inject(ToastService);

  private readonly poolEditors = viewChildren(SocialUrlPoolEditorComponent);

  loading = signal(true);
  saving = signal(false);
  poolResetKey = signal(0);
  saveError = signal<string | null>(null);
  activeTab = signal<SocialTab>('twitter');

  snapshot = signal<TrendSocialPoolsSnapshot>(this.emptySnapshot());
  baseline = signal<TrendSocialPoolsSnapshot>(this.emptySnapshot());

  rowErrors = signal<Record<SocialUrlKind, string[]>>({
    telegram: [],
    website: [],
    twitter: [],
  });

  readonly tabs: SocialTabConfig[] = [
    { id: 'twitter', label: 'Twitter', icon: 'cilShare' },
    { id: 'telegram', label: 'Telegram', icon: 'cilSpeech' },
    { id: 'website', label: 'Website', icon: 'cilGlobeAlt' },
  ];

  poolsEmpty = computed(() => poolsAreEmpty(this.snapshot()));
  isDirty = computed(() => JSON.stringify(this.snapshot()) !== JSON.stringify(this.baseline()));

  ngOnInit(): void {
    this.load();
  }

  onTabChange(key: string | number | undefined): void {
    if (key === 'twitter' || key === 'telegram' || key === 'website') {
      this.activeTab.set(key);
    }
  }

  poolCount(tab: SocialTab): number {
    const s = this.snapshot();
    switch (tab) {
      case 'twitter':
        return s.twitterUrlPool.length;
      case 'telegram':
        return s.telegramUrlPool.length;
      case 'website':
        return s.websiteUrlPool.length;
    }
  }

  load(): void {
    this.loading.set(true);
    this.saveError.set(null);
    this.rowErrors.set({ telegram: [], website: [], twitter: [] });
    this.trendSocial.getSocialPools().subscribe({
      next: (data) => {
        const normalized = normalizeSocialPoolsSnapshot(data);
        this.snapshot.set(normalized);
        this.baseline.set({ ...normalized });
        this.bumpPoolResetKey();
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(formatSocialPoolsSaveError(err));
      },
    });
  }

  save(): void {
    this.commitAllEditors();
    const payload = buildSocialPoolsPayload(this.snapshot());

    const clientErrors = validateSocialPools(payload);
    if (hasValidationErrors(clientErrors)) {
      this.rowErrors.set(clientErrors);
      if (clientErrors.twitter.length > 0) this.activeTab.set('twitter');
      else if (clientErrors.telegram.length > 0) this.activeTab.set('telegram');
      else if (clientErrors.website.length > 0) this.activeTab.set('website');
      this.toast.error('Fix invalid URLs before saving');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.rowErrors.set({ telegram: [], website: [], twitter: [] });
    this.trendSocial.saveSocialPools(payload).subscribe({
      next: (saved) => {
        const normalized = normalizeSocialPoolsSnapshot(saved);
        this.snapshot.set(normalized);
        this.baseline.set({ ...normalized });
        this.bumpPoolResetKey();
        this.saving.set(false);
        this.toast.success(
          `Social pools saved (${payload.twitterUrlPool.length} Twitter · ${payload.telegramUrlPool.length} Telegram · ${payload.websiteUrlPool.length} Website)`
        );
      },
      error: (err) => {
        this.saving.set(false);
        const message = formatSocialPoolsSaveError(err);
        this.saveError.set(message);
        const kind = inferInvalidUrlKind(message);
        if (kind) {
          const invalid = parseInvalidUrlsFromError(message, kind);
          this.rowErrors.update((prev) => ({ ...prev, [kind]: invalid }));
          this.activeTab.set(kind);
        }
        this.toast.error(message);
      },
    });
  }

  updatePool(kind: SocialUrlKind, urls: string[]): void {
    const next = expandUrlPoolValue(urls);
    this.snapshot.update((s) => {
      if (kind === 'telegram') return { ...s, telegramUrlPool: next };
      if (kind === 'website') return { ...s, websiteUrlPool: next };
      return { ...s, twitterUrlPool: next };
    });
    this.rowErrors.update((prev) => ({ ...prev, [kind]: [] }));
  }

  patchFlags(patch: Partial<Pick<TrendSocialPoolsSnapshot, 'twitterSearchEnabled' | 'twitterMinFollowers'>>): void {
    this.snapshot.update((s) => ({ ...s, ...patch }));
  }

  private commitAllEditors(): void {
    for (const editor of this.poolEditors()) {
      editor.commitRows();
    }
  }

  private bumpPoolResetKey(): void {
    this.poolResetKey.update((key) => key + 1);
  }

  private emptySnapshot(): TrendSocialPoolsSnapshot {
    return {
      telegramUrlPool: [],
      websiteUrlPool: [],
      twitterUrlPool: [],
      twitterSearchEnabled: true,
      twitterMinFollowers: 0,
    };
  }
}
