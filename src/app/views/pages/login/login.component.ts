import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import {
  AlertComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { MainFeeWalletService } from '../../../core/services/main-fee-wallet.service';
import { MainFeeWalletResponseDto } from '../../../core/models/api.types';
import { environment } from '../../../../environments/environment';
import { extractErrorMessage } from '../../../core/utils/error.util';
import {
  fundingTotalUsd,
  WITHDRAWAL_USD_DISCLAIMER,
  withdrawalSolanaAddress,
} from '../../../core/utils/treasury-ui.util';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    InputGroupComponent,
    InputGroupTextDirective,
    IconDirective,
    FormControlDirective,
    FormLabelDirective,
    ButtonDirective,
    FormsModule,
    AlertComponent,
    SpinnerComponent,
    CurrencyPipe,
  ],
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly mainFee = inject(MainFeeWalletService);
  private readonly router = inject(Router);

  apiKey = '';
  apiBase = environment.defaultApiBase;
  errorMessage = signal<string | null>(null);
  loading = signal(false);
  restoringSession = signal(false);
  walletPreview = signal<MainFeeWalletResponseDto | null>(null);
  autoEnterAfterRestore = signal(false);

  readonly fundingTotalUsd = fundingTotalUsd;
  readonly withdrawalSolanaAddress = withdrawalSolanaAddress;

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    this.restoringSession.set(true);
    this.loading.set(true);
    this.autoEnterAfterRestore.set(true);
    this.validateAndEnter();
  }

  connect(): void {
    const key = this.apiKey.trim();
    if (!key) {
      this.errorMessage.set('API Key is required');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.walletPreview.set(null);
    this.autoEnterAfterRestore.set(false);
    this.auth.setCredentials(key, this.apiBase);
    this.validateAndEnter();
  }

  enterDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  private validateAndEnter(): void {
    this.mainFee.getWallet().subscribe({
      next: (wallet) => {
        this.loading.set(false);
        this.restoringSession.set(false);
        this.walletPreview.set(wallet);

        if (this.autoEnterAfterRestore()) {
          void this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.restoringSession.set(false);
        this.walletPreview.set(null);
        this.auth.logout();
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }
}
