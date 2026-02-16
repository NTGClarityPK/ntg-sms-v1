'use client';

import { useMemo } from 'react';
import { SimpleGrid, Text, Paper, Group } from '@mantine/core';
import type { ClassSection } from '@/types/class-sections';
import { ClassSectionCard } from './ClassSectionCard';
import { useClasses } from '@/hooks/useCoreLookups';
import { useSections } from '@/hooks/useCoreLookups';
import { useAcademicYears } from '@/hooks/useAcademicYears';

interface ClassSectionGridProps {
  classSections: ClassSection[];
}

export function ClassSectionGrid({ classSections }: ClassSectionGridProps) {
  const { data: classesData } = useClasses();
  const { data: sectionsData } = useSections();
  const { data: academicYearsData } = useAcademicYears();

  const activeYear = academicYearsData?.data?.find((y) => y.isActive);
  const classesRaw = classesData?.data || [];
  const sectionsRaw = sectionsData?.data || [];

  // Sort by Settings sort order so grid matches class/section order from Settings
  const classes = useMemo(
    () => [...classesRaw].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name)),
    [classesRaw],
  );
  const sections = useMemo(
    () => [...sectionsRaw].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name)),
    [sectionsRaw],
  );

  // Create a map of class-section combinations
  const classSectionMap = useMemo(() => {
    const map = new Map<string, ClassSection>();
    classSections.forEach((cs) => {
      const key = `${cs.classId}-${cs.sectionId}`;
      map.set(key, cs);
    });
    return map;
  }, [classSections]);

  // Generate all possible combinations
  const combinations = useMemo(() => {
    const combos: Array<{ classId: string; sectionId: string; classSection?: ClassSection }> = [];
    classes.forEach((cls) => {
      sections.forEach((sec) => {
        const key = `${cls.id}-${sec.id}`;
        const existing = classSectionMap.get(key);
        combos.push({
          classId: cls.id,
          sectionId: sec.id,
          classSection: existing,
        });
      });
    });
    return combos;
  }, [classes, sections, classSectionMap]);

  if (classes.length === 0 || sections.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed" ta="center">
          Please create classes and sections first before creating class-sections.
        </Text>
      </Paper>
    );
  }

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {combinations.map((combo) => {
          const classData = classes.find((c) => c.id === combo.classId);
          const sectionData = sections.find((s) => s.id === combo.sectionId);

          if (!classData || !sectionData) return null;

          if (combo.classSection) {
            return (
              <ClassSectionCard
                key={`${combo.classId}-${combo.sectionId}`}
                classSection={combo.classSection}
                className={classData.displayName || classData.name}
                sectionName={sectionData.name}
              />
            );
          }

          return (
            <Paper key={`${combo.classId}-${combo.sectionId}`} p="md" withBorder>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={600}>
                    {classData.displayName || classData.name} - {sectionData.name}
                  </Text>
                  <Text c="dimmed" size="sm">
                    Not created
                  </Text>
                </div>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>
    </>
  );
}

