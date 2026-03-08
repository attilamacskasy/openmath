import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-user-guide',
  standalone: true,
  imports: [CommonModule, CardModule, TranslocoModule],
  template: `
    <ng-container *transloco="let t">
    <p-card [header]="t('userGuide.title')">
      <div class="flex flex-column gap-4 line-height-3">

        <section>
          <h3>{{ t('userGuide.introduction') }}</h3>
          <p>{{ t('userGuide.introText') }}</p>
        </section>

        <section>
          <h3>{{ t('userGuide.purpose') }}</h3>
          <p>{{ t('userGuide.purposeText') }}</p>
        </section>

        <section>
          <h3>{{ t('userGuide.coreFeatures') }}</h3>
          <ul>
            <li>{{ t('userGuide.feature1') }}</li>
            <li>{{ t('userGuide.feature2') }}</li>
            <li>{{ t('userGuide.feature3') }}</li>
            <li>{{ t('userGuide.feature4') }}</li>
            <li>{{ t('userGuide.feature5') }}</li>
          </ul>
        </section>

        <section>
          <h3>{{ t('userGuide.gettingStarted') }}</h3>
          <p>{{ t('userGuide.gettingStartedText') }}</p>
        </section>

        <section>
          <h3>{{ t('userGuide.takingQuiz') }}</h3>
          <p>{{ t('userGuide.takingQuizText') }}</p>
        </section>

        <section>
          <h3>{{ t('userGuide.yourProfile') }}</h3>
          <p>{{ t('userGuide.yourProfileText') }}</p>
        </section>

        <section>
          <h3>{{ t('userGuide.notifications') }}</h3>
          <p>{{ t('userGuide.notificationsText') }}</p>
        </section>

        <section>
          <h3>{{ t('userGuide.history') }}</h3>
          <p>{{ t('userGuide.historyText') }}</p>
        </section>

        @if (auth.isTeacher()) {
          <section>
            <h3>{{ t('userGuide.teacherSection') }}</h3>
            <p>{{ t('userGuide.teacherSectionText') }}</p>
          </section>
        }

        @if (auth.isParent()) {
          <section>
            <h3>{{ t('userGuide.parentSection') }}</h3>
            <p>{{ t('userGuide.parentSectionText') }}</p>
          </section>
        }

        @if (auth.isAdmin()) {
          <section>
            <h3>{{ t('userGuide.adminUsers') }}</h3>
            <p>{{ t('userGuide.adminUsersText') }}</p>
          </section>

          <section>
            <h3>{{ t('userGuide.adminQuizTypes') }}</h3>
            <p>{{ t('userGuide.adminQuizTypesText') }}</p>
          </section>

          <section>
            <h3>{{ t('userGuide.adminDatabase') }}</h3>
            <p>{{ t('userGuide.adminDatabaseText') }}</p>
          </section>
        }

      </div>
    </p-card>
    </ng-container>
  `,
})
export class UserGuideComponent {
  auth = inject(AuthService);
}
