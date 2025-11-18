import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubConnectComponent } from './github-connect.component';

describe('GithubConnectComponent', () => {
  let component: GithubConnectComponent;
  let fixture: ComponentFixture<GithubConnectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubConnectComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GithubConnectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
