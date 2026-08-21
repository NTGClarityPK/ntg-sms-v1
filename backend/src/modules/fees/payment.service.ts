import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { FeePdfService } from './fee-pdf.service';

type PaymentRow = {
  id: string;
  challan_id: string;
  student_id: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  transaction_reference: string | null;
  bank_name: string | null;
  proof_document_url: string | null;
  status: 'Pending_Review' | 'Verified' | 'Rejected';
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
};

type ChallanRow = {
  id: string;
  challan_number: string;
  student_id: string;
  months_included: string[] | null;
  payable_amount: number;
  due_date: string;
  status: string;
  receipt_url: string | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  if (error.code === '23505') throw new ConflictException('Duplicate record');
  throw new BadRequestException(error.message);
}

type BranchBusinessInfo = {
  branchName: string;
  schoolName: string;
  address: string;
  phone: string;
  email: string;
};

@Injectable()
export class PaymentService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly feePdfService: FeePdfService,
  ) {}

  private async getBranchBusinessInfo(branchId: string): Promise<BranchBusinessInfo> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch, error: bErr } = await supabase
      .from('branches')
      .select('id, tenant_id, name, address, phone, email')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(bErr);

    const branchRow = branch as
      | { tenant_id?: string | null; name?: string | null; address?: string | null; phone?: string | null; email?: string | null }
      | null;

    const tenantId = branchRow?.tenant_id ?? null;
    let schoolName = '';
    if (tenantId) {
      const { data: tenant, error: tErr } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
      throwIfDbError(tErr);
      schoolName = (tenant as { name?: string | null } | null)?.name ?? '';
    }

    return {
      branchName: branchRow?.name ?? '—',
      schoolName: schoolName || branchRow?.name || '—',
      address: branchRow?.address ?? '',
      phone: branchRow?.phone ?? '',
      email: branchRow?.email ?? '',
    };
  }

  private async getFeeChallanFooterText(branchId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_challan_settings')
      .select('footer_text')
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    return ((data ?? null) as { footer_text?: string | null } | null)?.footer_text ?? null;
  }

  async createPaymentWithProof(input: {
    challanId: string;
    amountPaid: number;
    paymentDate: string;
    paymentMethod: string;
    transactionReference?: string;
    bankName?: string;
    proof: { buffer: Buffer; mimetype: string; originalname: string; size: number };
    parentUserId: string;
    branchId: string;
  }): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    // Access control: parent must be linked to this student via challan.student_id
    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, student_id, payable_amount, status')
      .eq('id', input.challanId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Challan not found');

    const challanStudentId = (challan as { student_id: string }).student_id;
    const { data: link, error: linkErr } = await supabase
      .from('parent_students')
      .select('id')
      .eq('parent_user_id', input.parentUserId)
      .eq('student_id', challanStudentId)
      .maybeSingle();
    throwIfDbError(linkErr);
    if (!link) throw new ForbiddenException('You do not have access to this challan');

    const payable = Number((challan as { payable_amount: number }).payable_amount);
    if (Math.abs(Number(input.amountPaid) - payable) > 0.009) {
      throw new BadRequestException('Amount paid must match challan payable amount');
    }
    const status = (challan as { status: string }).status;
    if (status !== 'Pending_Payment' && status !== 'Rejected') {
      throw new BadRequestException('This challan cannot accept a new payment submission');
    }

    const filePath = `payments/${input.branchId}/${input.challanId}/${Date.now()}-${input.proof.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from('fee-documents')
      .upload(filePath, input.proof.buffer, { contentType: input.proof.mimetype, upsert: false });
    if (uploadError) throw new BadRequestException(`Upload failed: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from('fee-documents').getPublicUrl(filePath);

    const { data: row, error } = await supabase
      .from('fee_payments')
      .insert({
        branch_id: input.branchId,
        challan_id: input.challanId,
        student_id: challanStudentId,
        amount_paid: input.amountPaid,
        payment_date: input.paymentDate.slice(0, 10),
        payment_method: input.paymentMethod,
        transaction_reference: input.transactionReference ?? null,
        bank_name: input.bankName ?? null,
        proof_document_url: publicUrl,
        status: 'Pending_Review',
        notes: null,
      })
      .select('id')
      .single();
    throwIfDbError(error);
    if (!row) throw new BadRequestException('Failed to create payment');

    await supabase
      .from('fee_challans')
      .update({ status: 'Under_Review' })
      .eq('id', input.challanId)
      .eq('branch_id', input.branchId);

    return { data: { id: (row as { id: string }).id } };
  }

  async createPaymentWithProofForStudent(input: {
    challanId: string;
    amountPaid: number;
    paymentDate: string;
    paymentMethod: string;
    transactionReference?: string;
    bankName?: string;
    proof: { buffer: Buffer; mimetype: string; originalname: string; size: number };
    studentId: string;
    branchId: string;
  }): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, student_id, payable_amount, status')
      .eq('id', input.challanId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Challan not found');

    const challanStudentId = (challan as { student_id: string }).student_id;
    if (challanStudentId !== input.studentId) {
      throw new ForbiddenException('You do not have access to this challan');
    }

    const payable = Number((challan as { payable_amount: number }).payable_amount);
    if (Math.abs(Number(input.amountPaid) - payable) > 0.009) {
      throw new BadRequestException('Amount paid must match challan payable amount');
    }
    const status = (challan as { status: string }).status;
    if (status !== 'Pending_Payment' && status !== 'Rejected') {
      throw new BadRequestException('This challan cannot accept a new payment submission');
    }

    const filePath = `payments/${input.branchId}/${input.challanId}/${Date.now()}-${input.proof.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from('fee-documents')
      .upload(filePath, input.proof.buffer, { contentType: input.proof.mimetype, upsert: false });
    if (uploadError) throw new BadRequestException(`Upload failed: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from('fee-documents').getPublicUrl(filePath);

    const { data: row, error } = await supabase
      .from('fee_payments')
      .insert({
        branch_id: input.branchId,
        challan_id: input.challanId,
        student_id: challanStudentId,
        amount_paid: input.amountPaid,
        payment_date: input.paymentDate.slice(0, 10),
        payment_method: input.paymentMethod,
        transaction_reference: input.transactionReference ?? null,
        bank_name: input.bankName ?? null,
        proof_document_url: publicUrl,
        status: 'Pending_Review',
        notes: null,
      })
      .select('id')
      .single();
    throwIfDbError(error);
    if (!row) throw new BadRequestException('Failed to create payment');

    await supabase
      .from('fee_challans')
      .update({ status: 'Under_Review' })
      .eq('id', input.challanId)
      .eq('branch_id', input.branchId);

    return { data: { id: (row as { id: string }).id } };
  }

  async listStudentPayments(
    studentId: string,
    branchId: string,
  ): Promise<{
    data: Array<{
      challanNumber: string;
      studentId: string;
      studentName: string;
      month: string;
      amountPaid: number;
      paymentDate: string;
      status: string;
      receiptUrl: string | null;
      verifiedAt: string | null;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('branch_id', branchId)
      .eq('id', studentId)
      .maybeSingle();
    throwIfDbError(sErr);
    if (!student) return { data: [] };
    const sRow = student as { id: string; first_name: string | null; last_name: string | null };
    const studentName = [sRow.first_name, sRow.last_name].filter(Boolean).join(' ') || '—';

    const { data: rows, error } = await supabase
      .from('fee_payments')
      .select(
        'id, challan_id, student_id, amount_paid, payment_date, status, verified_at, fee_challans:challan_id(challan_number, month, receipt_url)',
      )
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });
    throwIfDbError(error);

    return {
      data: ((rows ?? []) as Array<any>).map((r) => {
        const challan = Array.isArray(r.fee_challans) ? r.fee_challans[0] : r.fee_challans;
        return {
          challanNumber: challan?.challan_number ?? '—',
          studentId: r.student_id,
          studentName,
          month: challan?.month ?? '—',
          amountPaid: Number(r.amount_paid),
          paymentDate: r.payment_date,
          status: r.status,
          receiptUrl: challan?.receipt_url ?? null,
          verifiedAt: r.verified_at ?? null,
        };
      }),
    };
  }

  async listPendingVerifications(branchId: string): Promise<{
    data: Array<{
      id: string;
      challanNumber: string;
      studentId: string;
      studentName: string;
      amountPaid: number;
      paymentDate: string;
      bankName: string | null;
      transactionReference: string | null;
      proofDocumentUrl: string | null;
      uploadedAt: string;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('fee_payments')
      .select('id, challan_id, student_id, amount_paid, payment_date, bank_name, transaction_reference, proof_document_url, created_at')
      .eq('branch_id', branchId)
      .eq('status', 'Pending_Review')
      .order('created_at', { ascending: true });
    throwIfDbError(error);

    const rows = (data ?? []) as Array<{
      id: string;
      challan_id: string;
      student_id: string;
      amount_paid: number;
      payment_date: string;
      bank_name: string | null;
      transaction_reference: string | null;
      proof_document_url: string | null;
      created_at: string;
    }>;

    if (rows.length === 0) return { data: [] };

    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
    const challanIds = Array.from(new Set(rows.map((r) => r.challan_id)));

    const [{ data: students }, { data: challans }] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name').eq('branch_id', branchId).in('id', studentIds),
      supabase.from('fee_challans').select('id, challan_number').eq('branch_id', branchId).in('id', challanIds),
    ]);

    const studentNameById = new Map(
      ((students ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((s) => [
        s.id,
        [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
      ]),
    );
    const challanNumberById = new Map(
      ((challans ?? []) as Array<{ id: string; challan_number: string }>).map((c) => [c.id, c.challan_number]),
    );

    return {
      data: rows.map((r) => ({
        id: r.id,
        challanNumber: challanNumberById.get(r.challan_id) ?? '—',
        studentId: r.student_id,
        studentName: studentNameById.get(r.student_id) ?? '—',
        amountPaid: Number(r.amount_paid),
        paymentDate: r.payment_date,
        bankName: r.bank_name,
        transactionReference: r.transaction_reference,
        proofDocumentUrl: r.proof_document_url,
        uploadedAt: r.created_at,
      })),
    };
  }

  async getPaymentForReview(paymentId: string, branchId: string): Promise<{
    data: {
      challan: { id: string; challanNumber: string; payableAmount: number; dueDate: string; receiptUrl: string | null };
      payment: {
        id: string;
        amountPaid: number;
        paymentDate: string;
        paymentMethod: string;
        bankName: string | null;
        transactionReference: string | null;
        proofDocumentUrl: string | null;
        status: string;
        verifiedAt: string | null;
        rejectionReason: string | null;
        notes: string | null;
      };
    };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: pay, error } = await supabase
      .from('fee_payments')
      .select('id, challan_id, amount_paid, payment_date, payment_method, bank_name, transaction_reference, proof_document_url, status, verified_at, rejection_reason, notes')
      .eq('id', paymentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!pay) throw new NotFoundException('Payment not found');

    const row = pay as any as PaymentRow;
    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, payable_amount, due_date, receipt_url')
      .eq('id', row.challan_id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Challan not found');
    const c = challan as any as ChallanRow;

    return {
      data: {
        challan: {
          id: c.id,
          challanNumber: c.challan_number,
          payableAmount: Number(c.payable_amount),
          dueDate: c.due_date,
          receiptUrl: c.receipt_url,
        },
        payment: {
          id: row.id,
          amountPaid: Number(row.amount_paid),
          paymentDate: row.payment_date,
          paymentMethod: row.payment_method,
          bankName: row.bank_name,
          transactionReference: row.transaction_reference,
          proofDocumentUrl: row.proof_document_url,
          status: row.status,
          verifiedAt: row.verified_at,
          rejectionReason: row.rejection_reason,
          notes: row.notes,
        },
      },
    };
  }

  /**
   * Generates receipt PDF from current challan line items and uploads to storage (upsert).
   * Updates fee_challans.receipt_url. Used on verify and when admin regenerates receipt.
   */
  private async renderAndUploadReceiptPdf(input: {
    branchId: string;
    challan: { id: string; challan_number: string; student_id: string; payable_amount: number };
    payment: { amount_paid: number; payment_date: string; payment_method: string };
    verifiedAtIso: string;
  }): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();

    const { data: items, error: itemErr } = await supabase
      .from('fee_challan_items')
      .select('billing_month, description, amount, is_discount, template_id')
      .eq('challan_id', input.challan.id);
    throwIfDbError(itemErr);

    const businessInfo = await this.getBranchBusinessInfo(input.branchId);
    const footerText = await this.getFeeChallanFooterText(input.branchId);

    let currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD' = 'PKR';
    const templateIds = Array.from(
      new Set(
        ((items ?? []) as Array<{ template_id?: string | null }>)
          .map((row) => row.template_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (templateIds.length > 0) {
      const { data: tplRows, error: tplErr } = await supabase
        .from('fee_templates')
        .select('currency_code')
        .eq('branch_id', input.branchId)
        .in('id', templateIds)
        .limit(5);
      throwIfDbError(tplErr);
      const firstCode = (tplRows ?? [])[0] as { currency_code?: string } | undefined;
      const cc = firstCode?.currency_code;
      if (cc === 'PKR' || cc === 'IQD' || cc === 'SAR' || cc === 'USD') {
        currencyCode = cc;
      }
    }

    const studentRes = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', input.challan.student_id)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    const studentNameRow = studentRes.data as { first_name?: string | null; last_name?: string | null } | null;
    const studentName = [studentNameRow?.first_name, studentNameRow?.last_name].filter(Boolean).join(' ') || '—';

    const receiptNumber = `REC-${input.challan.challan_number}`;
    const receiptPdf = await this.feePdfService.generateReceiptPdf({
      businessInfo,
      receiptNumber,
      challanNumber: input.challan.challan_number,
      studentName,
      verifiedAt: input.verifiedAtIso,
      paymentMethod: input.payment.payment_method,
      paymentDate: input.payment.payment_date,
      amountPaid: Number(input.payment.amount_paid),
      items: ((items ?? []) as Array<{ billing_month: string | null; description: string; amount: number; is_discount: boolean }>).map((i) => ({
        billingMonth: i.billing_month,
        description: i.description,
        amount: Math.abs(Number(i.amount)),
        isDiscount: !!i.is_discount,
      })),
      totalPayable: Number(input.challan.payable_amount),
      currencyCode,
      footerText,
    });

    const receiptPath = `receipts/${input.branchId}/${input.challan.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('fee-documents')
      .upload(receiptPath, receiptPdf, { contentType: 'application/pdf', upsert: true });
    if (uploadError) {
      return null;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('fee-documents').getPublicUrl(receiptPath);
    await supabase
      .from('fee_challans')
      .update({ receipt_url: publicUrl })
      .eq('id', input.challan.id)
      .eq('branch_id', input.branchId);

    return publicUrl;
  }

  async regenerateReceipt(input: { paymentId: string; branchId: string }): Promise<{ data: { receiptUrl: string | null } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: pay, error } = await supabase
      .from('fee_payments')
      .select('id, challan_id, status, amount_paid, payment_date, payment_method, verified_at')
      .eq('id', input.paymentId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!pay) throw new NotFoundException('Payment not found');
    const p = pay as PaymentRow;
    if (p.status !== 'Verified') {
      throw new BadRequestException('Receipt can only be regenerated for verified payments');
    }
    if (!p.verified_at) {
      throw new BadRequestException('Payment has no verification timestamp');
    }

    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, payable_amount')
      .eq('id', p.challan_id)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Challan not found');
    const c = challan as { id: string; challan_number: string; student_id: string; payable_amount: number };

    const receiptUrl = await this.renderAndUploadReceiptPdf({
      branchId: input.branchId,
      challan: c,
      payment: {
        amount_paid: Number(p.amount_paid),
        payment_date: p.payment_date,
        payment_method: p.payment_method,
      },
      verifiedAtIso: p.verified_at,
    });

    return { data: { receiptUrl } };
  }

  /**
   * Admin cash desk: record full payment as Verified with no proof upload.
   * Blocks when challan is Under_Review (parent proof pending) — use verify/reject instead.
   */
  async markPaidCash(input: {
    challanId: string;
    adminUserId: string;
    branchId: string;
    paymentDate?: string;
    notes?: string;
  }): Promise<{ data: { id: string; receiptUrl: string | null } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, months_included, payable_amount, status')
      .eq('id', input.challanId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Challan not found');
    const c = challan as ChallanRow & { status: string };

    if (c.status === 'Under_Review') {
      throw new BadRequestException(
        'This fee bill has a payment under review. Verify or reject it in Payment history first.',
      );
    }
    if (c.status === 'Verified') {
      throw new BadRequestException('This fee bill is already marked as paid');
    }
    if (c.status !== 'Pending_Payment' && c.status !== 'Rejected') {
      throw new BadRequestException('This fee bill cannot be marked as paid in its current status');
    }

    const { data: existingPending, error: pendErr } = await supabase
      .from('fee_payments')
      .select('id')
      .eq('challan_id', c.id)
      .eq('branch_id', input.branchId)
      .eq('status', 'Pending_Review')
      .limit(1)
      .maybeSingle();
    throwIfDbError(pendErr);
    if (existingPending) {
      throw new BadRequestException(
        'This fee bill has a payment under review. Verify or reject it in Payment history first.',
      );
    }

    const paymentDate =
      (input.paymentDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    const verifiedAt = new Date().toISOString();
    const payable = Number(c.payable_amount);

    const { data: payRow, error: insErr } = await supabase
      .from('fee_payments')
      .insert({
        branch_id: input.branchId,
        challan_id: c.id,
        student_id: c.student_id,
        amount_paid: payable,
        payment_date: paymentDate,
        payment_method: 'Cash',
        transaction_reference: null,
        bank_name: null,
        proof_document_url: null,
        status: 'Verified',
        verified_by: input.adminUserId,
        verified_at: verifiedAt,
        notes: input.notes?.trim() || null,
      })
      .select('id, amount_paid, payment_date, payment_method')
      .single();
    throwIfDbError(insErr);
    if (!payRow) throw new BadRequestException('Failed to record payment');

    await supabase
      .from('fee_challans')
      .update({ status: 'Verified' })
      .eq('id', c.id)
      .eq('branch_id', input.branchId);

    const p = payRow as {
      id: string;
      amount_paid: number;
      payment_date: string;
      payment_method: string;
    };

    const publicUrl = await this.renderAndUploadReceiptPdf({
      branchId: input.branchId,
      challan: {
        id: c.id,
        challan_number: c.challan_number,
        student_id: c.student_id,
        payable_amount: payable,
      },
      payment: {
        amount_paid: Number(p.amount_paid),
        payment_date: p.payment_date,
        payment_method: p.payment_method,
      },
      verifiedAtIso: verifiedAt,
    });

    const months =
      c.months_included && c.months_included.length > 0 ? c.months_included : [];
    if (months.length > 0) {
      await supabase.from('fee_challan_month_coverage').upsert(
        months.map((m) => ({
          branch_id: input.branchId,
          challan_id: c.id,
          student_id: c.student_id,
          month: m,
        })),
        { onConflict: 'student_id,month' },
      );
    }

    return { data: { id: p.id, receiptUrl: publicUrl } };
  }

  async verifyPayment(input: {
    paymentId: string;
    adminUserId: string;
    adminNotes?: string;
    branchId: string;
  }): Promise<{ data: { id: string; receiptUrl: string | null } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: pay, error } = await supabase
      .from('fee_payments')
      .select('id, challan_id, student_id, amount_paid, payment_date, payment_method, status')
      .eq('id', input.paymentId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!pay) throw new NotFoundException('Payment not found');
    const p = pay as any as PaymentRow;
    if (p.status !== 'Pending_Review') throw new BadRequestException('Only pending payments can be verified');

    const { data: challan, error: cErr } = await supabase
      .from('fee_challans')
      .select('id, challan_number, student_id, months_included, payable_amount')
      .eq('id', p.challan_id)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(cErr);
    if (!challan) throw new NotFoundException('Challan not found');
    const c = challan as any as ChallanRow;

    const verifiedAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('fee_payments')
      .update({
        status: 'Verified',
        verified_by: input.adminUserId,
        verified_at: verifiedAt,
        rejection_reason: null,
        notes: input.adminNotes ?? null,
      })
      .eq('id', p.id)
      .eq('branch_id', input.branchId);
    throwIfDbError(updErr);

    await supabase
      .from('fee_challans')
      .update({ status: 'Verified' })
      .eq('id', c.id)
      .eq('branch_id', input.branchId);

    const publicUrl = await this.renderAndUploadReceiptPdf({
      branchId: input.branchId,
      challan: {
        id: c.id,
        challan_number: c.challan_number,
        student_id: c.student_id,
        payable_amount: Number(c.payable_amount),
      },
      payment: {
        amount_paid: Number(p.amount_paid),
        payment_date: p.payment_date,
        payment_method: p.payment_method,
      },
      verifiedAtIso: verifiedAt,
    });

    if (!publicUrl) {
      return { data: { id: p.id, receiptUrl: null } };
    }

    // Month coverage (for multi-month verified challans)
    const months = (c.months_included && c.months_included.length > 0) ? c.months_included : [];
    if (months.length > 0) {
      await supabase.from('fee_challan_month_coverage').upsert(
        months.map((m) => ({ branch_id: input.branchId, challan_id: c.id, student_id: c.student_id, month: m })),
        { onConflict: 'student_id,month' },
      );
    }

    return { data: { id: p.id, receiptUrl: publicUrl } };
  }

  async rejectPayment(input: {
    paymentId: string;
    reason: string;
    branchId: string;
  }): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: pay, error } = await supabase
      .from('fee_payments')
      .select('id, challan_id, status')
      .eq('id', input.paymentId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!pay) throw new NotFoundException('Payment not found');
    const p = pay as any as PaymentRow;
    if (p.status !== 'Pending_Review') throw new BadRequestException('Only pending payments can be rejected');

    const { error: updErr } = await supabase
      .from('fee_payments')
      .update({ status: 'Rejected', rejection_reason: input.reason, verified_by: null, verified_at: null })
      .eq('id', p.id)
      .eq('branch_id', input.branchId);
    throwIfDbError(updErr);

    await supabase
      .from('fee_challans')
      .update({ status: 'Pending_Payment' })
      .eq('id', p.challan_id)
      .eq('branch_id', input.branchId);

    return { data: { id: p.id } };
  }

  async listMyStudentsPayments(parentUserId: string, branchId: string): Promise<{
    data: Array<{
      challanNumber: string;
      studentId: string;
      studentName: string;
      month: string;
      amountPaid: number;
      paymentDate: string;
      status: string;
      receiptUrl: string | null;
      verifiedAt: string | null;
    }>;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: links, error: linkErr } = await supabase
      .from('parent_students')
      .select('student_id')
      .eq('parent_user_id', parentUserId);
    throwIfDbError(linkErr);
    const studentIds = Array.from(
      new Set((links ?? []).map((r) => (r as { student_id: string }).student_id).filter(Boolean)),
    );
    if (studentIds.length === 0) return { data: [] };

    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, branch_id')
      .in('id', studentIds);
    throwIfDbError(sErr);
    const linkedStudents = (students ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      branch_id: string;
    }>;
    if (linkedStudents.length === 0) return { data: [] };

    const nameById = new Map(
      linkedStudents.map((s) => [
        s.id,
        [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
      ]),
    );
    const linkedStudentIds = linkedStudents.map((s) => s.id);
    const branchIds = Array.from(new Set(linkedStudents.map((s) => s.branch_id).filter(Boolean)));
    if (linkedStudentIds.length === 0 || branchIds.length === 0) return { data: [] };

    // Payments joined with challans for month/receipt/number
    const { data: rows, error } = await supabase
      .from('fee_payments')
      .select(
        'id, challan_id, student_id, amount_paid, payment_date, status, verified_at, fee_challans:challan_id(challan_number, month, receipt_url)',
      )
      .in('branch_id', branchIds)
      .in('student_id', linkedStudentIds)
      .order('payment_date', { ascending: false });
    throwIfDbError(error);

    return {
      data: ((rows ?? []) as Array<any>).map((r) => {
        const challan = Array.isArray(r.fee_challans) ? r.fee_challans[0] : r.fee_challans;
        return {
          challanNumber: challan?.challan_number ?? '—',
          studentId: r.student_id,
          studentName: nameById.get(r.student_id) ?? '—',
          month: challan?.month ?? '—',
          amountPaid: Number(r.amount_paid),
          paymentDate: r.payment_date,
          status: r.status,
          receiptUrl: challan?.receipt_url ?? null,
          verifiedAt: r.verified_at ?? null,
        };
      }),
    };
  }

  async listHistory(
    input: {
      classId?: string;
      sectionId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    branchId: string,
  ): Promise<{
    data: {
      rows: Array<{
        id: string;
        paymentDate: string;
        studentId: string;
        studentName: string;
        challanNumber: string;
        month: string;
        amountPaid: number;
        status: string;
        receiptUrl: string | null;
        proofDocumentUrl: string | null;
      }>;
      totals: { collected: number; pending: number };
    };
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const limit = Math.min(Math.max(Number(input.limit ?? 100), 1), 500);
    const page = Math.min(Math.max(Number(input.page ?? 1), 1), 10_000);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Filter by student (class/section/search). Search MUST work even without class/section filters.
    let studentIds: string[] | null = null;
    const hasStudentFilter = Boolean(input.classId || input.sectionId || (input.search && input.search.trim()));
    if (hasStudentFilter) {
      let q = supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true);
      if (input.classId) q = q.eq('class_id', input.classId);
      if (input.sectionId) q = q.eq('section_id', input.sectionId);
      if (input.search) {
        const s = input.search.trim();
        if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,student_id.ilike.%${s}%`);
      }
      const { data: sRows, error: sErr } = await q.limit(1000);
      throwIfDbError(sErr);
      studentIds = (sRows ?? []).map((r) => (r as { id: string }).id);
      if (studentIds.length === 0) {
        return {
          data: { rows: [], totals: { collected: 0, pending: 0 } },
          meta: { total: 0, page: 1, limit, totalPages: 1 },
        };
      }
    }

    // Query payments joined with challan details for month/receipt/number
    let payQuery = supabase
      .from('fee_payments')
      .select(
        'id, student_id, amount_paid, payment_date, status, proof_document_url, fee_challans:challan_id(challan_number, month, receipt_url)',
        { count: 'exact' },
      )
      .eq('branch_id', branchId);

    if (studentIds) payQuery = payQuery.in('student_id', studentIds);
    if (input.status && ['Pending_Review', 'Verified', 'Rejected'].includes(input.status)) {
      payQuery = payQuery.eq('status', input.status);
    }
    if (input.startDate) payQuery = payQuery.gte('payment_date', input.startDate.slice(0, 10));
    if (input.endDate) payQuery = payQuery.lte('payment_date', input.endDate.slice(0, 10));

    const { data: rows, error, count } = await payQuery.order('payment_date', { ascending: false }).range(from, to);
    throwIfDbError(error);

    const typedRows = (rows ?? []) as Array<any>;
    const uniqueStudentIds = Array.from(new Set(typedRows.map((r) => r.student_id as string)));
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('branch_id', branchId)
      .in('id', uniqueStudentIds);
    throwIfDbError(stErr);
    const studentNameById = new Map(
      ((students ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((s) => [
        s.id,
        [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
      ]),
    );

    const mapped = typedRows.map((r) => {
      const challan = Array.isArray(r.fee_challans) ? r.fee_challans[0] : r.fee_challans;
      return {
        id: r.id as string,
        paymentDate: r.payment_date as string,
        studentId: r.student_id as string,
        studentName: studentNameById.get(r.student_id as string) ?? '—',
        challanNumber: challan?.challan_number ?? '—',
        month: challan?.month ?? '—',
        amountPaid: Number(r.amount_paid),
        status: r.status as string,
        receiptUrl: challan?.receipt_url ?? null,
        proofDocumentUrl: r.proof_document_url ?? null,
      };
    });

    const collected = mapped.filter((r) => r.status === 'Verified').reduce((s, r) => s + r.amountPaid, 0);
    const pending = mapped.filter((r) => r.status === 'Pending_Review').reduce((s, r) => s + r.amountPaid, 0);

    const total = typeof count === 'number' ? count : mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { data: { rows: mapped, totals: { collected, pending } }, meta: { total, page, limit, totalPages } };
  }

  async exportHistoryExcel(
    input: {
      classId?: string;
      sectionId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    branchId: string,
  ): Promise<Buffer> {
    const supabase = this.supabaseConfig.getClient();

    // Reuse the same student filter logic as listHistory
    let studentIds: string[] | null = null;
    const hasStudentFilter = Boolean(input.classId || input.sectionId || (input.search && input.search.trim()));
    if (hasStudentFilter) {
      let q = supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true);
      if (input.classId) q = q.eq('class_id', input.classId);
      if (input.sectionId) q = q.eq('section_id', input.sectionId);
      if (input.search) {
        const s = input.search.trim();
        if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,student_id.ilike.%${s}%`);
      }
      const { data: sRows, error: sErr } = await q.limit(5000);
      throwIfDbError(sErr);
      studentIds = (sRows ?? []).map((r) => (r as { id: string }).id);
      if (studentIds.length === 0) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'NTG SMS';
        workbook.addWorksheet('Payments');
        return (await workbook.xlsx.writeBuffer()) as Buffer;
      }
    }

    let payQuery = supabase
      .from('fee_payments')
      .select(
        'id, student_id, amount_paid, payment_date, payment_method, status, transaction_reference, bank_name, fee_challans:challan_id(challan_number, month, receipt_url)',
      )
      .eq('branch_id', branchId);
    if (studentIds) payQuery = payQuery.in('student_id', studentIds);
    if (input.status && ['Pending_Review', 'Verified', 'Rejected'].includes(input.status)) {
      payQuery = payQuery.eq('status', input.status);
    }
    if (input.startDate) payQuery = payQuery.gte('payment_date', input.startDate.slice(0, 10));
    if (input.endDate) payQuery = payQuery.lte('payment_date', input.endDate.slice(0, 10));

    // Export cap to avoid huge memory usage
    const EXPORT_MAX = 5000;
    const { data: rows, error } = await payQuery.order('payment_date', { ascending: false }).limit(EXPORT_MAX);
    throwIfDbError(error);
    const typedRows = (rows ?? []) as Array<any>;

    const uniqueStudentIds = Array.from(new Set(typedRows.map((r) => r.student_id as string)));
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name')
      .eq('branch_id', branchId)
      .in('id', uniqueStudentIds);
    throwIfDbError(stErr);
    const studentById = new Map(
      ((students ?? []) as Array<{ id: string; student_id: string; first_name: string | null; last_name: string | null }>).map((s) => [
        s.id,
        s,
      ]),
    );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';
    const ws = workbook.addWorksheet('Payments');
    ws.columns = [
      { header: 'Payment date', key: 'paymentDate', width: 14 },
      { header: 'Student', key: 'studentName', width: 26 },
      { header: 'Student ID', key: 'studentRoll', width: 12 },
      { header: 'Challan', key: 'challanNumber', width: 18 },
      { header: 'Month', key: 'month', width: 10 },
      { header: 'Amount paid', key: 'amountPaid', width: 14 },
      { header: 'Method', key: 'paymentMethod', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Bank', key: 'bankName', width: 16 },
      { header: 'Reference', key: 'reference', width: 18 },
    ];

    typedRows.forEach((r) => {
      const challan = Array.isArray(r.fee_challans) ? r.fee_challans[0] : r.fee_challans;
      const s = studentById.get(r.student_id as string);
      const studentName = [s?.first_name, s?.last_name].filter(Boolean).join(' ') || '—';
      ws.addRow({
        paymentDate: r.payment_date ?? '',
        studentName,
        studentRoll: s?.student_id ?? '',
        challanNumber: challan?.challan_number ?? '—',
        month: challan?.month ?? '—',
        amountPaid: Number(r.amount_paid ?? 0),
        paymentMethod: r.payment_method ?? '',
        status: r.status ?? '',
        bankName: r.bank_name ?? '',
        reference: r.transaction_reference ?? '',
      });
    });

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }
}

