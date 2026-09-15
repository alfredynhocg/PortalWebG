import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface AuthSession {
  authenticated: boolean;
  user?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly session = signal<AuthSession>({ authenticated: false });
  readonly loaded = signal(false);

  async loadSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const session = await firstValueFrom(this.http.get<AuthSession>('/api/auth/session'));
      this.session.set(session);
    } finally {
      this.loaded.set(true);
    }
  }

  login(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/login?returnTo=${returnTo}`;
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    window.location.href = '/auth/logout';
  }
}
