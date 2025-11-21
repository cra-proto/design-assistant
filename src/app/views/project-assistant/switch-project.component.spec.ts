import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwitchProjectComponent } from './switch-project.component';

describe('ProjectAssistantComponent', () => {
  let component: SwitchProjectComponent;
  let fixture: ComponentFixture<SwitchProjectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwitchProjectComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SwitchProjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
