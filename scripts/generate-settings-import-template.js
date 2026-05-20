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
      name: 'academic_years',
      columns: ['name', 'start_date', 'end_date', 'set_active'],
      sample: {
        name: '2026-2027',
        start_date: '2026-09-01',
        end_date: '2027-06-30',
        set_active: 'true',
      },
    },
    {
      name: 'subjects',
      columns: ['name_en', 'name_ar', 'code'],
      sample: { name_en: 'Mathematics', name_ar: 'رياضيات', code: 'MATH' },
    },
    {
      name: 'classes',
      columns: ['name', 'display_name', 'sort_order'],
      sample: { name: 'Grade 1', display_name: 'Grade 1', sort_order: '1' },
    },
    {
      name: 'sections',
      columns: ['name', 'sort_order'],
      sample: { name: 'A', sort_order: '1' },
    },
    {
      name: 'levels',
      columns: ['name', 'class_names'],
      sample: { name: 'Primary', class_names: 'Grade 1,Grade 2,Grade 3' },
    },
    {
      name: 'assessment_types',
      columns: ['name_en', 'name_ar', 'sort_order'],
      sample: { name_en: 'Quiz', name_ar: 'اختبار قصير', sort_order: '1' },
    },
    {
      name: 'leave_quota',
      columns: ['annual_quota'],
      sample: { annual_quota: '10' },
    },
    {
      name: 'library_categories',
      columns: ['category'],
      sample: { category: 'General Knowledge' },
    },
    {
      name: 'inventory_categories',
      columns: ['category'],
      sample: { category: 'Uniforms' },
    },
    {
      name: 'behavioral_attributes',
      columns: ['attribute_name'],
      samples: [
        { attribute_name: 'Discipline' },
        { attribute_name: 'Respect & Courtesy' },
        { attribute_name: 'Class Engagement' },
        { attribute_name: 'Work Habits' },
        { attribute_name: 'Extracurriculars' },
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

  const outPath = path.join(process.cwd(), definition.workbookName);
  XLSX.writeFile(workbook, outPath);
  console.log(`Generated template at: ${outPath}`);
}

main();

