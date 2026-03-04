import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface StudentTokenPayloadInput {
  studentId: string;
  branchId: string;
  schoolId?: string;
}

export interface StudentTokenPayload {
  sub?: string;
  role: string;
  purpose: string;
  student_id: string;
  branch_id: string;
  school_id?: string;
}

@Injectable()
export class StudentTokenService {
  constructor(private readonly jwtService: JwtService) {}

  mintStudentToken(input: StudentTokenPayloadInput): string {
    const payload: StudentTokenPayload = {
      sub: `student:${input.studentId}`,
      role: 'authenticated',
      purpose: 'student-db',
      student_id: input.studentId,
      branch_id: input.branchId,
      school_id: input.schoolId,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '2h',
    });
  }

  verifyStudentToken(token: string): StudentTokenPayload {
    return this.jwtService.verify<StudentTokenPayload>(token);
  }
}

