import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { TableModule } from 'primeng/table';

import { StyleCardService } from '../../../services/style-card.service';

import { SMALL_WORDS_ENGLISH, SMALL_WORDS_FRENCH } from '../../../common/url-word-exclusions.config';

import { PageTemplate } from '../../../common/data.model';

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
  PageTemplate = PageTemplate;

  markForTranslation() {
    marker('template.content');
    marker('template.subway');
    marker('template.oldSubway');
    marker('template.newsroom');
    marker('template.videoTranscript');
    marker('template.campaign');
    marker('template.readmeForm');
    marker('template.readmeGuide');
    marker('template.guide');
    marker('template.guideT1');
    marker('template.readmeT1');
    marker('template.readmeTD1');
    marker('template.readmePayroll');
    marker('template.contact');
    marker('template.topic');
    marker('template.oldTopic');
    marker('template.navigation');
    marker('template.brochure');
    marker('template.pdfDownload');
    marker('template.multimediaGallery');
    marker('template.taxtip');
    marker('template.taxFilingSeasonMediaKit');
    marker('template.enforcementNotice');
    marker('template.freestyle');
  }
}
