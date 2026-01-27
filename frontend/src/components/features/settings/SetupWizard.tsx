'use client';

import { useState } from 'react';
import { Button, Group, Modal, Stepper, Stack, Text } from '@mantine/core';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { AcademicYearStep } from './wizard-steps/AcademicYearStep';
import { AcademicStep } from './wizard-steps/AcademicStep';
import { ScheduleStep } from './wizard-steps/ScheduleStep';
import { AssessmentStep } from './wizard-steps/AssessmentStep';
import { CommunicationStep } from './wizard-steps/CommunicationStep';
import { BehaviorStep } from './wizard-steps/BehaviorStep';
import { PermissionsStep } from './wizard-steps/PermissionsStep';
import { SetupReviewForm } from './SetupReviewForm';
import type { SetupWizardData } from './wizard-steps/types';
import { useSaveSetupWizard } from '@/hooks/useSetupWizard';

interface SetupWizardProps {
  opened: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TOTAL_STEPS = 7;

export function SetupWizard({ opened, onClose, onComplete }: SetupWizardProps) {
  const colors = useThemeColors();
  const saveWizard = useSaveSetupWizard();
  const [activeStep, setActiveStep] = useState(0);
  const [wizardData, setWizardData] = useState<SetupWizardData>({
    academicYear: null,
    academic: {
      subjects: [],
      classes: [],
      sections: [],
      levels: [],
      levelClasses: [],
    },
    schedule: {
      schoolDays: [],
      timingTemplates: [],
      classTimingAssignments: [],
    },
    assessment: {
      assessmentTypes: [],
      gradeTemplates: [],
      gradeRanges: [],
      classGradeAssignments: [],
      leaveQuota: null,
    },
    communication: null,
    behavior: null,
    permissions: [],
  });

  const handleStepDataChange = (step: number, data: Partial<SetupWizardData>) => {
    setWizardData((prev) => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    if (activeStep < TOTAL_STEPS) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleStepClick = (step: number) => {
    // Allow going back to previous steps
    if (step <= activeStep) {
      setActiveStep(step);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setWizardData({
      academicYear: null,
      academic: {
        subjects: [],
        classes: [],
        sections: [],
        levels: [],
        levelClasses: [],
      },
      schedule: {
        schoolDays: [],
        timingTemplates: [],
        classTimingAssignments: [],
      },
      assessment: {
        assessmentTypes: [],
        gradeTemplates: [],
        gradeRanges: [],
        classGradeAssignments: [],
        leaveQuota: null,
      },
      communication: null,
      behavior: null,
      permissions: [],
    });
    onClose();
  };

  const handleComplete = async () => {
    try {
      await saveWizard.mutateAsync(wizardData);
      onComplete();
      handleClose();
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <AcademicYearStep
            data={wizardData.academicYear}
            onChange={(data) => handleStepDataChange(0, { academicYear: data })}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <AcademicStep
            data={wizardData.academic}
            onChange={(data) => handleStepDataChange(1, { academic: data })}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <ScheduleStep
            data={wizardData.schedule}
            onChange={(data) => handleStepDataChange(2, { schedule: data })}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <AssessmentStep
            data={wizardData.assessment}
            onChange={(data) => handleStepDataChange(3, { assessment: data })}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <CommunicationStep
            data={wizardData.communication}
            onChange={(data) => handleStepDataChange(4, { communication: data })}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <BehaviorStep
            data={wizardData.behavior}
            onChange={(data) => handleStepDataChange(5, { behavior: data })}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <PermissionsStep
            data={wizardData.permissions}
            onChange={(data) => handleStepDataChange(6, { permissions: data })}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 7:
        return (
          <SetupReviewForm
            data={wizardData}
            onBack={handleBack}
            onConfirm={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="School Setup Wizard"
      size="xl"
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="lg">
        <Stepper
          active={activeStep}
          onStepClick={handleStepClick}
          color={colors.primary}
        >
          <Stepper.Step label="Academic Year" description="Activate academic year">
            <Text size="sm" c="dimmed" mt="md">
              Step 1 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Step label="Academic" description="Subjects, classes, sections">
            <Text size="sm" c="dimmed" mt="md">
              Step 2 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Step label="Schedule" description="School days, timing">
            <Text size="sm" c="dimmed" mt="md">
              Step 3 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Step label="Assessment" description="Types, grades, quota">
            <Text size="sm" c="dimmed" mt="md">
              Step 4 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Step label="Communication" description="Messaging directions">
            <Text size="sm" c="dimmed" mt="md">
              Step 5 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Step label="Behavior" description="Assessment settings">
            <Text size="sm" c="dimmed" mt="md">
              Step 6 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Step label="Permissions" description="Role permissions">
            <Text size="sm" c="dimmed" mt="md">
              Step 7 of {TOTAL_STEPS + 1}
            </Text>
          </Stepper.Step>
          <Stepper.Completed>
            <Text size="sm" c="dimmed" mt="md">
              Review and confirm
            </Text>
          </Stepper.Completed>
        </Stepper>

        <div style={{ minHeight: '400px' }}>{renderStep()}</div>
      </Stack>
    </Modal>
  );
}

