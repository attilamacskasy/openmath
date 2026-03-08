import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../core/services/api.service';
import { QuizType, QuizTypeCreate, QuizTypeUpdate, PreviewQuestion } from '../../models/quiz-type.model';

@Component({
  selector: 'app-quiz-type-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CardModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    InputSwitchModule,
    DropdownModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    TranslocoModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <ng-container *transloco="let t">
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <div class="flex justify-content-between align-items-center mb-3">
      <h2 class="m-0">{{ t('quizEditor.title') }}</h2>
      <p-button [label]="t('quizEditor.newQuizType')" icon="pi pi-plus" (onClick)="openNew()"></p-button>
    </div>

    <!-- Category filter -->
    <div class="mb-3">
      <p-dropdown
        [options]="categoryFilterOptions()"
        [(ngModel)]="categoryFilter"
        optionLabel="label"
        optionValue="value"
        [placeholder]="t('quizEditor.allCategories')"
        [style]="{ 'min-width': '200px' }"
      ></p-dropdown>
    </div>

    <p-table
      [value]="filteredQuizTypes()"
      [rows]="25"
      [paginator]="filteredQuizTypes().length > 25"
      styleClass="p-datatable-sm p-datatable-striped"
      [sortField]="'sort_order'"
      [sortOrder]="1"
    >
      <ng-template pTemplate="header">
        <tr>
          <th pSortableColumn="sort_order" style="width:60px"># <p-sortIcon field="sort_order"></p-sortIcon></th>
          <th pSortableColumn="code">{{ t('quizEditor.code') }} <p-sortIcon field="code"></p-sortIcon></th>
          <th pSortableColumn="description">{{ t('quizEditor.description') }} <p-sortIcon field="description"></p-sortIcon></th>
          <th pSortableColumn="category">{{ t('quizEditor.category') }} <p-sortIcon field="category"></p-sortIcon></th>
          <th>{{ t('quizEditor.template') }}</th>
          <th>{{ t('quizEditor.answer') }}</th>
          <th pSortableColumn="recommended_age_min">{{ t('quizEditor.ages') }} <p-sortIcon field="recommended_age_min"></p-sortIcon></th>
          <th style="width:80px">{{ t('quizEditor.active') }}</th>
          <th style="width:120px">{{ t('admin.actions') }}</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-qt>
        <tr>
          <td>{{ qt.sort_order }}</td>
          <td><code>{{ qt.code }}</code></td>
          <td>{{ qt.description }}</td>
          <td>
            @if (qt.category) {
              <p-tag [value]="qt.category" [severity]="categorySeverity(qt.category)"></p-tag>
            }
          </td>
          <td class="font-mono text-sm">{{ qt.template_kind }}</td>
          <td><p-tag [value]="qt.answer_type" [severity]="'info'" [rounded]="true"></p-tag></td>
          <td>
            @if (qt.recommended_age_min != null && qt.recommended_age_max != null) {
              {{ qt.recommended_age_min }}–{{ qt.recommended_age_max }}
            } @else {
              —
            }
          </td>
          <td>
            <p-inputSwitch
              [(ngModel)]="qt.is_active"
              (onChange)="toggleActive(qt)"
            ></p-inputSwitch>
          </td>
          <td>
            <div class="flex gap-1">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="editQuizType(qt)"></p-button>
              <p-button icon="pi pi-eye" [text]="true" [rounded]="true" size="small" severity="info" (onClick)="showPreview(qt)"></p-button>
              <p-button icon="pi pi-trash" [text]="true" [rounded]="true" size="small" severity="danger" (onClick)="confirmDelete(qt)"></p-button>
            </div>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="9" class="text-center text-500 p-4">{{ t('quizEditor.noQuizTypes') }}</td></tr>
      </ng-template>
    </p-table>

    <!-- Create / Edit Dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [header]="isEditing ? t('quizEditor.editQuizType') : t('quizEditor.newQuizType')"
      [modal]="true"
      [style]="{ width: '550px' }"
      [closable]="true"
    >
      <div class="flex flex-column gap-3 pt-2">
        <!-- Code -->
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('quizEditor.code') }}</label>
          <input pInputText [(ngModel)]="formCode" [disabled]="isEditing" [placeholder]="t('quizEditor.codePlaceholder')" />
        </div>

        <!-- Description -->
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('quizEditor.description') }}</label>
          <input pInputText [(ngModel)]="formDescription" [placeholder]="t('quizEditor.descPlaceholder')" />
        </div>

        <!-- Template Kind -->
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('quizEditor.templateKind') }}</label>
          <p-dropdown
            [options]="templateKindOptions"
            [(ngModel)]="formTemplateKind"
            [editable]="true"
            [placeholder]="t('quizEditor.selectOrType')"
          ></p-dropdown>
        </div>

        <!-- Answer Type -->
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('quizEditor.answerType') }}</label>
          <p-dropdown
            [options]="answerTypeOptions"
            [(ngModel)]="formAnswerType"
          ></p-dropdown>
        </div>

        <!-- Category -->
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('quizEditor.category') }}</label>
          <p-dropdown
            [options]="existingCategories()"
            [(ngModel)]="formCategory"
            [editable]="true"
            [placeholder]="t('quizEditor.selectOrType')"
          ></p-dropdown>
        </div>

        <div class="flex gap-3">
          <!-- Age Min -->
          <div class="flex flex-column gap-1" style="flex: 1; min-width: 0;">
            <label class="font-semibold">{{ t('quizEditor.ageMin') }}</label>
            <p-inputNumber [(ngModel)]="formAgeMin" [min]="4" [max]="18" [showButtons]="true" [inputStyle]="{ width: '100%' }" [style]="{ width: '100%' }"></p-inputNumber>
          </div>
          <!-- Age Max -->
          <div class="flex flex-column gap-1" style="flex: 1; min-width: 0;">
            <label class="font-semibold">{{ t('quizEditor.ageMax') }}</label>
            <p-inputNumber [(ngModel)]="formAgeMax" [min]="4" [max]="18" [showButtons]="true" [inputStyle]="{ width: '100%' }" [style]="{ width: '100%' }"></p-inputNumber>
          </div>
        </div>

        <!-- Sort Order -->
        <div class="flex flex-column gap-1">
          <label class="font-semibold">{{ t('quizEditor.sortOrder') }}</label>
          <p-inputNumber [(ngModel)]="formSortOrder" [min]="0" [showButtons]="true"></p-inputNumber>
        </div>

        <!-- Active -->
        <div class="flex align-items-center gap-2">
          <label class="font-semibold">{{ t('quizEditor.active') }}</label>
          <p-inputSwitch [(ngModel)]="formIsActive"></p-inputSwitch>
        </div>

        <!-- Preview inside dialog -->
        @if (dialogPreview().length > 0) {
          <div class="surface-50 p-3 border-round">
            <div class="font-semibold mb-2">{{ t('quizEditor.preview') }}:</div>
            @for (p of dialogPreview(); track p.render) {
              <div class="text-sm mb-1">• {{ p.render }} = {{ p.correct }}</div>
            }
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="flex gap-2 justify-content-between">
          <p-button [label]="t('quizEditor.preview')" icon="pi pi-eye" severity="info" [text]="true" (onClick)="previewInDialog()"></p-button>
          <div class="flex gap-2">
            <p-button [label]="t('common.cancel')" severity="secondary" [text]="true" (onClick)="dialogVisible = false"></p-button>
            <p-button [label]="isEditing ? t('common.save') : t('common.create')" icon="pi pi-check" (onClick)="saveQuizType()"></p-button>
          </div>
        </div>
      </ng-template>
    </p-dialog>

    <!-- Preview Dialog -->
    <p-dialog
      [(visible)]="previewDialogVisible"
      [header]="t('quizEditor.previewQuestions')"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      @if (previewLoading()) {
        <p class="text-500">{{ t('quizEditor.generatingPreview') }}</p>
      } @else {
        <div class="flex flex-column gap-2">
          @for (p of previewQuestions(); track p.render) {
            <div class="surface-50 p-3 border-round flex justify-content-between">
              <span class="font-semibold">{{ p.render }}</span>
              <span class="text-green-600">= {{ p.correct }}</span>
            </div>
          }
        </div>
      }
    </p-dialog>
    </ng-container>
  `,
})
export class QuizTypeEditorComponent implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmationService);
  private msg = inject(MessageService);
  private translocoService = inject(TranslocoService);

  quizTypes = signal<QuizType[]>([]);
  categoryFilter = '';
  dialogVisible = false;
  isEditing = false;
  editingId = '';

  previewDialogVisible = false;
  previewLoading = signal(false);
  previewQuestions = signal<PreviewQuestion[]>([]);
  dialogPreview = signal<PreviewQuestion[]>([]);

  // Form fields
  formCode = '';
  formDescription = '';
  formTemplateKind = '';
  formAnswerType = 'int';
  formCategory: string | null = null;
  formAgeMin: number | null = null;
  formAgeMax: number | null = null;
  formSortOrder = 0;
  formIsActive = true;

  templateKindOptions = [
    'axb', 'axb_plus_cxd', 'a_plus_b', 'a_minus_b',
    'round_tens_add', 'round_tens_sub', 'a_plus_b_100', 'a_minus_b_100',
    'two_plus_one', 'two_minus_one', 'times_table', 'a_div_b', 'a_div_b_rem',
    'double', 'count_by_n', 'roman_to_int', 'int_to_roman',
    'dm_to_cm', 'm_to_cm', 'length_add',
  ];

  answerTypeOptions = ['int', 'text', 'tuple'];

  filteredQuizTypes = computed(() => {
    const all = this.quizTypes();
    if (!this.categoryFilter) return all;
    return all.filter((qt) => qt.category === this.categoryFilter);
  });

  categoryFilterOptions = computed(() => {
    const cats = [...new Set(this.quizTypes().map((qt) => qt.category).filter(Boolean))];
    return [{ label: this.translocoService.translate('quizEditor.allCategories'), value: '' }, ...cats.map((c) => ({ label: c!, value: c! }))];
  });

  existingCategories = computed(() => {
    return [...new Set(this.quizTypes().map((qt) => qt.category).filter(Boolean))] as string[];
  });

  ngOnInit() {
    this.loadQuizTypes();
  }

  loadQuizTypes() {
    this.api.getAdminQuizTypes().subscribe((types) => this.quizTypes.set(types));
  }

  categorySeverity(category: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'secondary'> = {
      arithmetic: 'info',
      multiplication: 'success',
      patterns: 'warning',
      roman: 'danger',
      measurement: 'secondary',
    };
    return map[category] || 'info';
  }

  openNew() {
    this.isEditing = false;
    this.editingId = '';
    this.formCode = '';
    this.formDescription = '';
    this.formTemplateKind = '';
    this.formAnswerType = 'int';
    this.formCategory = null;
    this.formAgeMin = null;
    this.formAgeMax = null;
    this.formSortOrder = Math.max(0, ...this.quizTypes().map((qt) => qt.sort_order)) + 1;
    this.formIsActive = true;
    this.dialogPreview.set([]);
    this.dialogVisible = true;
  }

  editQuizType(qt: QuizType) {
    this.isEditing = true;
    this.editingId = qt.id;
    this.formCode = qt.code;
    this.formDescription = qt.description;
    this.formTemplateKind = qt.template_kind || '';
    this.formAnswerType = qt.answer_type;
    this.formCategory = qt.category;
    this.formAgeMin = qt.recommended_age_min;
    this.formAgeMax = qt.recommended_age_max;
    this.formSortOrder = qt.sort_order;
    this.formIsActive = qt.is_active;
    this.dialogPreview.set([]);
    this.dialogVisible = true;
  }

  saveQuizType() {
    if (!this.formCode || !this.formDescription || !this.formTemplateKind) {
      this.msg.add({ severity: 'warn', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('quizEditor.validationRequired') });
      return;
    }

    if (this.isEditing) {
      const data: QuizTypeUpdate = {
        description: this.formDescription,
        template_kind: this.formTemplateKind,
        answer_type: this.formAnswerType,
        category: this.formCategory,
        recommended_age_min: this.formAgeMin,
        recommended_age_max: this.formAgeMax,
        is_active: this.formIsActive,
        sort_order: this.formSortOrder,
      };
      this.api.updateQuizType(this.editingId, data).subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('quizEditor.quizTypeUpdated') });
          this.dialogVisible = false;
          this.loadQuizTypes();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: err.error?.detail || 'Update failed' }),
      });
    } else {
      const data: QuizTypeCreate = {
        code: this.formCode,
        description: this.formDescription,
        template_kind: this.formTemplateKind,
        answer_type: this.formAnswerType,
        category: this.formCategory,
        recommended_age_min: this.formAgeMin,
        recommended_age_max: this.formAgeMax,
        is_active: this.formIsActive,
        sort_order: this.formSortOrder,
      };
      this.api.createQuizType(data).subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('quizEditor.quizTypeCreated') });
          this.dialogVisible = false;
          this.loadQuizTypes();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: err.error?.detail || 'Create failed' }),
      });
    }
  }

  toggleActive(qt: QuizType) {
    this.api.updateQuizType(qt.id, { is_active: qt.is_active }).subscribe({
      error: () => {
        qt.is_active = !qt.is_active;
        this.msg.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('quizEditor.toggleFailed') });
      },
    });
  }

  confirmDelete(qt: QuizType) {
    this.confirm.confirm({
      message: this.translocoService.translate('quizEditor.confirmDeleteMessage', { name: qt.description }),
      header: this.translocoService.translate('quizEditor.confirmDelete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.deleteQuizType(qt.id).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: this.translocoService.translate('common.success'), detail: this.translocoService.translate('quizEditor.quizTypeDeleted') });
            this.loadQuizTypes();
          },
          error: (err) => this.msg.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: err.error?.detail || 'Delete failed' }),
        });
      },
    });
  }

  showPreview(qt: QuizType) {
    this.previewLoading.set(true);
    this.previewQuestions.set([]);
    this.previewDialogVisible = true;
    this.api.previewQuizType(qt.id).subscribe({
      next: (questions) => {
        this.previewQuestions.set(questions);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        this.msg.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('quizEditor.previewFailed') });
      },
    });
  }

  previewInDialog() {
    if (!this.formTemplateKind) return;
    this.api.previewByTemplate(this.formTemplateKind, this.formAnswerType, this.formCode).subscribe({
      next: (questions) => this.dialogPreview.set(questions),
      error: () => this.msg.add({ severity: 'error', summary: this.translocoService.translate('common.error'), detail: this.translocoService.translate('quizEditor.previewFailed') }),
    });
  }
}
