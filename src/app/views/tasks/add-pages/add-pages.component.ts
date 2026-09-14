import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { AddUrlsComponent } from '../../../components/add-urls/add-urls.component';
import { FindPagesComponent } from '../../../components/find-pages/find-pages.component';
import { ViewPagesComponent } from '../../../components/view-pages/view-pages.component';

@Component({
  selector: 'aida-add-pages',
  imports: [TranslatePipe, AddUrlsComponent, FindPagesComponent, ViewPagesComponent],
  templateUrl: './add-pages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPagesComponent {}
