import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HuNoticeDisplayComponent } from './hu-notice-display.component';

describe('HuNoticeDisplayComponent', () => {
  let component: HuNoticeDisplayComponent;
  let fixture: ComponentFixture<HuNoticeDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HuNoticeDisplayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HuNoticeDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
