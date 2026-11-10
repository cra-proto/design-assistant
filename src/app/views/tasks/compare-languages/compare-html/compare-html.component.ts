import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { CountRow } from './compare-html';

@Component({
  selector: 'aida-compare-html',
  imports: [FormsModule, TranslatePipe, MessageModule, TableModule, ToggleButtonModule],
  templateUrl: './compare-html.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareHtmlComponent {
  /** Input signal with all table rows */
  public readonly htmlRows = input<CountRow[]>([]);
  /** Input to track if selected page is 404 */
  public readonly is404 = input<boolean>(false);
  /** Signal to show html mismatches */
  protected readonly htmlDiffsOnly = signal(true);
  /** Shows all or mismatched counts of html elements, classes, and attributes in English and French */
  protected readonly visibleHtmlRows = computed(() => (this.htmlDiffsOnly() ? this.htmlRows().filter((r) => r.en !== r.fr) : this.htmlRows()));

  markForTranslation() {
    marker('languages.html.element');
    marker('languages.html.class');
    marker('languages.html.attribute');
  }
}
