import { Component, Input } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  FormControlDirective,
  TableDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

const FUNDING_PAIR_TEMPLATE = {
  pairKey: 'NEW:SOLANA',
  fromCurrency: 'usdc',
  toCurrency: 'sol',
  fromNetwork: 'eth',
  toNetwork: 'sol',
};

@Component({
  selector: 'app-settings-funding-pairs',
  templateUrl: './settings-funding-pairs.component.html',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    CardBodyComponent,
    CardHeaderComponent,
    FormControlDirective,
    ButtonDirective,
    TableDirective,
    IconDirective,
  ],
})
export class SettingsFundingPairsComponent {
  private readonly fb = new FormBuilder();

  @Input({ required: true }) form!: FormGroup;

  get fundingPairs(): FormArray | null {
    return this.form.get('integrations.runtime.changeNow.fundingPairs') as FormArray | null;
  }

  hasFundingPairsPath(): boolean {
    return !!this.fundingPairs;
  }

  addPair(): void {
    const changeNow = this.ensureChangeNowGroup();
    let arr = changeNow.get('fundingPairs') as FormArray | null;
    if (!arr) {
      arr = this.fb.array([]);
      changeNow.addControl('fundingPairs', arr);
    }
    arr.push(this.buildPairGroup(FUNDING_PAIR_TEMPLATE));
  }

  removePair(index: number): void {
    this.fundingPairs?.removeAt(index);
  }

  private ensureChangeNowGroup(): FormGroup {
    let integrations = this.form.get('integrations') as FormGroup | null;
    if (!integrations) {
      integrations = this.fb.group({});
      this.form.addControl('integrations', integrations);
    }
    let runtime = integrations.get('runtime') as FormGroup | null;
    if (!runtime) {
      runtime = this.fb.group({});
      integrations.addControl('runtime', runtime);
    }
    let changeNow = runtime.get('changeNow') as FormGroup | null;
    if (!changeNow) {
      changeNow = this.fb.group({});
      runtime.addControl('changeNow', changeNow);
    }
    return changeNow;
  }

  asGroup(control: unknown): FormGroup {
    return control as FormGroup;
  }

  private buildPairGroup(pair: typeof FUNDING_PAIR_TEMPLATE): FormGroup {
    return this.fb.group({
      pairKey: this.fb.control(pair.pairKey),
      fromCurrency: this.fb.control(pair.fromCurrency),
      toCurrency: this.fb.control(pair.toCurrency),
      fromNetwork: this.fb.control(pair.fromNetwork),
      toNetwork: this.fb.control(pair.toNetwork),
    });
  }
}
