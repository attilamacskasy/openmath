import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../core/services/api.service';
import { DatabaseStats } from '../../models/stats.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    ConfirmDialogModule,
    ToastModule,
    DropdownModule,
    TranslocoModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <ng-container *transloco="let t">
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <h2>{{ t('admin.databaseAdmin') }}</h2>

    <!-- Stats cards -->
    <div class="grid mb-3">
      @for (item of statItems(); track item.label) {
        <div class="col-6 md:col">
          <p-card>
            <div class="text-center">
              <div class="text-500 text-sm">{{ item.label }}</div>
              <div class="text-3xl font-bold text-primary">{{ item.count }}</div>
            </div>
          </p-card>
        </div>
      }
    </div>

    <div class="flex gap-2 mb-3">
      <p-button
        [label]="t('admin.refresh')"
        icon="pi pi-refresh"
        severity="secondary"
        (onClick)="loadStats()"
      ></p-button>
      <p-button
        [label]="t('admin.deleteAllData')"
        icon="pi pi-trash"
        severity="danger"
        (onClick)="confirmReset()"
      ></p-button>
    </div>

    <!-- Table browser -->
    <p-card [header]="t('admin.browseTable')" styleClass="mb-3">
      <div class="flex gap-2 mb-3">
        <p-dropdown
          [options]="tableOptions"
          [(ngModel)]="selectedTable"
          optionLabel="label"
          optionValue="value"
          [placeholder]="t('admin.selectTable')"
        ></p-dropdown>
        <p-button
          [label]="t('admin.load')"
          icon="pi pi-search"
          (onClick)="loadTable()"
          [disabled]="!selectedTable"
        ></p-button>
      </div>

      @if (tableRows().length > 0) {
        <p-table
          [value]="tableRows()"
          [columns]="tableCols()"
          [rows]="20"
          [paginator]="tableRows().length > 20"
          [scrollable]="true"
          scrollHeight="400px"
          styleClass="p-datatable-sm"
        >
          <ng-template pTemplate="header" let-columns>
            <tr>
              @for (col of columns; track col) {
                <th>{{ col }}</th>
              }
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-row let-columns="columns">
            <tr>
              @for (col of columns; track col) {
                <td class="text-sm" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis">
                  {{ stringify(row[col]) }}
                </td>
              }
            </tr>
          </ng-template>
        </p-table>
      }
    </p-card>
    </ng-container>
  `,
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private translocoService = inject(TranslocoService);

  stats = signal<DatabaseStats | null>(null);
  tableRows = signal<any[]>([]);
  tableCols = signal<string[]>([]);
  selectedTable = '';

  get tableOptions() {
    return [
      { label: this.translocoService.translate('admin.quizTypes'), value: 'quiz_types' },
      { label: this.translocoService.translate('admin.users'), value: 'users' },
      { label: this.translocoService.translate('admin.sessions'), value: 'quiz_sessions' },
      { label: this.translocoService.translate('admin.questions'), value: 'questions' },
      { label: this.translocoService.translate('admin.answers'), value: 'answers' },
    ];
  }

  statItems = () => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: this.translocoService.translate('admin.quizTypes'), count: s.quiz_types },
      { label: this.translocoService.translate('admin.users'), count: s.users },
      { label: this.translocoService.translate('admin.sessions'), count: s.quiz_sessions },
      { label: this.translocoService.translate('admin.questions'), count: s.questions },
      { label: this.translocoService.translate('admin.answers'), count: s.answers },
    ];
  };

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.api.getStats().subscribe((s) => this.stats.set(s));
  }

  loadTable() {
    if (!this.selectedTable) return;
    this.api.getTableRows(this.selectedTable).subscribe((res) => {
      const rows = res.rows || [];
      this.tableRows.set(rows);
      this.tableCols.set(rows.length > 0 ? Object.keys(rows[0]) : []);
    });
  }

  confirmReset() {
    this.confirm.confirm({
      message: this.translocoService.translate('admin.deleteAllConfirm'),
      header: this.translocoService.translate('admin.deleteAllData'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.resetData('DELETE ALL DATA').subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: this.translocoService.translate('common.success'),
              detail: this.translocoService.translate('admin.allDataDeleted'),
            });
            this.loadStats();
            this.tableRows.set([]);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: this.translocoService.translate('common.error'),
              detail: this.translocoService.translate('admin.deleteFailed'),
            });
          },
        });
      },
    });
  }

  stringify(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }
}
