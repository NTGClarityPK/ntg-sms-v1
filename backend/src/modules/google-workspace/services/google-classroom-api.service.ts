import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  GoogleClassroomCourse,
  GoogleClassroomCoursework,
  GoogleClassroomRubric,
  GoogleRubricCriterion,
  GoogleStudentSubmission,
} from '../types/google-classroom.types';

const API_BASE = 'https://classroom.googleapis.com/v1';

type GoogleListResponse<T> = {
  courses?: T[];
  courseWork?: T[];
  studentSubmissions?: T[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

@Injectable()
export class GoogleClassroomApiService {
  async listCourses(accessToken: string): Promise<GoogleClassroomCourse[]> {
    const courses: GoogleClassroomCourse[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        pageSize: '100',
        courseStates: 'ACTIVE',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const data = await this.getJson<GoogleListResponse<GoogleClassroomCourse>>(
        `${API_BASE}/courses?${params.toString()}`,
        accessToken,
      );
      courses.push(...(data.courses ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return courses;
  }

  async listCoursework(
    accessToken: string,
    courseId: string,
  ): Promise<GoogleClassroomCoursework[]> {
    const items: GoogleClassroomCoursework[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);

      const data = await this.getJson<
        GoogleListResponse<GoogleClassroomCoursework>
      >(
        `${API_BASE}/courses/${encodeURIComponent(courseId)}/courseWork?${params.toString()}`,
        accessToken,
      );
      items.push(...(data.courseWork ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return items;
  }

  async getCoursework(
    accessToken: string,
    courseId: string,
    courseworkId: string,
  ): Promise<GoogleClassroomCoursework> {
    return this.getJson<GoogleClassroomCoursework>(
      `${API_BASE}/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseworkId)}`,
      accessToken,
    );
  }

  async listStudentSubmissions(
    accessToken: string,
    courseId: string,
    courseworkId: string,
  ): Promise<GoogleStudentSubmission[]> {
    const items: GoogleStudentSubmission[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);

      const data = await this.getJson<
        GoogleListResponse<GoogleStudentSubmission>
      >(
        `${API_BASE}/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseworkId)}/studentSubmissions?${params.toString()}`,
        accessToken,
      );
      items.push(...(data.studentSubmissions ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Submissions list never includes emails — always resolve from course roster / profiles.
    const emailByUserId = await this.listCourseStudentEmails(accessToken, courseId);
    for (const submission of items) {
      const email = emailByUserId.get(submission.userId);
      if (email) {
        submission.userProfile = {
          ...(submission.userProfile ?? {}),
          emailAddress: email,
        };
      }
    }

    // Fallback for any still missing (e.g. removed from roster but submission remains)
    const missingUserIds = [
      ...new Set(
        items
          .filter((s) => !s.userProfile?.emailAddress)
          .map((s) => s.userId)
          .filter(Boolean),
      ),
    ];
    if (missingUserIds.length > 0) {
      const fallbackEmails = await this.fetchStudentEmails(
        accessToken,
        courseId,
        missingUserIds,
      );
      for (const submission of items) {
        if (submission.userProfile?.emailAddress) continue;
        const email = fallbackEmails.get(submission.userId);
        if (email) {
          submission.userProfile = {
            ...(submission.userProfile ?? {}),
            emailAddress: email,
          };
        }
      }
    }

    return items;
  }

  /** Map Google userId → email for every student currently on the course roster. */
  async listCourseStudentEmails(
    accessToken: string,
    courseId: string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await this.getJson<{
        students?: Array<{
          userId?: string;
          profile?: { emailAddress?: string };
        }>;
        nextPageToken?: string;
      }>(
        `${API_BASE}/courses/${encodeURIComponent(courseId)}/students?${params.toString()}`,
        accessToken,
      );
      for (const student of data.students ?? []) {
        const email = student.profile?.emailAddress?.toLowerCase().trim();
        if (student.userId && email) map.set(student.userId, email);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return map;
  }

  /**
   * Fetch coursework rubric with at most one successful Google call when possible:
   * prefer get-by-id when hint is known, otherwise list (max 1 rubric).
   */
  async getRubricIfAny(
    accessToken: string,
    courseId: string,
    courseworkId: string,
    coursework?: GoogleClassroomCoursework,
    rubricIdHint?: string | null,
  ): Promise<GoogleClassroomRubric | null> {
    type RubricPayload = GoogleClassroomRubric & {
      criteria?: GoogleRubricCriterion[];
    };

    const rubricId = rubricIdHint?.trim();
    if (rubricId) {
      try {
        const rubric = await this.getJson<RubricPayload>(
          `${API_BASE}/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseworkId)}/rubrics/${encodeURIComponent(rubricId)}`,
          accessToken,
        );
        if (rubric?.criteria?.length) {
          return this.mapRubricPayload(rubric, courseId, courseworkId);
        }
      } catch {
        // Fall through to list when get-by-id fails
      }
    }

    try {
      const list = await this.getJson<{ rubrics?: RubricPayload[] }>(
        `${API_BASE}/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseworkId)}/rubrics`,
        accessToken,
      );
      const listed = list.rubrics?.[0];
      if (listed?.criteria?.length) {
        return this.mapRubricPayload(listed, courseId, courseworkId);
      }
    } catch {
      // Rubric endpoint may 404 / lack scope
    }

    void coursework;
    return null;
  }

  private mapRubricPayload(
    rubric: GoogleClassroomRubric & { criteria?: GoogleRubricCriterion[] },
    courseId: string,
    courseworkId: string,
  ): GoogleClassroomRubric {
    return {
      courseId: rubric.courseId ?? courseId,
      courseWorkId: rubric.courseWorkId ?? courseworkId,
      id: rubric.id,
      criteria: rubric.criteria ?? [],
    };
  }

  private async fetchStudentEmails(
    accessToken: string,
    courseId: string,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          const profile = await this.getJson<{
            userId?: string;
            profile?: { emailAddress?: string };
            emailAddress?: string;
          }>(
            `${API_BASE}/userProfiles/${encodeURIComponent(userId)}`,
            accessToken,
          );
          const email =
            profile.profile?.emailAddress?.toLowerCase() ||
            profile.emailAddress?.toLowerCase();
          return { userId, email: email ?? null };
        } catch {
          return { userId, email: null };
        }
      }),
    );
    for (const row of results) {
      if (row.email) map.set(row.userId, row.email);
    }

    // Also try course students roster for any still missing
    const stillMissing = userIds.filter((id) => !map.has(id));
    if (stillMissing.length > 0) {
      try {
        let pageToken: string | undefined;
        do {
          const params = new URLSearchParams({ pageSize: '100' });
          if (pageToken) params.set('pageToken', pageToken);
          const data = await this.getJson<{
            students?: Array<{
              userId?: string;
              profile?: { emailAddress?: string };
            }>;
            nextPageToken?: string;
          }>(
            `${API_BASE}/courses/${encodeURIComponent(courseId)}/students?${params.toString()}`,
            accessToken,
          );
          for (const student of data.students ?? []) {
            const email = student.profile?.emailAddress?.toLowerCase();
            if (student.userId && email) map.set(student.userId, email);
          }
          pageToken = data.nextPageToken;
        } while (pageToken);
      } catch {
        // Roster may be unavailable with current scopes in edge cases
      }
    }

    return map;
  }

  private async getJson<T>(url: string, accessToken: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new BadRequestException(
        'Unable to reach the Google Classroom API',
      );
    }

    const payload = (await res.json().catch(() => ({}))) as T & {
      error?: { message?: string; status?: string };
    };

    if (!res.ok) {
      const message =
        payload.error?.message ||
        `Google Classroom API error (${res.status})`;
      throw new BadRequestException(message);
    }

    return payload;
  }
}
