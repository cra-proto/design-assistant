import { Component, OnInit } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { marker } from '@colsen1991/ngx-translate-extract-marker';

@Component({
  selector: 'aida-not-found',
  imports: [TranslateModule],
  template: `
  
    <span [innerHTML]="random404Key | translate"></span>
  `,
  styles: ``
})
export class NotFoundComponent implements OnInit {

  random404Key = 'notFound.message.0';

  ngOnInit() {
    const randomIndex = Math.floor(Math.random() * 6);
    this.random404Key = `notFound.message.${randomIndex}`;
    console.log('Selected 404 message key:', this.random404Key);
  }

  markForTranslation() {
    marker('notFound.message.0');
    marker('notFound.message.1');
    marker('notFound.message.2');
    marker('notFound.message.3');
    marker('notFound.message.4');
    marker('notFound.message.5');
  }
}
