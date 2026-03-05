import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(
    startedAt: string | null,
    finishedAt: string | null
  ): string {
    if (!startedAt) return '0s';

    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const seconds = Math.max(0, Math.floor((end - start) / 1000));

    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mm = Math.floor(seconds / 60);
      const ss = seconds % 60;
      return `${mm}:${ss.toString().padStart(2, '0')}`;
    }

    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds % 3600) / 60);
    const ss = seconds % 60;
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }
}
