import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { TableModule } from 'primeng/table';

import { StyleCardService } from '../../../services/style-card.service';

import { SMALL_WORDS_ENGLISH, SMALL_WORDS_FRENCH } from '../../../common/url-word-exclusions.config';
import { ALL_CLASSES, PRINT_CLASSES, RESPONSIVE_CLASSES, VISUAL_CLASSES, WEB_CLASSES } from '../../tasks/compare-languages/compare-hidden/compare-hidden';

@Component({
  selector: 'aida-help',
  imports: [RouterLink, TranslatePipe, TableModule],
  templateUrl: 'help.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  protected readonly styleCardService = inject(StyleCardService);
  stopWordsEN = SMALL_WORDS_ENGLISH;
  stopWordsFR = SMALL_WORDS_FRENCH;
  allClasses = ALL_CLASSES;
  visualClasses = VISUAL_CLASSES;
  printClasses = PRINT_CLASSES;
  webClasses = WEB_CLASSES;
  responsiveClasses = RESPONSIVE_CLASSES;
}
