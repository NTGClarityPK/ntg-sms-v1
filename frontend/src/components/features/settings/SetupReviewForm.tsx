'use client';

import { Button, Checkbox, Collapse, Group, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { SetupWizardData } from './wizard-steps/types';

interface SetupReviewFormProps {
  data: SetupWizardData;
  onBack: () => void;
  onConfirm: () => void;
  isSaving?: boolean;
}

export function SetupReviewForm({ data, onBack, onConfirm, isSaving }: SetupReviewFormProps) {
  const colors = useThemeColors();
  const [consentChecked, setConsentChecked] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    academicYear: true,
    academic: true,
    schedule: true,
    assessment: true,
    communication: true,
    behavior: true,
    permissions: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <Stack gap="lg">
      <Title order={3}>Review Settings</Title>
      <Text size="sm" c="dimmed">
        Please review all the settings you've configured. You can go back to edit any section.
      </Text>

      <Stack gap="md">
        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('academicYear')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.academicYear ? '▼' : '▶'} Academic Year
            </Text>
          </Button>
          <Collapse in={expandedSections.academicYear}>
            {data.academicYear ? (
              <Stack gap="xs" pl="md" mt="xs">
                <Text size="sm">Name: {data.academicYear.name}</Text>
                <Text size="sm">Start: {data.academicYear.startDate}</Text>
                <Text size="sm">End: {data.academicYear.endDate}</Text>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" pl="md" mt="xs">
                Not configured
              </Text>
            )}
          </Collapse>
        </div>

        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('academic')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.academic ? '▼' : '▶'} Academic Structure
            </Text>
          </Button>
          <Collapse in={expandedSections.academic}>
            <Stack gap="md" pl="md" mt="xs">
              <div>
                <Text size="sm" fw={500} mb="xs">Subjects ({data.academic.subjects.length}):</Text>
                {data.academic.subjects.length > 0 ? (
                  <Stack gap="xs" pl="md">
                    {data.academic.subjects.map((subject, idx) => (
                      <Text key={idx} size="sm" c="dimmed">
                        {subject.name} {subject.nameAr && `(${subject.nameAr})`} {subject.code && `[${subject.code}]`}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No subjects added</Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Classes ({data.academic.classes.length}):</Text>
                {data.academic.classes.length > 0 ? (
                  <Stack gap="xs" pl="md">
                    {data.academic.classes.map((cls, idx) => (
                      <Text key={idx} size="sm" c="dimmed">
                        {cls.displayName} ({cls.name})
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No classes added</Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Sections ({data.academic.sections.length}):</Text>
                {data.academic.sections.length > 0 ? (
                  <Stack gap="xs" pl="md">
                    {data.academic.sections.map((section, idx) => (
                      <Text key={idx} size="sm" c="dimmed">
                        {section.name}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No sections added</Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Levels ({data.academic.levels.length}):</Text>
                {data.academic.levels.length > 0 ? (
                  <Stack gap="xs" pl="md">
                    {data.academic.levels.map((level, idx) => (
                      <Text key={idx} size="sm" c="dimmed">
                        {level.name} {level.nameAr && `(${level.nameAr})`} - {level.classIds.length} classes
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No levels added</Text>
                )}
              </div>
            </Stack>
          </Collapse>
        </div>

        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('schedule')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.schedule ? '▼' : '▶'} Schedule
            </Text>
          </Button>
          <Collapse in={expandedSections.schedule}>
            <Stack gap="md" pl="md" mt="xs">
              <div>
                <Text size="sm" fw={500} mb="xs">School Days ({data.schedule.schoolDays.filter(d => d.isActive).length} active):</Text>
                <Stack gap="xs" pl="md">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
                    const dayData = data.schedule.schoolDays.find(d => d.dayOfWeek === idx);
                    return (
                      <Text key={idx} size="sm" c={dayData?.isActive ? undefined : 'dimmed'}>
                        {day}: {dayData?.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    );
                  })}
                </Stack>
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Timing Templates ({data.schedule.timingTemplates.length}):</Text>
                {data.schedule.timingTemplates.length > 0 ? (
                  <Stack gap="xs" pl="md">
                    {data.schedule.timingTemplates.map((template, idx) => (
                      <Text key={idx} size="sm" c="dimmed">
                        {template.name}: {template.startTime} - {template.endTime} ({template.slots.length} periods)
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No timing templates added</Text>
                )}
              </div>
            </Stack>
          </Collapse>
        </div>

        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('assessment')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.assessment ? '▼' : '▶'} Assessment
            </Text>
          </Button>
          <Collapse in={expandedSections.assessment}>
            <Stack gap="md" pl="md" mt="xs">
              <div>
                <Text size="sm" fw={500} mb="xs">Assessment Types ({data.assessment.assessmentTypes.length}):</Text>
                {data.assessment.assessmentTypes.length > 0 ? (
                  <Stack gap="xs" pl="md">
                    {data.assessment.assessmentTypes.map((type, idx) => (
                      <Text key={idx} size="sm" c="dimmed">
                        {type.name} {type.nameAr && `(${type.nameAr})`}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No assessment types added</Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Grade Templates ({data.assessment.gradeTemplates.length}):</Text>
                {data.assessment.gradeTemplates.length > 0 ? (
                  <Stack gap="md" pl="md">
                    {data.assessment.gradeTemplates.map((template, idx) => (
                      <div key={idx}>
                        <Text size="sm" fw={500} c="dimmed">
                          {template.name} ({template.ranges.length} ranges):
                        </Text>
                        {template.ranges.length > 0 ? (
                          <Stack gap="xs" pl="md">
                            {template.ranges.map((range, rangeIdx) => (
                              <Text key={rangeIdx} size="sm" c="dimmed">
                                {range.letter}: {range.minPercentage}% - {range.maxPercentage}%
                              </Text>
                            ))}
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed" pl="md">No ranges added</Text>
                        )}
                      </div>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed" pl="md">No grade templates added</Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Leave Quota:</Text>
                <Text size="sm" c="dimmed" pl="md">
                  {data.assessment.leaveQuota ? `${data.assessment.leaveQuota} days per academic year` : 'Not set'}
                </Text>
              </div>
            </Stack>
          </Collapse>
        </div>

        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('communication')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.communication ? '▼' : '▶'} Communication
            </Text>
          </Button>
          <Collapse in={expandedSections.communication}>
            {data.communication ? (
              <Stack gap="xs" pl="md" mt="xs">
                <Text size="sm">
                  Teacher can send to student: {data.communication.teacherStudent === 'teacher_only' || data.communication.teacherStudent === 'both' ? 'Yes' : 'No'}
                </Text>
                <Text size="sm">
                  Teacher can send to parent: {data.communication.teacherParent === 'teacher_only' || data.communication.teacherParent === 'both' ? 'Yes' : 'No'}
                </Text>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" pl="md" mt="xs">
                Not configured
              </Text>
            )}
          </Collapse>
        </div>

        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('behavior')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.behavior ? '▼' : '▶'} Behavior
            </Text>
          </Button>
          <Collapse in={expandedSections.behavior}>
            {data.behavior ? (
              <Stack gap="md" pl="md" mt="xs">
                <Text size="sm">Enabled: {data.behavior.enabled ? 'Yes' : 'No'}</Text>
                <Text size="sm">Mandatory: {data.behavior.mandatory ? 'Yes' : 'No'}</Text>
                <div>
                  <Text size="sm" fw={500} mb="xs">Attributes ({data.behavior.attributes.length}):</Text>
                  {data.behavior.attributes.length > 0 ? (
                    <Stack gap="xs" pl="md">
                      {data.behavior.attributes.map((attr, idx) => (
                        <Text key={idx} size="sm" c="dimmed">
                          {attr}
                        </Text>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed" pl="md">No attributes added</Text>
                  )}
                </div>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed" pl="md" mt="xs">
                Not configured
              </Text>
            )}
          </Collapse>
        </div>

        <div>
          <Button
            variant="subtle"
            onClick={() => toggleSection('permissions')}
            style={{ padding: 0, height: 'auto' }}
          >
            <Text fw={600} size="sm">
              {expandedSections.permissions ? '▼' : '▶'} Permissions
            </Text>
          </Button>
          <Collapse in={expandedSections.permissions}>
            <Text size="sm" pl="md" mt="xs">
              {data.permissions.length} permission rules configured
            </Text>
          </Collapse>
        </div>
      </Stack>

      <Stack gap="md" mt="xl">
        <Checkbox
          label="I have reviewed all settings above and confirm they are correct. I understand that these settings will be saved and can be modified later."
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.currentTarget.checked)}
        />
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Go Back
        </Button>
        <Button
          onClick={onConfirm}
          color={colors.primary}
          disabled={!consentChecked || isSaving}
          loading={isSaving}
        >
          Confirm & Save
        </Button>
      </Group>
    </Stack>
  );
}

