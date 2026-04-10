import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

//Components
import { GetTaskUrlsComponent } from './components/get-task-urls.component';
import { GetChildPagesComponent } from './components/get-child-pages.component';

@Component({
    selector: 'aida-find-pages',
    imports: [
        TranslateModule,
        GetTaskUrlsComponent, GetChildPagesComponent
    ],
    templateUrl: './find-pages.component.html',
    styles: ``
})
export class FindPagesComponent {

}