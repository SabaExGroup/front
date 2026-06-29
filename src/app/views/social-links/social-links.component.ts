import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
  TableDirective,
} from '@coreui/angular';
import { TrendSocialService } from '../../core/services/trend-social.service';
import { ToastService } from '../../shared/services/toast.service';
import { TrendSocialPoolsSnapshot } from '../../core/models/api.types';
import { extractErrorMessage } from '../../core/utils/error.util';
import {
  hasValidationErrors,
  inferInvalidUrlKind,
  parseInvalidUrlsFromError,
  poolsAreEmpty,
  SocialUrlKind,
  trimUrlPool,
  validateSocialPools,
} from '../../core/utils/trend-social.util';
import { SocialUrlPoolEditorComponent } from './components/social-url-pool-editor/social-url-pool-editor.component';

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
    TableDirective,
    RouterLink,
    SocialUrlPoolEditorComponent,
  ],
})
export class SocialLinksComponent implements OnInit {
  private readonly trendSocial = inject(TrendSocialService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);

  snapshot = signal<TrendSocialPoolsSnapshot>(this.emptySnapshot());
  baseline = signal<TrendSocialPoolsSnapshot>(this.emptySnapshot());

  rowErrors = signal<Record<SocialUrlKind, string[]>>({
    telegram: [],
    website: [],
    twitter: [],
  });

  poolsEmpty = computed(() => poolsAreEmpty(this.snapshot()));
  isDirty = computed(() => JSON.stringify(this.snapshot()) !== JSON.stringify(this.baseline()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.rowErrors.set({ telegram: [], website: [], twitter: [] });
    this.trendSocial.getSocialPools().subscribe({
      next: (data) => {
        this.snapshot.set({ ...data });
        this.baseline.set({ ...data });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  save(): void {
    const current = this.snapshot();
    const payload: TrendSocialPoolsSnapshot = {
      telegramUrlPool: trimUrlPool(current.telegramUrlPool),
      websiteUrlPool: trimUrlPool(current.websiteUrlPool),
      twitterUrlPool: trimUrlPool(current.twitterUrlPool),
      twitterSearchEnabled: current.twitterSearchEnabled,
      twitterMinFollowers: current.twitterMinFollowers ?? 0,
    };

    const clientErrors = validateSocialPools(payload);
    if (hasValidationErrors(clientErrors)) {
      this.rowErrors.set(clientErrors);
      this.toast.error('Fix invalid URLs before saving');
      return;
    }

    this.saving.set(true);
    this.rowErrors.set({ telegram: [], website: [], twitter: [] });
    this.trendSocial.saveSocialPools(payload).subscribe({
      next: (saved) => {
        this.snapshot.set({ ...saved });
        this.baseline.set({ ...saved });
        this.saving.set(false);
        this.toast.success('Social pools saved');
      },
      error: (err) => {
        this.saving.set(false);
        const message = extractErrorMessage(err);
        const kind = inferInvalidUrlKind(message);
        if (kind) {
          const invalid = parseInvalidUrlsFromError(message, kind);
          this.rowErrors.update((prev) => ({ ...prev, [kind]: invalid }));
        }
        this.toast.error(message);
      },
    });
  }

  updatePool(kind: SocialUrlKind, urls: string[]): void {
    this.snapshot.update((s) => {
      if (kind === 'telegram') return { ...s, telegramUrlPool: urls };
      if (kind === 'website') return { ...s, websiteUrlPool: urls };
      return { ...s, twitterUrlPool: urls };
    });
    this.rowErrors.update((prev) => ({ ...prev, [kind]: [] }));
  }

  patchFlags(patch: Partial<Pick<TrendSocialPoolsSnapshot, 'twitterSearchEnabled' | 'twitterMinFollowers'>>): void {
    this.snapshot.update((s) => ({ ...s, ...patch }));
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
