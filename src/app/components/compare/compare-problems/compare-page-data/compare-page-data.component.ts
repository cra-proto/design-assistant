import { ChangeDetectionStrategy, Component, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
@Component({
  selector: 'aida-compare-page-data',
  imports: [],
  templateUrl: './compare-page-data.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparePageDataComponent {}
