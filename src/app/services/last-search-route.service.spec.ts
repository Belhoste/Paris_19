import { TestBed } from '@angular/core/testing';

import { LastSearchRouteService } from './last-search-route.service';

describe('LastSearchRouteService', () => {
  let service: LastSearchRouteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LastSearchRouteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
