import { CurrencyPipe, DatePipe } from '@angular/common';
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
  FormLabelDirective,
  FormSelectDirective,
  RowComponent,
  SpinnerComponent,
  TableDirective,
  TooltipDirective,
} from '@coreui/angular';
import { WalletsService } from '../../core/services/wallets.service';
import { MainFeeWalletService } from '../../core/services/main-fee-wallet.service';
import {
  MainFeeWalletResponseDto,
  SystemWalletBalanceRowDto,
  SystemWalletBalancesResponseDto,
} from '../../core/models/api.types';
import { NETWORKS, Network, WALLET_TYPES, WalletType } from '../../core/models/enums';
import { ToastService } from '../../shared/services/toast.service';
import { extractErrorMessage } from '../../core/utils/error.util';
import {
  shortAddress,
  walletExplorerUrl,
} from '../../core/utils/token-owner-pool.util';
import {
  fundingTotalUsd,
  withdrawalSolanaAddress,
} from '../../core/utils/treasury-ui.util';
import { GmgnQuickLinkComponent } from '../../shared/components/gmgn-quick-link/gmgn-quick-link.component';

type NetworkFilter = Network | '';
type TypeFilter = WalletType | '';

@Component({
  selector: 'app-wallet-overview',
  templateUrl: './wallet-overview.component.html',
  styleUrls: ['./wallet-overview.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    ButtonDirective,
    FormsModule,
    FormLabelDirective,
    FormSelectDirective,
    SpinnerComponent,
    AlertComponent,
    BadgeComponent,
    TableDirective,
    TooltipDirective,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    GmgnQuickLinkComponent,
  ],
})
export class WalletOverviewComponent implements OnInit {
  private readonly wallets = inject(WalletsService);
  private readonly mainFee = inject(MainFeeWalletService);
  private readonly toast = inject(ToastService);

  readonly networkOptions = NETWORKS;
  readonly walletTypeOptions = WALLET_TYPES;
  readonly shortAddress = shortAddress;
  readonly walletExplorerUrl = walletExplorerUrl;
  readonly fundingTotalUsd = fundingTotalUsd;
  readonly withdrawalSolanaAddress = withdrawalSolanaAddress;

  networkFilter = signal<NetworkFilter>('');
  typeFilter = signal<TypeFilter>('');

  balances = signal<SystemWalletBalancesResponseDto | null>(null);
  mainFeeWallet = signal<MainFeeWalletResponseDto | null>(null);
  loading = signal(false);
  syncing = signal(false);
  loadingOperational = signal(true);

  readonly solanaTotals = computed(() => this.balances()?.totalsByNetwork?.SOLANA ?? null);
  readonly bscTotals = computed(() => this.balances()?.totalsByNetwork?.BSC ?? null);
  readonly marketTotals = computed(() => this.balances()?.totalsByType?.MARKET ?? null);
  readonly ownerTotals = computed(() => this.balances()?.totalsByType?.TOKEN_OWNER ?? null);

  ngOnInit(): void {
    this.load();
    this.mainFee.getWallet().subscribe({
      next: (wallet) => {
        this.mainFeeWallet.set(wallet);
        this.loadingOperational.set(false);
      },
      error: () => {
        this.loadingOperational.set(false);
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.wallets.getSystemWalletBalances(this.buildQuery()).subscribe({
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
    this.syncing.set(true);
    this.wallets.syncSystemWalletBalances(this.buildQuery()).subscribe({
      next: (res) => {
        this.balances.set(res);
        this.syncing.set(false);
        if (res.failedSyncCount > 0) {
          this.toast.warning(
            `Synced with ${res.failedSyncCount} wallet failure${res.failedSyncCount === 1 ? '' : 's'}`,
          );
        } else {
          this.toast.success('Wallet balances synced from chain');
        }
      },
      error: (err) => {
        this.syncing.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  onNetworkFilterChange(value: NetworkFilter): void {
    this.networkFilter.set(value);
    this.load();
  }

  onTypeFilterChange(value: TypeFilter): void {
    this.typeFilter.set(value);
    this.load();
  }

  copyAddress(address: string): void {
    void navigator.clipboard.writeText(address).then(
      () => this.toast.success('Address copied'),
      () => this.toast.error('Could not copy address'),
    );
  }

  nativeUnit(network: Network): string {
    return network === 'SOLANA' ? 'SOL' : 'BNB';
  }

  syncStatusLabel(wallet: SystemWalletBalanceRowDto): string {
    if (wallet.syncError) {
      return 'Failed';
    }
    if (wallet.fromCache === true) {
      return 'Cached';
    }
    if (wallet.fromCache === false) {
      return 'Synced';
    }
    return 'DB';
  }

  private buildQuery(): { network?: Network; type?: WalletType } {
    const network = this.networkFilter();
    const type = this.typeFilter();
    return {
      network: network || undefined,
      type: type || undefined,
    };
  }
}
