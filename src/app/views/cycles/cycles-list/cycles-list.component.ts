import { DatePipe } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
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
  FormSelectDirective,
  PaginationComponent,
  PageItemComponent,
  PageLinkDirective,
  RowComponent,
  SpinnerComponent,
  TableDirective,
} from '@coreui/angular';
import { CycleStatusBadgeComponent } from '../../../shared/components/cycle-status-badge/cycle-status-badge.component';
import { CyclesService } from '../../../core/services/cycles.service';
import { EmergencyService } from '../../../core/services/emergency.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CycleResponseDto } from '../../../core/models/api.types';
import { CYCLE_STATUSES, CycleStatus, LAUNCHPADS, NETWORKS, Network, Launchpad } from '../../../core/models/enums';
import { extractErrorMessage } from '../../../core/utils/error.util';

@Component({
  selector: 'app-cycles-list',
  templateUrl: './cycles-list.component.html',
  styleUrls: ['./cycles-list.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    TableDirective,
    ButtonDirective,
    RouterLink,
    CycleStatusBadgeComponent,
    SpinnerComponent,
    FormsModule,
    FormLabelDirective,
    FormSelectDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    DatePipe,
    PaginationComponent,
    PageItemComponent,
    PageLinkDirective,
  ],
})
export class CyclesListComponent implements OnInit {
  private readonly cyclesService = inject(CyclesService);
  private readonly emergency = inject(EmergencyService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  loading = signal(true);
  startingCycle = signal(false);
  showStartForm = signal(false);
  cycleList = signal<CycleResponseDto[]>([]);
  total = signal(0);
  page = signal(1);
  limit = signal(50);
  statusFilter: CycleStatus | '' = '';

  startNetwork: Network | '' = '';
  startLaunchpad: Launchpad | '' = '';
  startDryRun = false;
  startIgnorePeakSchedule = false;

  readonly statusOptions = ['', ...CYCLE_STATUSES] as const;
  readonly networkOptions = NETWORKS;
  readonly launchpadOptions = LAUNCHPADS;
  readonly limitOptions = [20, 50, 100, 200];
  readonly isHalted = this.emergency.haltStatus;

  constructor() {
    effect(() => {
      if (this.isHalted()?.halted) {
        this.showStartForm.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.cyclesService.list({
      page: this.page(),
      limit: this.limit(),
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res) => {
        this.cycleList.set(res.data);
        this.total.set(res.total);
        this.page.set(res.page);
        this.limit.set(res.limit);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }

  onStatusChange(value: string): void {
    this.statusFilter = value as CycleStatus | '';
    this.page.set(1);
    this.load();
  }

  onLimitChange(value: string): void {
    this.limit.set(Number(value));
    this.page.set(1);
    this.load();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.limit()));
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const window = 5;
    let start = Math.max(1, current - Math.floor(window / 2));
    const end = Math.min(total, start + window - 1);
    start = Math.max(1, end - window + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  toggleStartForm(): void {
    this.showStartForm.update((v) => !v);
  }

  startCycle(): void {
    if (this.isHalted()?.halted) {
      this.toast.warning('System is halted — resume before starting a cycle');
      return;
    }
    if (!confirm('Start a new cycle?')) return;

    this.startingCycle.set(true);
    this.cyclesService.start({
      network: this.startNetwork || undefined,
      forceLaunchpad: this.startLaunchpad || undefined,
      dryRun: this.startDryRun,
      ignorePeakSchedule: this.startIgnorePeakSchedule,
    }).subscribe({
      next: (cycle) => {
        this.startingCycle.set(false);
        this.toast.success(`Cycle started — ${cycle.status}`);
        this.showStartForm.set(false);
        void this.router.navigate(['/cycles', cycle.id]);
      },
      error: (err) => {
        this.startingCycle.set(false);
        this.toast.error(extractErrorMessage(err));
      },
    });
  }
}
