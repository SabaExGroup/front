import { DatePipe } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  AccordionComponent,
  AccordionItemComponent,
  AlertComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  RowComponent,
  SpinnerComponent,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent,
  TemplateIdDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { SettingsService } from '../../core/services/settings.service';
import { ToastService } from '../../shared/services/toast.service';
import { SettingsResponseDto } from '../../core/models/api.types';
import { extractErrorMessage } from '../../core/utils/error.util';
import {
  buildSettingsForm,
  formToDirtyUpdatePayload,
  formToNormalizedState,
  mergeSettingsAfterSave,
  mergeSettingsPatch,
  normalizeSettingsShape,
  validateSettingsForm,
} from './settings-form.util';
import {
  GENERAL_FIELDS,
  INTEGRATION_ENDPOINT_FIELDS,
  INTEGRATION_JUPITER_FIELDS,
  INTEGRATION_KEY_FIELDS,
  INTEGRATION_RPC_FIELDS,
  INTEGRATION_WITHDRAWAL_FIELDS,
  SETTINGS_TABS,
  SettingsFieldConfig,
  SettingsSectionConfig,
  SettingsTabId,
} from './settings-field-config';
import { SettingsFieldGridComponent } from './components/settings-field-grid/settings-field-grid.component';
import { SettingsPeakWindowsComponent } from './components/settings-peak-windows/settings-peak-windows.component';
import { SettingsFundingPairsComponent } from './components/settings-funding-pairs/settings-funding-pairs.component';
import {
  generateRuntimeSections,
  generateStrategySections,
  generateTreasurySections,
  getDefaultsSnapshot,
} from './settings-schema.util';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [
    ReactiveFormsModule,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    FormDirective,
    FormLabelDirective,
    FormControlDirective,
    ButtonDirective,
    SpinnerComponent,
    DatePipe,
    TabDirective,
    TabPanelComponent,
    TabsComponent,
    TabsContentComponent,
    TabsListComponent,
    IconDirective,
    AccordionComponent,
    AccordionItemComponent,
    TemplateIdDirective,
    AlertComponent,
    SettingsFieldGridComponent,
    SettingsPeakWindowsComponent,
    SettingsFundingPairsComponent,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  loading = signal(true);
  saving = signal(false);
  saveBlocker = signal<string | null>(null);
  testingProxy = signal(false);
  testingTelegram = signal(false);
  original = signal<SettingsResponseDto | null>(null);
  activeTab = signal<SettingsTabId>('general');

  form!: FormGroup;

  readonly tabs = SETTINGS_TABS;
  readonly generalFields = GENERAL_FIELDS;
  readonly strategySections = this.withSpecialStrategyFields(generateStrategySections());
  readonly integrationKeyFields = INTEGRATION_KEY_FIELDS;
  readonly integrationWithdrawalFields = INTEGRATION_WITHDRAWAL_FIELDS;
  readonly integrationJupiterFields = INTEGRATION_JUPITER_FIELDS;
  readonly integrationRpcFields = INTEGRATION_RPC_FIELDS;
  readonly integrationEndpointFields = INTEGRATION_ENDPOINT_FIELDS;
  readonly runtimeSections = this.withSpecialRuntimeFields(generateRuntimeSections());
  readonly treasurySections = generateTreasurySections();

  ngOnInit(): void {
    this.load();
  }

  private withSpecialStrategyFields(sections: SettingsSectionConfig[]): SettingsSectionConfig[] {
    return sections.map((section) => {
      if (section.path === 'strategy') {
        return this.appendField(section, {
          key: 'maxTokenHoldPercent',
          label: 'Max token hold %',
          type: 'number',
          min: 0,
          max: 100,
          col: 4,
          hint: 'Creator cap only (TOKEN_OWNER)',
        });
      }
      if (section.path === 'strategy.distribution') {
        return this.appendField(section, {
          key: 'telegramChatIds',
          label: 'Telegram chat IDs (one per line)',
          type: 'textarea',
          col: 12,
          hint: 'Distribution channels — separate from alert chat IDs under Telegram & Proxy',
        });
      }
      return section;
    });
  }

  private withSpecialRuntimeFields(sections: SettingsSectionConfig[]): SettingsSectionConfig[] {
    return sections.map((section) => {
      if (section.path === 'integrations.runtime.fourMeme') {
        return this.appendField(section, {
          key: 'tokenLabels',
          label: 'Token labels (one per line)',
          type: 'textarea',
          col: 12,
        });
      }
      if (section.path === 'integrations.runtime.trade') {
        return this.appendField(section, {
          key: 'providerPriority',
          label: 'Provider priority (comma-separated)',
          type: 'text',
          col: 12,
          hint: 'gmgn, dexscreener, changenow',
        });
      }
      return section;
    });
  }

  private appendField(section: SettingsSectionConfig, field: SettingsFieldConfig): SettingsSectionConfig {
    return {
      ...section,
      fields: [...section.fields.filter((f) => f.key !== field.key), field],
    };
  }

  load(): void {
    this.loading.set(true);
    this.settingsService.get().subscribe({
      next: (settings) => {
        const merged = normalizeSettingsShape(
          mergeSettingsPatch(getDefaultsSnapshot(), settings as unknown as Record<string, unknown>)
        );
        this.original.set(merged as unknown as SettingsResponseDto);
        this.form = buildSettingsForm(this.fb, merged);
        this.refreshSaveBlocker();
        this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
          this.refreshSaveBlocker();
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  onTabChange(key: string | number | undefined): void {
    if (typeof key === 'string') {
      this.activeTab.set(key as SettingsTabId);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.form?.dirty) {
      event.preventDefault();
    }
  }

  private refreshSaveBlocker(): void {
    if (!this.form) {
      this.saveBlocker.set(null);
      return;
    }
    this.saveBlocker.set(validateSettingsForm(this.form));
  }

  save(): void {
    const orig = this.original();
    if (!orig || !this.form) return;

    const blocker = validateSettingsForm(this.form);
    if (blocker) {
      this.saveBlocker.set(blocker);
      this.activeTab.set('integrations');
      this.toast.error(blocker);
      return;
    }

    const payload = formToDirtyUpdatePayload(
      this.form,
      orig as unknown as Record<string, unknown>
    );

    if (Object.keys(payload).length === 0) {
      this.toast.info('No changes to save');
      return;
    }

    this.saving.set(true);
    this.settingsService.patch(payload).subscribe({
      next: (updated) => {
        this.saving.set(false);
        const submitted = formToNormalizedState(this.form);
        const merged = mergeSettingsAfterSave(
          submitted,
          updated as unknown as Record<string, unknown>,
          payload as unknown as Record<string, unknown>
        ) as Record<string, unknown>;
        merged['id'] = (updated as SettingsResponseDto).id ?? orig.id;
        merged['updatedAt'] = (updated as SettingsResponseDto).updatedAt ?? orig.updatedAt;
        this.original.set(merged as unknown as SettingsResponseDto);
        this.toast.success('Settings saved');
        this.form = buildSettingsForm(this.fb, merged as unknown as Record<string, unknown>);
        this.refreshSaveBlocker();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  testProxy(): void {
    const proxy = this.form.get('proxy')?.value as { enabled?: boolean; url?: string };
    this.testingProxy.set(true);
    this.settingsService.testProxy({
      enabled: !!proxy?.enabled,
      url: proxy?.url,
    }).subscribe({
      next: (res) => {
        this.testingProxy.set(false);
        if (res.success) {
          this.toast.success(res.message ?? `OK (${res.latencyMs}ms)`);
        } else {
          this.toast.error(res.message ?? 'Proxy test failed');
        }
      },
      error: (err) => {
        this.testingProxy.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  testTelegram(): void {
    this.testingTelegram.set(true);
    this.settingsService.testTelegram({ message: 'Test from admin panel' }).subscribe({
      next: (res) => {
        this.testingTelegram.set(false);
        this.toast.success(`Delivered ${res.deliveredCount}/${res.deliveredCount + res.failedCount}`);
      },
      error: (err) => {
        this.testingTelegram.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }
}
