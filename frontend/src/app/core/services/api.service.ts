import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  ApiResponse,
  AuthResponse,
  PageResponse,
  Note,
  SellerFullProfile,
  Purchase,
  PaymentOrder,
  SellerEarnings,
  PayoutRow,
  PayoutStats,
  LandingContent,
  Review,
  ReviewStats,
  AdminDashboard,
  SellerDashboard,
  User,
  TestConfig,
  TestOverview,
  TestQuestionAdmin,
  AppNotification,
  Taxonomy,
  SocialStats,
  Qualification,
  SellerTest,
  TestResult,
  QualificationReview,
  PendingNote,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private p(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v != null && v !== '') params = params.set(k, String(v));
    });
    return params;
  }

  // ── Notes ──────────────────────────────────────────────────
  getNotes(filters: Record<string, unknown> = {}): Observable<ApiResponse<PageResponse<Note>>> {
    return this.http.get<ApiResponse<PageResponse<Note>>>(`${this.base}/notes`, { params: this.p(filters) });
  }
  getNote(id: number): Observable<ApiResponse<Note>> {
    return this.http.get<ApiResponse<Note>>(`${this.base}/notes/${id}`);
  }
  /** Public seller profile + their published notes (for the /u/:id page). */
  getSellerProfile(id: number): Observable<ApiResponse<SellerFullProfile>> {
    return this.http.get<ApiResponse<SellerFullProfile>>(`${this.base}/sellers/${id}`);
  }
  getPublicSellerNotes(id: number): Observable<ApiResponse<Note[]>> {
    return this.http.get<ApiResponse<Note[]>>(`${this.base}/sellers/${id}/notes`);
  }
  /** Distinct filter options (categories, exams, subjects) from active notes. */
  getFilterOptions(): Observable<ApiResponse<{ categories: string[]; exams: string[]; subjects: string[] }>> {
    return this.http.get<ApiResponse<{ categories: string[]; exams: string[]; subjects: string[] }>>(
      `${this.base}/notes/filters`,
    );
  }
  /** Upload with progress events (subscribe for UploadProgress + final Response). */
  uploadNote(fd: FormData): Observable<HttpEvent<ApiResponse<Note>>> {
    return this.http.post<ApiResponse<Note>>(`${this.base}/notes`, fd, {
      reportProgress: true,
      observe: 'events',
    });
  }
  /** Median suggested price for an exam+subject (null if not enough data). */
  getSuggestedPrice(
    exam: string,
    subject: string,
  ): Observable<ApiResponse<{ price: number | null; sampleSize: number }>> {
    return this.http.get<ApiResponse<{ price: number | null; sampleSize: number }>>(
      `${this.base}/notes/price-suggestion`,
      {
        params: this.p({ exam, subject }),
      },
    );
  }
  /** Update an existing listing's editable fields (+ optional new pdf/thumbnail). */
  updateNote(id: number, fd: FormData): Observable<HttpEvent<ApiResponse<Note>>> {
    return this.http.put<ApiResponse<Note>>(`${this.base}/notes/${id}`, fd, {
      reportProgress: true,
      observe: 'events',
    });
  }
  updateNotePrice(id: number, price: number): Observable<ApiResponse<Note>> {
    return this.http.patch<ApiResponse<Note>>(`${this.base}/notes/${id}/price`, { price });
  }
  /** Publish (active=true) or hide (active=false) a listing. */
  setNoteVisibility(id: number, active: boolean): Observable<ApiResponse<Note>> {
    return this.http.patch<ApiResponse<Note>>(`${this.base}/notes/${id}/visibility`, null, {
      params: this.p({ active }),
    });
  }
  deleteNote(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/notes/${id}`);
  }
  cloneNote(id: number): Observable<ApiResponse<Note>> {
    return this.http.post<ApiResponse<Note>>(`${this.base}/notes/${id}/clone`, {});
  }
  restoreNote(id: number): Observable<ApiResponse<Note>> {
    return this.http.patch<ApiResponse<Note>>(`${this.base}/notes/${id}/restore`, {});
  }
  getSellerTrash(page = 0): Observable<ApiResponse<PageResponse<Note>>> {
    return this.http.get<ApiResponse<PageResponse<Note>>>(`${this.base}/seller/notes/trash`, {
      params: this.p({ page, size: 20 }),
    });
  }
  getNotePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/notes/${id}/view`, { responseType: 'blob' });
  }
  /** First-pages public preview PDF (no purchase required). */
  getNotePreview(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/notes/${id}/preview`, { responseType: 'blob' });
  }

  // ── Buyer ──────────────────────────────────────────────────
  purchaseNote(noteId: number): Observable<ApiResponse<Purchase>> {
    return this.http.post<ApiResponse<Purchase>>(`${this.base}/buyer/purchase/${noteId}`, {});
  }
  createPaymentOrder(noteId: number): Observable<ApiResponse<PaymentOrder>> {
    return this.http.post<ApiResponse<PaymentOrder>>(`${this.base}/buyer/payments/order/${noteId}`, {});
  }
  verifyPayment(noteId: number, orderId: string): Observable<ApiResponse<Purchase>> {
    return this.http.post<ApiResponse<Purchase>>(`${this.base}/buyer/payments/verify`, { noteId, orderId });
  }
  getMyPurchases(page = 0, size = 10): Observable<ApiResponse<PageResponse<Purchase>>> {
    return this.http.get<ApiResponse<PageResponse<Purchase>>>(`${this.base}/buyer/purchases`, {
      params: this.p({ page, size }),
    });
  }
  submitReview(noteId: number, rating: number, comment: string): Observable<ApiResponse<Review>> {
    return this.http.post<ApiResponse<Review>>(`${this.base}/buyer/notes/${noteId}/review`, { rating, comment });
  }
  /** Public — anyone can read reviews on a note. */
  getNoteReviews(noteId: number, page = 0): Observable<ApiResponse<PageResponse<Review>>> {
    return this.http.get<ApiResponse<PageResponse<Review>>>(`${this.base}/notes/${noteId}/reviews`, {
      params: this.p({ page }),
    });
  }
  /** Public — aggregate review stats (average, total, per-star counts). */
  getReviewStats(noteId: number): Observable<ApiResponse<ReviewStats>> {
    return this.http.get<ApiResponse<ReviewStats>>(`${this.base}/notes/${noteId}/reviews/stats`);
  }
  /** The logged-in buyer's own review for a note (data null if none) — for editing. */
  getMyReview(noteId: number): Observable<ApiResponse<Review | null>> {
    return this.http.get<ApiResponse<Review | null>>(`${this.base}/buyer/notes/${noteId}/my-review`);
  }

  // ── Exam taxonomy ──────────────────────────────────────────
  /** Public — active Category → Exam → Subject tree for upload/browse. */
  getTaxonomy(): Observable<ApiResponse<Taxonomy>> {
    return this.http.get<ApiResponse<Taxonomy>>(`${this.base}/taxonomy`);
  }
  /** Admin — full tree incl. disabled entries. */
  getFullTaxonomy(): Observable<ApiResponse<Taxonomy>> {
    return this.http.get<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy`);
  }
  createCategory(name: string): Observable<ApiResponse<Taxonomy>> {
    return this.http.post<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/categories`, { name });
  }
  updateCategory(id: number, body: { name?: string; active?: boolean }): Observable<ApiResponse<Taxonomy>> {
    return this.http.put<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/categories/${id}`, body);
  }
  deleteCategory(id: number): Observable<ApiResponse<Taxonomy>> {
    return this.http.delete<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/categories/${id}`);
  }
  createExam(categoryId: number, name: string): Observable<ApiResponse<Taxonomy>> {
    return this.http.post<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/categories/${categoryId}/exams`, {
      name,
    });
  }
  updateExam(id: number, body: { name?: string; active?: boolean }): Observable<ApiResponse<Taxonomy>> {
    return this.http.put<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/exams/${id}`, body);
  }
  deleteExam(id: number): Observable<ApiResponse<Taxonomy>> {
    return this.http.delete<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/exams/${id}`);
  }
  createSubject(examId: number, name: string): Observable<ApiResponse<Taxonomy>> {
    return this.http.post<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/exams/${examId}/subjects`, { name });
  }
  updateSubject(id: number, body: { name?: string; active?: boolean }): Observable<ApiResponse<Taxonomy>> {
    return this.http.put<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/subjects/${id}`, body);
  }
  deleteSubject(id: number): Observable<ApiResponse<Taxonomy>> {
    return this.http.delete<ApiResponse<Taxonomy>>(`${this.base}/admin/taxonomy/subjects/${id}`);
  }

  // ── Seller qualifications (per-category) ───────────────────
  getMyQualifications(): Observable<ApiResponse<Qualification[]>> {
    return this.http.get<ApiResponse<Qualification[]>>(`${this.base}/seller/qualifications`);
  }
  getEligibleCategories(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.base}/seller/eligible-categories`);
  }
  startCategoryTest(categoryId: number): Observable<ApiResponse<SellerTest>> {
    return this.http.get<ApiResponse<SellerTest>>(`${this.base}/seller/qualifications/${categoryId}/test`);
  }
  submitCategoryTest(categoryId: number, answers: Record<number, string>): Observable<ApiResponse<TestResult>> {
    return this.http.post<ApiResponse<TestResult>>(
      `${this.base}/seller/qualifications/${categoryId}/test/submit`,
      answers,
    );
  }
  uploadQualificationMarksheet(categoryId: number, fd: FormData): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.base}/seller/qualifications/${categoryId}/marksheet`, fd);
  }
  getPendingQualifications(page = 0): Observable<ApiResponse<PageResponse<QualificationReview>>> {
    return this.http.get<ApiResponse<PageResponse<QualificationReview>>>(`${this.base}/admin/qualifications/pending`, {
      params: this.p({ page, size: 20 }),
    });
  }
  reviewQualification(id: number, approved: boolean, reason?: string): Observable<ApiResponse<QualificationReview>> {
    return this.http.post<ApiResponse<QualificationReview>>(`${this.base}/admin/qualifications/${id}/review`, null, {
      params: this.p(reason ? { approved, reason } : { approved }),
    });
  }
  getPendingNotes(page = 0): Observable<ApiResponse<PageResponse<PendingNote>>> {
    return this.http.get<ApiResponse<PageResponse<PendingNote>>>(`${this.base}/admin/notes/pending`, {
      params: this.p({ page, size: 20 }),
    });
  }
  reviewNote(id: number, approved: boolean, reason?: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/admin/notes/${id}/review`, {
      approved,
      reason: reason ?? null,
    });
  }

  // ── Seller ─────────────────────────────────────────────────
  getSellerDashboard(): Observable<ApiResponse<SellerDashboard>> {
    return this.http.get<ApiResponse<SellerDashboard>>(`${this.base}/seller/dashboard`);
  }
  getSellerNotes(page = 0): Observable<ApiResponse<PageResponse<Note>>> {
    return this.http.get<ApiResponse<PageResponse<Note>>>(`${this.base}/seller/notes`, {
      params: this.p({ page, size: 10 }),
    });
  }
  getSellerSales(page = 0): Observable<ApiResponse<PageResponse<Purchase>>> {
    return this.http.get<ApiResponse<PageResponse<Purchase>>>(`${this.base}/seller/sales`, {
      params: this.p({ page, size: 10 }),
    });
  }
  getVerificationTest(): Observable<ApiResponse<Record<string, unknown>[]>> {
    return this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/seller/verification/test`);
  }
  submitVerificationTest(answers: Record<number, string>): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(
      `${this.base}/seller/verification/test/submit`,
      answers,
    );
  }
  uploadMarksheet(fd: FormData): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.base}/seller/verification/marksheet`, fd);
  }
  getVerificationStatus(): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/seller/verification/status`);
  }
  getUpiId(): Observable<ApiResponse<string | null>> {
    return this.http.get<ApiResponse<string | null>>(`${this.base}/profile/upi`);
  }
  setUpiId(upiId: string): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.base}/profile/upi`, { upiId });
  }
  changePassword(currentPassword: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.base}/profile/password`, { currentPassword, newPassword });
  }
  updateProfile(fullName: string, phone: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.put<ApiResponse<AuthResponse>>(`${this.base}/profile`, { fullName, phone });
  }
  uploadProfileImage(fd: FormData): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.base}/profile/image`, fd);
  }
  removeProfileImage(): Observable<ApiResponse<AuthResponse>> {
    return this.http.delete<ApiResponse<AuthResponse>>(`${this.base}/profile/image`);
  }

  // ── Payouts ────────────────────────────────────────────────
  getSellerEarnings(): Observable<ApiResponse<SellerEarnings>> {
    return this.http.get<ApiResponse<SellerEarnings>>(`${this.base}/seller/earnings`);
  }
  requestPayout(): Observable<ApiResponse<PayoutRow>> {
    return this.http.post<ApiResponse<PayoutRow>>(`${this.base}/seller/payouts`, {});
  }
  getSellerPayouts(page = 0, size = 10): Observable<ApiResponse<PageResponse<PayoutRow>>> {
    return this.http.get<ApiResponse<PageResponse<PayoutRow>>>(`${this.base}/seller/payouts`, {
      params: this.p({ page, size }),
    });
  }
  getPendingPayouts(page = 0, size = 20): Observable<ApiResponse<PageResponse<PayoutRow>>> {
    return this.http.get<ApiResponse<PageResponse<PayoutRow>>>(`${this.base}/admin/payouts/pending`, {
      params: this.p({ page, size }),
    });
  }
  getPayoutStats(): Observable<ApiResponse<PayoutStats>> {
    return this.http.get<ApiResponse<PayoutStats>>(`${this.base}/admin/payouts/stats`);
  }
  getPayouts(status = '', q = '', page = 0, size = 20): Observable<ApiResponse<PageResponse<PayoutRow>>> {
    return this.http.get<ApiResponse<PageResponse<PayoutRow>>>(`${this.base}/admin/payouts`, {
      params: this.p({ status, q, page, size }),
    });
  }
  payPayout(id: number): Observable<ApiResponse<PayoutRow>> {
    return this.http.post<ApiResponse<PayoutRow>>(`${this.base}/admin/payouts/${id}/pay`, {});
  }

  // ── Landing content (CMS) ──────────────────────────────────
  getLandingContent(): Observable<ApiResponse<LandingContent>> {
    return this.http.get<ApiResponse<LandingContent>>(`${this.base}/content/landing`);
  }
  /** Live social-proof stats for the landing hero. */
  getSocialStats(): Observable<ApiResponse<SocialStats>> {
    return this.http.get<ApiResponse<SocialStats>>(`${this.base}/stats/social`);
  }
  updateLandingContent(content: LandingContent): Observable<ApiResponse<LandingContent>> {
    return this.http.put<ApiResponse<LandingContent>>(`${this.base}/admin/content/landing`, content);
  }
  uploadContentImage(fd: FormData): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.base}/admin/content/image`, fd);
  }

  // ── Admin ──────────────────────────────────────────────────
  getAdminDashboard(): Observable<ApiResponse<AdminDashboard>> {
    return this.http.get<ApiResponse<AdminDashboard>>(`${this.base}/admin/dashboard`);
  }
  getUsers(role?: string, page = 0, keyword?: string, status?: string): Observable<ApiResponse<PageResponse<User>>> {
    const p: Record<string, unknown> = { page, size: 20 };
    if (role) p['role'] = role;
    if (status) p['status'] = status;
    if (keyword) p['keyword'] = keyword;
    return this.http.get<ApiResponse<PageResponse<User>>>(`${this.base}/admin/users`, { params: this.p(p) });
  }
  suspendUser(id: number): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.base}/admin/users/${id}/suspend`, {});
  }
  activateUser(id: number): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.base}/admin/users/${id}/activate`, {});
  }
  getPendingVerifications(page = 0): Observable<ApiResponse<PageResponse<User>>> {
    return this.http.get<ApiResponse<PageResponse<User>>>(`${this.base}/admin/verifications/pending`, {
      params: this.p({ page }),
    });
  }
  approveSeller(id: number, approved: boolean, reason?: string): Observable<ApiResponse<User>> {
    const p: Record<string, unknown> = { approved };
    if (reason) p['reason'] = reason;
    return this.http.post<ApiResponse<User>>(
      `${this.base}/admin/verifications/${id}/approve`,
      {},
      { params: this.p(p) },
    );
  }
  getConfig(): Observable<ApiResponse<Record<string, string>>> {
    return this.http.get<ApiResponse<Record<string, string>>>(`${this.base}/admin/config`);
  }
  updateConfig(configKey: string, configValue: string): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.base}/admin/config`, { configKey, configValue });
  }

  // ── Admin: Test Management (per-category; categoryId omitted = General/Default) ──
  getTestOverview(): Observable<ApiResponse<TestOverview[]>> {
    return this.http.get<ApiResponse<TestOverview[]>>(`${this.base}/admin/test/overview`);
  }
  getTestConfig(categoryId?: number | null): Observable<ApiResponse<TestConfig>> {
    return this.http.get<ApiResponse<TestConfig>>(`${this.base}/admin/test/config`, {
      params: this.p(categoryId != null ? { categoryId } : {}),
    });
  }
  updateTestConfig(cfg: TestConfig, categoryId?: number | null): Observable<ApiResponse<TestConfig>> {
    return this.http.put<ApiResponse<TestConfig>>(`${this.base}/admin/test/config`, cfg, {
      params: this.p(categoryId != null ? { categoryId } : {}),
    });
  }
  getTestQuestions(
    keyword?: string,
    page = 0,
    categoryId?: number | null,
  ): Observable<ApiResponse<PageResponse<TestQuestionAdmin>>> {
    const p: Record<string, unknown> = { page, size: 20 };
    if (keyword) p['keyword'] = keyword;
    if (categoryId != null) p['categoryId'] = categoryId;
    return this.http.get<ApiResponse<PageResponse<TestQuestionAdmin>>>(`${this.base}/admin/test/questions`, {
      params: this.p(p),
    });
  }
  createTestQuestion(q: TestQuestionAdmin): Observable<ApiResponse<TestQuestionAdmin>> {
    return this.http.post<ApiResponse<TestQuestionAdmin>>(`${this.base}/admin/test/questions`, q);
  }
  updateTestQuestion(id: number, q: TestQuestionAdmin): Observable<ApiResponse<TestQuestionAdmin>> {
    return this.http.put<ApiResponse<TestQuestionAdmin>>(`${this.base}/admin/test/questions/${id}`, q);
  }
  deleteTestQuestion(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/admin/test/questions/${id}`);
  }
  toggleTestQuestion(id: number, isActive: boolean): Observable<ApiResponse<TestQuestionAdmin>> {
    return this.http.patch<ApiResponse<TestQuestionAdmin>>(`${this.base}/admin/test/questions/${id}/toggle`, null, {
      params: this.p({ isActive }),
    });
  }

  // ── Notifications ──────────────────────────────────────────
  getNotifications(page = 0): Observable<ApiResponse<PageResponse<AppNotification>>> {
    return this.http.get<ApiResponse<PageResponse<AppNotification>>>(`${this.base}/notifications`, {
      params: this.p({ page }),
    });
  }
  getUnreadCount(): Observable<ApiResponse<{ count: number }>> {
    return this.http.get<ApiResponse<{ count: number }>>(`${this.base}/notifications/unread-count`);
  }
  markNotificationsRead(): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.base}/notifications/mark-all-read`, {});
  }
}
