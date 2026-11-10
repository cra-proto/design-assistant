//Pull out all hidden content and alt text for user to review manually - flag as problem if text matches

//Check all links and surface any /en on French pages and /fr on English pages

import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { HiddenRow } from './compare-hidden';

@Component({
  selector: 'aida-compare-hidden',
  imports: [FormsModule, TranslatePipe, MessageModule, TableModule, ToggleButtonModule],
  templateUrl: './compare-hidden.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareHiddenComponent {
  /** Input signal with all table rows */
  public readonly hiddenRows = input<HiddenRow[]>([]);
  /** Input to track if selected page is 404 */
  public readonly is404 = input<boolean>(false);
  /** Signal to show html mismatches */
  protected readonly hiddenDiffsOnly = signal(true);
  /** Shows all or mismatched counts of html elements, classes, and attributes in English and French */
  protected readonly visibleHiddenRows = computed(() => (this.hiddenDiffsOnly() ? this.hiddenRows().filter((r) => r.status !== 'ok') : this.hiddenRows()));

  markForTranslation() {
    marker('languages.hidden.user.all');
    marker('languages.hidden.user.visual');
    marker('languages.hidden.user.screenreaders');
  }
}
