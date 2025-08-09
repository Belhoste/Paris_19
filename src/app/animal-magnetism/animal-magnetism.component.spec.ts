import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimalMagnetismComponent } from './animal-magnetism.component';

describe('AnimalMagnetismComponent', () => {
  let component: AnimalMagnetismComponent;
  let fixture: ComponentFixture<AnimalMagnetismComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [AnimalMagnetismComponent]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimalMagnetismComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
