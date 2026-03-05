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
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog></p-confirmDialog>

    <h2>Database Admin</h2>

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
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        (onClick)="loadStats()"
      ></p-button>
      <p-button
        label="Delete All Data"
        icon="pi pi-trash"
        severity="danger"
        (onClick)="confirmReset()"
      ></p-button>
    </div>

    <!-- Table browser -->
    <p-card header="Browse Table" styleClass="mb-3">
      <div class="flex gap-2 mb-3">
        <p-dropdown
          [options]="tableOptions"
          [(ngModel)]="selectedTable"
          optionLabel="label"
          optionValue="value"
          placeholder="Select table"
        ></p-dropdown>
        <p-button
          label="Load"
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
  `,
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private confirm = inject(ConfirmationService);
  private messageService = inject(MessageService);

  stats = signal<DatabaseStats | null>(null);
  tableRows = signal<any[]>([]);
  tableCols = signal<string[]>([]);
  selectedTable = '';

  tableOptions = [
    { label: 'Quiz Types', value: 'quiz_types' },
    { label: 'Students', value: 'students' },
    { label: 'Quiz Sessions', value: 'quiz_sessions' },
    { label: 'Questions', value: 'questions' },
    { label: 'Answers', value: 'answers' },
  ];

  statItems = () => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Quiz Types', count: s.quiz_types },
      { label: 'Students', count: s.students },
      { label: 'Sessions', count: s.quiz_sessions },
      { label: 'Questions', count: s.questions },
      { label: 'Answers', count: s.answers },
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
      message: 'This will permanently delete ALL student and session data. Quiz types will be preserved. Are you sure?',
      header: 'Delete All Data',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.resetData('DELETE ALL DATA').subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Done',
              detail: 'All data deleted.',
            });
            this.loadStats();
            this.tableRows.set([]);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete data.',
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
