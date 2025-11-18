import { TestBed } from '@angular/core/testing';

import { GithubAuthService } from './github-auth.service';

describe('GithubAuthService', () => {
  let service: GithubAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GithubAuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
