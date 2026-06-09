import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

//Components
import { TabsModule } from 'primeng/tabs';
import { GetTaskUrlsComponent } from './components/get-task-urls.component';
import { GetChildPagesComponent } from './components/get-child-pages.component';

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