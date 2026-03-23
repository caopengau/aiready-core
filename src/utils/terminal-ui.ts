import chalk from 'chalk';

/**
 * Print a stylized terminal header for a tool
 */
export function printTerminalHeader(
  title: string,
  colorFn: any = chalk.cyan.bold,
  width: number = 80
): void {
  const divider = '━'.repeat(width);
  console.log(colorFn(`\n${divider}`));
  console.log(colorFn(`  ${title.toUpperCase()}`));
  console.log(colorFn(`${divider}\n`));
}

/**
 * Get a terminal divider line
 */
export function getTerminalDivider(
  colorFn: any = chalk.gray,
  width: number = 80
): string {
  return colorFn('━'.repeat(width));
}

/**
 * Get a visual score bar (emoji/block based)
 */
export function getScoreBar(score: number, width: number = 10): string {
  const normalized = Math.max(0, Math.min(100, score));
  const solid = Math.round((normalized / 100) * width);
  const empty = width - solid;
  return '█'.repeat(solid) + '░'.repeat(empty);
}
