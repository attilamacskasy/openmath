import { Injectable, signal, computed, inject } from '@angular/core';
import { QuestionOut } from '../../models/session.model';
import { StudentListItem } from '../../models/student.model';
import { ApiService } from './api.service';

export interface ActiveQuiz {
  sessionId: string;
  quizTypeCode: string;
  questions: QuestionOut[];
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private api = inject(ApiService);

  private _activeQuiz = signal<ActiveQuiz | null>(null);
  private _currentStudentId = signal<string>('');
  private _studentsDirectory = signal<StudentListItem[]>([]);

  readonly activeQuiz = this._activeQuiz.asReadonly();
  readonly currentStudentId = this._currentStudentId.asReadonly();
  readonly studentsDirectory = this._studentsDirectory.asReadonly();

  readonly currentStudent = computed(() => {
    const id = this._currentStudentId();
    return this._studentsDirectory().find((s) => s.id === id) || null;
  });

  setActiveQuiz(quiz: ActiveQuiz | null) {
    this._activeQuiz.set(quiz);
  }

  setCurrentStudent(id: string) {
    this._currentStudentId.set(id);
  }

  setStudentsDirectory(students: StudentListItem[]) {
    this._studentsDirectory.set(students);
  }

  refreshStudents(): void {
    this.api.getStudents().subscribe((students) => {
      this._studentsDirectory.set(students);
      // Auto-reset if selected student no longer exists
      const id = this._currentStudentId();
      if (id && !students.find((s) => s.id === id)) {
        this._currentStudentId.set('');
      }
    });
  }
}
