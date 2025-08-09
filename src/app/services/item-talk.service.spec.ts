import { TestBed } from '@angular/core/testing';

import { ItemTalkService } from './item-talk.service';

describe('ItemTalkService', () => {
  let service: ItemTalkService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItemTalkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
