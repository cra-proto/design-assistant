import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { NumberRow } from './compare-numbers';

@Component({
  selector: 'aida-compare-numbers',
  imports: [FormsModule, TranslatePipe, MessageModule, TableModule, ToggleButtonModule],
  templateUrl: './compare-numbers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareNumbersComponent {
  /** Input signal with all table rows */
  public readonly numberRows = input<NumberRow[]>([]);
  /** Input to track if selected page is 404 */
  public readonly is404 = input<boolean>(false);
  /** Signal to show number mismatches */
  protected readonly numberDiffsOnly = signal(true);
  /** Shows all or mismatched numbers in English and French */
  protected readonly visibleRows = computed(() => (this.numberDiffsOnly() ? this.numberRows().filter((r) => !r.match) : this.numberRows()));
}
