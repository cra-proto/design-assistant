import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { SMALL_WORDS_ENGLISH, SMALL_WORDS_FRENCH } from '../../../common/url-word-exclusions.config';

@Component({
  selector: 'aida-help',
  imports: [RouterLink, TranslatePipe],
  templateUrl: 'help.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  stopWordsEN = SMALL_WORDS_ENGLISH;
  stopWordsFR = SMALL_WORDS_FRENCH;
}
