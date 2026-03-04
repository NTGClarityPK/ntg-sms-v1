'use client';

import { create } from 'zustand';

const STUDENT_TOKEN_KEY = 'studentToken';

function readFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STUDENT_TOKEN_KEY);
}

type StudentSessionState = {
  studentToken: string | null;
  setStudentToken: (token: string) => void;
  clearStudentToken: () => void;
};

export const useStudentSessionStore = create<StudentSessionState>((set) => ({
  studentToken: readFromStorage(),

  setStudentToken: (token: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STUDENT_TOKEN_KEY, token);
    }
    set({ studentToken: token });
  },

  clearStudentToken: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STUDENT_TOKEN_KEY);
    }
    set({ studentToken: null });
  },
}));
