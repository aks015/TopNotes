import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Agreement, AgreementType, ApiResponse } from '../models';

/**
 * Data layer for legal agreements + consent. The interactive "read & accept"
 * flow lives in ConsentDialogService; this is just the HTTP surface.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private http = inject(HttpClient);

  /** Active agreement text + whether the current user already accepted it. */
  getAgreement(type: AgreementType): Observable<ApiResponse<Agreement>> {
    return this.http.get<ApiResponse<Agreement>>(`${environment.apiUrl}/agreements/${type}`);
  }

  /** Record acceptance of the active agreement (IP/user-agent captured server-side). */
  recordConsent(type: AgreementType, noteId?: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${environment.apiUrl}/consent`, { type, noteId: noteId ?? null });
  }
}
