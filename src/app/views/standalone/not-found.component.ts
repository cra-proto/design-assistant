import { Component, OnInit } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: 'aida-not-found',
  imports: [TranslateModule],
  template: `
  
    <span [innerHTML]="random404Key | translate"></span>
  `,
  styles: ``
})
export class NotFoundComponent implements OnInit {

  random404Key: string = '404.message.0';

  ngOnInit() {
    const randomIndex = Math.floor(Math.random() * 6);
    this.random404Key = `404.message.${randomIndex}`;
    console.log('Selected 404 message key:', this.random404Key);
  }
}
