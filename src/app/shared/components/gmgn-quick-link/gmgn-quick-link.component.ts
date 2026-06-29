import { Component, computed, input } from '@angular/core';
import { GmgnLinkKind, gmgnUrl } from '../../../core/utils/gmgn.util';

@Component({
  selector: 'app-gmgn-link',
  template: `
    @if (href(); as link) {
      <a
        class="gmgn-quick-link"
        [href]="link"
        target="_blank"
        rel="noopener noreferrer"
        [title]="title()"
      >
        GMGN <span class="gmgn-quick-link__icon" aria-hidden="true">↗</span>
      </a>
    }
  `,
  styleUrls: ['./gmgn-quick-link.component.scss'],
})
export class GmgnQuickLinkComponent {
  network = input.required<string>();
  address = input<string | null | undefined>('');

  kind = input<GmgnLinkKind>('wallet');

  readonly href = computed(() => {
    const addr = this.address();
    if (!addr) return null;
    return gmgnUrl(this.network(), addr, this.kind());
  });

  title(): string {
    const chain = this.network();
    const segment = this.kind() === 'token' ? 'token' : 'wallet';
    return `Open ${segment} on GMGN (${chain})`;
  }
}
