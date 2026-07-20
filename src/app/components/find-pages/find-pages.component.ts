import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

//Components
import { TabsModule } from 'primeng/tabs';
import { GetTaskUrlsComponent } from './get-task-pages/get-task-urls.component';
import { GetChildPagesComponent } from './get-child-pages/get-child-pages.component';

@Component({
    selector: 'aida-find-pages',
    imports: [
        TranslateModule,
        TabsModule, GetTaskUrlsComponent, GetChildPagesComponent
    ],
    templateUrl: './find-pages.component.html',
    styles: ``
})
export class FindPagesComponent {

}