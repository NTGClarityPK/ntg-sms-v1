import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';

  const load = (path: string) =>
    import(`../../messages/${locale}/${path}`)
      .then((m) => m.default as Record<string, unknown>)
      .catch(() => ({}));

  const [
    common,
    auth,
    students,
    navigation,
    dashboard,
    attendance,
    assessment,
    behavioral,
    leave,
    earlyDeparture,
    notification,
    messages,
    library,
    inventory,
    user,
    classMessages,
    teacher,
    event,
    timetable,
    reports,
    results,
    settings,
    storage,
  ] =
    await Promise.all([
      load('common.json'),
      load('auth.json'),
      load('students.json'),
      load('navigation.json'),
      load('dashboard.json'),
      load('attendance.json'),
      load('assessment.json'),
      load('behavioral.json'),
      load('leave.json'),
      load('earlyDeparture.json'),
      load('notification.json'),
      load('messages.json'),
      load('library.json'),
      load('inventory.json'),
      load('user.json'),
      load('class.json'),
      load('teacher.json'),
      load('event.json'),
      load('timetable.json'),
      load('reports.json'),
      load('results.json'),
      load('settings.json'),
      load('storage.json'),
    ]);

  return {
    locale,
    messages: {
      common,
      auth,
      students,
      navigation,
      dashboard,
      attendance,
      assessment,
      behavioral,
      leave,
      earlyDeparture,
      notification,
      messages,
      library,
      inventory,
      user,
      class: classMessages,
      teacher,
      event,
      timetable,
      reports,
      results,
      settings,
      storage,
    },
  };
});
