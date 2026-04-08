import { redirect } from 'next/navigation';

export default function TeacherMappingPage() {
  redirect('/mapping?tab=teacher-class');
}

