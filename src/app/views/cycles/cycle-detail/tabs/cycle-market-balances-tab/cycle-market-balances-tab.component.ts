import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AlertComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  RowComponent,
  SpinnerComponent,
  TableDirective,
} from '@coreui/angular';
import { WalletsService } from '../../../../../core/services/wallets.service';
import {
  CycleMarketWalletBalanceRowDto,
  CycleMarketWalletBalancesResponseDto,
} from '../../../../../core/models/api.types';
import { ToastService } from '../../../../../shared/services/toast.service';
import { GmgnQuickLinkComponent } from '../../../../../shared/components/gmgn-quick-link/gmgn-quick-link.component';
import { extractErrorMessage } from '../../../../../core/utils/error.util';

@Component({
  selector: 'app-cycle-market-balances-tab',
  templateUrl: './cycle-market-balances-tab.component.html',
  styleUrls: ['./cycle-market-balances-tab.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    SpinnerComponent,
    AlertComponent,
    TableDirective,
    DatePipe,
    CurrencyPipe,
    GmgnQuickLinkComponent,
  ],
})
export class CycleMarketBalancesTabComponent {
  private readonly wallets = inject(WalletsService);
  private readonly toast = inject(ToastService);

  cycleId = input.required<string>();
  active = input(false);

  synced = output<void>();

  balances = signal<CycleMarketWalletBalancesResponseDto | null>(null);
  loading = signal(false);
  syncing = signal(false);

  private loadedForCycleId = '';

  constructor() {
    effect(() => {
      const id = this.cycleId();
      if (id && id !== this.loadedForCycleId) {
        this.loadedForCycleId = id;
        this.resetState();
      }
    });

    effect(() => {
      if (this.active() && this.cycleId() && this.needsLoad() && !this.loading() && !this.syncing()) {
        this.load();
      }
    });
  }

  load(): void {
    const cycleId = this.cycleId();
    if (!cycleId) return;

    this.loading.set(true);
    this.wallets.getCycleMarketBalances(cycleId).subscribe({
      next: (res) => {
        this.balances.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  syncFromChain(): void {
    const cycleId = this.cycleId();
    if (!cycleId) return;

    this.syncing.set(true);
    this.wallets.syncCycleMarketBalances(cycleId).subscribe({
      next: (res) => {
        this.balances.set(res);
        this.syncing.set(false);
        this.synced.emit();
        if (res.failedSyncCount > 0) {
          this.toast.warning(
            `Synced with ${res.failedSyncCount} wallet failure${res.failedSyncCount === 1 ? '' : 's'}`,
          );
        } else {
          this.toast.success('Market balances synced from chain');
        }
      },
      error: (err) => {
        this.syncing.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  sourceLabel(wallet: CycleMarketWalletBalanceRowDto): string {
    if (wallet.syncError) {
      return wallet.syncError;
    }
    if (wallet.fromCache === true) {
      return 'RPC (cached)';
    }
    if (wallet.fromCache === false) {
      return 'RPC';
    }
    return 'DB stored';
  }

  private needsLoad(): boolean {
    const cached = this.balances();
    return !cached || cached.cycleId !== this.cycleId();
  }

  private resetState(): void {
    this.balances.set(null);
    this.loading.set(false);
    this.syncing.set(false);
  }
}
