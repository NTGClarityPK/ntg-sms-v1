/* eslint-disable no-console */
const path = require('path');

function getXlsx() {
  try {
    // Prefer repo root node_modules (if present)
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require('xlsx');
  } catch {
    // Fallback to frontend node_modules (project uses xlsx in frontend)
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(process.cwd(), 'frontend', 'node_modules', 'xlsx'));
  }
}

const XLSX = getXlsx();

const definition = {
  workbookName: 'settings-onboarding-template.xlsx',
  sheets: [
    {
      name: 'subjects',
      columns: ['name', 'code', 'lang_code'],
      samples: [
        { name: 'Mathematics', code: 'MATH', lang_code: 'EN' },
        { name: 'رياضيات', code: 'MATH', lang_code: 'AR' },
        { name: 'English', code: 'ENG', lang_code: 'EN' },
      ],
    },
    {
      name: 'classes',
      columns: ['name', 'display_name', 'sort_order', 'section_names'],
      samples: [
        { name: 'Grade 1', display_name: 'Grade 1', sort_order: '1', section_names: 'A,B' },
        { name: 'Grade 2', display_name: 'Grade 2', sort_order: '2', section_names: 'A,B' },
      ],
    },
    {
      name: 'levels',
      columns: ['name', 'class_names'],
      sample: { name: 'Primary', class_names: 'Grade 1,Grade 2' },
    },
    {
      name: 'assessment_types',
      columns: ['name', 'code', 'lang_code', 'sort_order', 'is_term_examination'],
      samples: [
        { name: 'Mid Term', code: 'MID', lang_code: 'EN', sort_order: '1', is_term_examination: 'yes' },
        { name: 'Final', code: 'FINAL', lang_code: 'EN', sort_order: '2', is_term_examination: 'yes' },
        { name: 'Quiz', code: 'QUIZ', lang_code: 'EN', sort_order: '3', is_term_examination: 'no' },
      ],
    },
    {
      name: 'subject_templates',
      columns: ['name', 'description', 'subject_names', 'assign_mode', 'assign_names'],
      sample: {
        name: 'Primary Core',
        description: 'Core subjects for primary classes',
        subject_names: 'MATH,ENG',
        assign_mode: 'classes',
        assign_names: 'Grade 1,Grade 2',
      },
    },
    {
      name: 'school_days',
      columns: ['day', 'active'],
      samples: [
        { day: 'Sunday', active: 'N' },
        { day: 'Monday', active: 'Y' },
        { day: 'Tuesday', active: 'Y' },
        { day: 'Wednesday', active: 'Y' },
        { day: 'Thursday', active: 'Y' },
        { day: 'Friday', active: 'Y' },
        { day: 'Saturday', active: 'N' },
      ],
    },
    {
      name: 'timing_templates',
      columns: ['name', 'start_time', 'end_time', 'period_duration_minutes', 'assigned_class_names'],
      sample: {
        name: 'Primary Day',
        start_time: '07:30',
        end_time: '14:00',
        period_duration_minutes: '40',
        assigned_class_names: 'Grade 1,Grade 2',
      },
    },
    {
      name: 'timing_slots',
      columns: ['template_name', 'slot_name', 'start_time', 'end_time', 'sort_order'],
      samples: [
        {
          template_name: 'Primary Day',
          slot_name: 'Break',
          start_time: '10:00',
          end_time: '10:20',
          sort_order: '1',
        },
        {
          template_name: 'Primary Day',
          slot_name: 'Lunch',
          start_time: '12:00',
          end_time: '12:40',
          sort_order: '2',
        },
      ],
    },
    {
      name: 'grade_templates',
      columns: ['name', 'assigned_class_names', 'minimum_passing_grade'],
      sample: {
        name: 'Primary Grades',
        assigned_class_names: 'Grade 1,Grade 2',
        minimum_passing_grade: 'D',
      },
    },
    {
      name: 'grade_ranges',
      columns: ['template_name', 'letter', 'min_percentage', 'max_percentage', 'sort_order'],
      samples: [
        {
          template_name: 'Primary Grades',
          letter: 'A',
          min_percentage: '80',
          max_percentage: '100',
          sort_order: '1',
        },
        {
          template_name: 'Primary Grades',
          letter: 'B',
          min_percentage: '65',
          max_percentage: '79',
          sort_order: '2',
        },
        {
          template_name: 'Primary Grades',
          letter: 'C',
          min_percentage: '50',
          max_percentage: '64',
          sort_order: '3',
        },
        {
          template_name: 'Primary Grades',
          letter: 'D',
          min_percentage: '40',
          max_percentage: '49',
          sort_order: '4',
        },
        {
          template_name: 'Primary Grades',
          letter: 'F',
          min_percentage: '0',
          max_percentage: '39',
          sort_order: '5',
        },
      ],
    },
  ],
};

function main() {
  const workbook = XLSX.utils.book_new();

  definition.sheets.forEach((sheet) => {
    const header = [
      sheet.columns.reduce((acc, col) => {
        acc[col] = col;
        return acc;
      }, {}),
    ];
    const dataRows =
      Array.isArray(sheet.samples) && sheet.samples.length > 0 ? sheet.samples : [sheet.sample];
    const rows = header.concat(dataRows);
    const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  const outPath = path.join(process.cwd(), 'scripts', 'templates', definition.workbookName);
  XLSX.writeFile(workbook, outPath);
  console.log(`Generated template at: ${outPath}`);
}

main();
