import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    TooltipModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div class="flex align-items-center justify-content-between mb-3">
      <h2 class="mt-0 mb-0">My Child</h2>
      <p-button label="Add Child" icon="pi pi-plus" size="small"
        (onClick)="addChildDialogVisible = true"></p-button>
    </div>

    @if (loading()) {
      <p class="text-500">Loading...</p>
    } @else if (children().length === 0) {
      <p-card>
        <p class="text-500">No children assigned to your account.</p>
      </p-card>
    } @else {
      <!-- Child selector (if multiple) -->
      @if (children().length > 1) {
        <div class="flex align-items-center gap-2 mb-3">
          <p-dropdown
            [options]="children()"
            [(ngModel)]="selectedChild"
            optionLabel="name"
            placeholder="Select child"
            (onChange)="onChildSelect($event.value)"
          ></p-dropdown>
          @if (selectedChild) {
            <p-button icon="pi pi-history" [rounded]="true" [text]="true" size="small"
              severity="info" pTooltip="View Full History"
              (click)="viewChildHistory()"></p-button>
            <p-button icon="pi pi-times" [rounded]="true" [text]="true" size="small"
              severity="danger" pTooltip="Remove child"
              (onClick)="removeChild(selectedChild)"></p-button>
          }
        </div>
      } @else if (selectedChild) {
        <div class="flex align-items-center gap-2 mb-3">
          <span class="font-semibold">{{ selectedChild.name }}</span>
          <p-button icon="pi pi-history" [rounded]="true" [text]="true" size="small"
            severity="info" pTooltip="View Full History"
            (click)="viewChildHistory()"></p-button>
          <p-button icon="pi pi-times" [rounded]="true" [text]="true" size="small"
            severity="danger" pTooltip="Remove child"
            (onClick)="removeChild(selectedChild)"></p-button>
        </div>
      }

      @if (selectedChild) {
        <p-card [header]="selectedChild.name + '\\'s Sessions'">
          @if (sessionsLoading()) {
            <p class="text-500">Loading sessions...</p>
          } @else {
            <p-table
              [value]="sessions()"
              [rows]="15"
              [paginator]="sessions().length > 15"
              styleClass="p-datatable-sm"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th>Quiz Type</th>
                  <th>Difficulty</th>
                  <th style="width: 80px">Score</th>
                  <th>Date</th>
                  <th style="width: 100px">Review</th>
                  <th style="width: 100px">Sign-off</th>
                  <th style="width: 80px">Actions</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-s>
                <tr>
                  <td>{{ s.quiz_type_description || s.quiz_type_code }}</td>
                  <td>{{ s.difficulty }}</td>
                  <td>
                    @if (s.score_percent !== null && s.score_percent !== undefined) {
                      {{ s.score_percent }}%
                    } @else {
                      —
                    }
                  </td>
                  <td>{{ s.started_at | date:'short' }}</td>
                  <td>
                    @switch (s.review_status) {
                      @case ('reviewed') {
                        <p-tag value="Reviewed" severity="info"></p-tag>
                      }
                      @case ('signed') {
                        <p-tag value="Signed" severity="success"></p-tag>
                      }
                      @default {
                        <p-tag value="Pending" severity="secondary"></p-tag>
                      }
                    }
                  </td>
                  <td>
                    @if (s.signoff_status === 'signed') {
                      <p-tag value="Signed" severity="success"></p-tag>
                    } @else {
                      <p-tag value="—" severity="secondary"></p-tag>
                    }
                  </td>
                  <td>
                    <p-button
                      icon="pi pi-eye"
                      [rounded]="true"
                      [text]="true"
                      size="small"
                      pTooltip="View & Sign off"
                      (onClick)="openSessionDialog(s)"
                    ></p-button>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr><td colspan="7" class="text-center text-500">No sessions found.</td></tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      }
    }

    <!-- Session Detail + Sign-off Dialog -->
    <p-dialog
      [(visible)]="detailDialogVisible"
      header="Session Detail"
      [modal]="true"
      [style]="{ width: '650px' }"
    >
      @if (detailSession) {
        <div class="mb-3">
          <strong>Quiz:</strong> {{ detailSession.quiz_type_description || detailSession.quiz_type_code }}<br>
          <strong>Score:</strong> {{ detailSession.score_percent }}%<br>
          <strong>Date:</strong> {{ detailSession.started_at | date:'short' }}
        </div>

        @if (sessionDetail()) {
          <h4 class="mt-0 mb-2">Questions</h4>
          <p-table [value]="sessionDetail()!.questions" styleClass="p-datatable-sm mb-3">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 40px">#</th>
                <th>Question</th>
                <th style="width: 80px">Correct</th>
                <th style="width: 80px">Answer</th>
                <th style="width: 80px">Status</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-q>
              <tr>
                <td>{{ q.position }}</td>
                <td>
                  @if (q.prompt?.render_html) {
                    <span [innerHTML]="q.prompt.render_html"></span>
                  } @else {
                    {{ q.prompt?.render || questionText(q) }}
                  }
                </td>
                <td class="font-semibold">{{ q.correct }}</td>
                <td>{{ answerText(q) }}</td>
                <td>
                  @if (!q.answer) {
                    <p-tag value="—" severity="info"></p-tag>
                  } @else if (q.answer.is_correct) {
                    <p-tag value="✔" severity="success"></p-tag>
                  } @else {
                    <p-tag value="✘" severity="danger"></p-tag>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>

          <!-- Reviews -->
          @for (rev of sessionDetail()!.reviews || []; track rev.id) {
            <div class="surface-100 border-round p-3 mb-2">
              <div class="flex justify-content-between">
                <span class="font-semibold">
                  {{ rev.reviewer_role === 'teacher' ? 'Teacher review' : 'Parent sign-off' }}
                  — {{ rev.reviewer_name }}
                </span>
                <p-tag
                  [value]="rev.status"
                  [severity]="rev.status === 'signed' ? 'success' : 'info'"
                ></p-tag>
              </div>
              @if (rev.comment) {
                <p class="mt-2 mb-1">{{ rev.comment }}</p>
              }
              <span class="text-xs text-500">{{ (rev.updated_at || rev.created_at) | date:'short' }}</span>
            </div>
          }
        }

        <div class="flex flex-column gap-2 mt-3">
          <label class="font-semibold">Quick Feedback</label>
          <p-dropdown
            [options]="signoffTemplates()"
            optionLabel="label"
            optionValue="message"
            placeholder="Select a template response..."
            [showClear]="true"
            (onChange)="onTemplateSelect($event)"
          ></p-dropdown>
        </div>

        <div class="flex flex-column gap-2 mt-3">
          <label class="font-semibold">Your Comment (optional)</label>
          <textarea
            pInputTextarea
            [(ngModel)]="signoffComment"
            rows="3"
            class="w-full"
            placeholder="Add a comment..."
          ></textarea>
        </div>
      }

      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" (onClick)="detailDialogVisible = false"></p-button>
        <p-button
          label="Sign Off"
          icon="pi pi-check-circle"
          severity="success"
          (onClick)="submitSignoff()"
          [loading]="signoffSubmitting()"
          [disabled]="!hasTeacherReview()"
          [pTooltip]="hasTeacherReview() ? '' : 'Waiting for teacher review'"
        ></p-button>
      </ng-template>
    </p-dialog>

    <!-- Add Child Dialog -->
    <p-dialog
      [(visible)]="addChildDialogVisible"
      header="Add Child"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <p class="mb-3">Enter the email address of your child to add them to your account.</p>
      <div class="flex flex-column gap-1">
        <label class="font-semibold">Child's Email *</label>
        <input pInputText [(ngModel)]="addChildEmail" class="w-full" type="email"
          placeholder="child@example.com" />
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary"
          (onClick)="addChildDialogVisible = false"></p-button>
        <p-button label="Add" icon="pi pi-plus"
          (onClick)="addChild()" [disabled]="!addChildEmail"
          [loading]="addChildLoading()"></p-button>
      </ng-template>
    </p-dialog>
  `,
})
export class ParentDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  loading = signal(true);
  children = signal<any[]>([]);
  selectedChild: any = null;
  sessionsLoading = signal(false);
  sessions = signal<any[]>([]);

  detailDialogVisible = false;
  detailSession: any = null;
  sessionDetail = signal<any>(null);
  signoffComment = '';
  signoffSubmitting = signal(false);
  signoffTemplates = signal<any[]>([]);

  addChildDialogVisible = false;
  addChildEmail = '';
  addChildLoading = signal(false);

  ngOnInit() {
    this.loadChildren();
  }

  private loadChildren() {
    this.loading.set(true);
    this.api.getParentChildren().subscribe({
      next: (c) => {
        this.children.set(c);
        this.loading.set(false);
        // Auto-select if only one child
        if (c.length === 1) {
          this.selectedChild = c[0];
          this.onChildSelect(c[0]);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  onChildSelect(child: any) {
    if (!child) return;
    this.sessionsLoading.set(true);
    this.api.getParentChildSessions(child.id).subscribe({
      next: (s) => { this.sessions.set(s); this.sessionsLoading.set(false); },
      error: () => this.sessionsLoading.set(false),
    });
  }

  openSessionDialog(session: any) {
    this.detailSession = session;
    this.signoffComment = '';
    this.sessionDetail.set(null);
    this.detailDialogVisible = true;

    this.api.getParentSession(session.id).subscribe({
      next: (d) => this.sessionDetail.set(d),
    });

    // Load templates based on score (v2.5)
    this.api.getReviewTemplates('parent', session.score_percent).subscribe({
      next: (t) => this.signoffTemplates.set(t),
      error: () => this.signoffTemplates.set([]),
    });
  }

  hasTeacherReview(): boolean {
    const reviews = this.sessionDetail()?.reviews || [];
    return reviews.some((r: any) => r.reviewer_role === 'teacher' && r.status === 'reviewed');
  }

  onTemplateSelect(event: any) {
    if (event.value) {
      this.signoffComment = event.value;
    }
  }

  viewChildHistory() {
    if (this.selectedChild) {
      this.router.navigate(['/history/user', this.selectedChild.id]);
    }
  }

  questionText(q: any): string {
    if (q.prompt?.render) return q.prompt.render;
    if (q.c != null) return `(${q.a} × ${q.b}) + (${q.c} × ${q.d})`;
    return `${q.a} × ${q.b}`;
  }

  answerText(q: any): string {
    if (!q.answer) return '—';
    if (q.answer.response?.parsed?.value !== undefined) return String(q.answer.response.parsed.value);
    if (q.answer.value !== undefined) return String(q.answer.value);
    return '—';
  }

  submitSignoff() {
    if (!this.detailSession) return;
    this.signoffSubmitting.set(true);
    this.api.submitParentSignoff(this.detailSession.id, {
      comment: this.signoffComment || undefined,
      status: 'signed',
    }).subscribe({
      next: () => {
        this.signoffSubmitting.set(false);
        this.detailDialogVisible = false;
        this.messageService.add({ severity: 'success', summary: 'Signed', detail: 'Session signed off' });
        if (this.selectedChild) this.onChildSelect(this.selectedChild);
      },
      error: () => {
        this.signoffSubmitting.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to sign off' });
      },
    });
  }

  addChild() {
    this.addChildLoading.set(true);
    this.api.addParentChild(this.addChildEmail).subscribe({
      next: () => {
        this.addChildLoading.set(false);
        this.addChildDialogVisible = false;
        this.addChildEmail = '';
        this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Child added to your account' });
        this.loadChildren();
      },
      error: (err: any) => {
        this.addChildLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to add child' });
      },
    });
  }

  removeChild(child: any) {
    this.api.removeParentChild(child.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Removed', detail: `${child.name} removed` });
        this.loadChildren();
        if (this.selectedChild?.id === child.id) {
          this.selectedChild = null;
          this.sessions.set([]);
        }
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove child' }),
    });
  }
}
