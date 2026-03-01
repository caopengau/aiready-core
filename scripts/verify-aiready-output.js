 
import fs from 'fs';
import path from 'path';

// Define globals for ESLint flat config compatibility if needed,
// but usually we just want to tell it it's a node script
const reportPath = path.resolve(
  process.cwd(),
  process.argv[2] || 'aiready.json'
);

if (!fs.existsSync(reportPath)) {
  console.error(`❌ Verification failed: Report not found at ${reportPath}`);
  process.exit(1);
}

try {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  // Critical fields in the actual CLI report structure
  if (!report.scoring || typeof report.scoring.overall !== 'number') {
    console.error(
      '❌ Verification failed: Missing or invalid "scoring.overall"'
    );
    console.dir(report.scoring, { depth: 1 });
    process.exit(1);
  }

  const score = report.scoring.overall;
  if (score < 0 || score > 100) {
    console.error(`❌ Verification failed: Invalid score value (${score})`);
    process.exit(1);
  }

  // Check for presence of tool results (at least one)
  const toolFields = [
    'consistency',
    'patternDetect',
    'contextAnalyzer',
    'deps',
  ];
  const hasTools = toolFields.some((field) => report[field] !== undefined);

  if (!hasTools) {
    console.error('❌ Verification failed: No tool results found in report');
    console.dir(report, { depth: 1 });
    process.exit(1);
  }

  console.log('✅ CLI output verification successful');
} catch (error) {
  console.error(
    `❌ Verification failed: Error parsing report: ${error.message}`
  );
  process.exit(1);
}
