import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { TabsModule } from 'primeng/tabs';

import { GetChildPagesComponent } from './get-child-pages/get-child-pages.component';
import { GetTaskUrlsComponent } from './get-task-pages/get-task-urls.component';

@Component({
  selector: 'aida-find-pages',
  imports: [TranslatePipe, TabsModule, GetChildPagesComponent, GetTaskUrlsComponent],
  templateUrl: './find-pages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindPagesComponent {}
