import { ChangeDetectionStrategy, Component, Injectable } from '@angular/core';

import { CompareLanguagesComponent } from '../../../../views/tasks/compare-languages/compare-languages.component';

@Injectable({
  providedIn: 'root',
})
@Component({
  selector: 'aida-compare-page-data',
  imports: [CompareLanguagesComponent],
  templateUrl: './compare-page-data.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparePageDataComponent {}
