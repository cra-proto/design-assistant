import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { TabsModule } from 'primeng/tabs';

import { GetChildPagesComponent } from './by-children/get-child-urls.component';
import { GetTaskUrlsComponent } from './by-task/get-task-urls.component';
import { AddUrlsComponent } from './by-url/add-urls.component';

import { AddUrlsService } from './by-url/add-urls.service';

@Component({
  selector: 'aida-add-pages',
  imports: [TranslatePipe, TabsModule, AddUrlsComponent, GetChildPagesComponent, GetTaskUrlsComponent],
  templateUrl: './add-pages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPagesComponent {
  protected readonly addUrlsService = inject(AddUrlsService);

  markForTranslation() {
    marker('findPages.url.description');
  }
}
