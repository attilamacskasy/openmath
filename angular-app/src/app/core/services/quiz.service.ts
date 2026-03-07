import { Injectable, signal, computed, inject } from '@angular/core';
import { QuestionOut } from '../../models/session.model';
import { UserListItem } from '../../models/user.model';
import { ApiService } from './api.service';

export interface ActiveQuiz {
  sessionId: string;
  quizTypeCode: string;
  quizTypeDescription: string;
  quizTypeCategory: string;
  questions: QuestionOut[];
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private api = inject(ApiService);

  private _activeQuiz = signal<ActiveQuiz | null>(null);
  private _currentUserId = signal<string>('');
  private _usersDirectory = signal<UserListItem[]>([]);

  readonly activeQuiz = this._activeQuiz.asReadonly();
  readonly currentUserId = this._currentUserId.asReadonly();
  readonly usersDirectory = this._usersDirectory.asReadonly();

  readonly currentUser = computed(() => {
    const id = this._currentUserId();
    return this._usersDirectory().find((s) => s.id === id) || null;
  });

  setActiveQuiz(quiz: ActiveQuiz | null) {
    this._activeQuiz.set(quiz);
  }

  setCurrentUser(id: string) {
    this._currentUserId.set(id);
  }

  setUsersDirectory(users: UserListItem[]) {
    this._usersDirectory.set(users);
  }

  refreshUsers(): void {
    this.api.getUsers().subscribe((users) => {
      this._usersDirectory.set(users);
      // Auto-reset if selected user no longer exists
      const id = this._currentUserId();
      if (id && !users.find((s) => s.id === id)) {
        this._currentUserId.set('');
      }
    });
  }
}
