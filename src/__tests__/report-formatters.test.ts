import { describe, it, expect } from 'vitest';
import {
  generateReportHead,
  generateReportHero,
  generateStatCards,
  generateTable,
  generateIssueSummary,
  generateReportFooter,
  wrapInCard,
  generateCompleteReport,
  generateStandardHtmlReport,
} from '../utils/report-formatters.js';

describe('report-formatters', () => {
  const options = {
    title: 'Test Report',
    packageName: 'core',
    packageUrl: 'https://github.com/aiready/aiready',
    bugUrl: 'https://github.com/aiready/aiready/issues',
    version: '1.0.0',
    emoji: '🚀',
  };

  it('should generate report head with styles', () => {
    const head = generateReportHead('Test Title', 'body { color: red; }');
    expect(head).toContain('<!DOCTYPE html>');
    expect(head).toContain('<title>Test Title</title>');
    expect(head).toContain('body { color: red; }');
  });

  it('should generate report hero', () => {
    const hero = generateReportHero('Main Title', 'Sub Title');
    expect(hero).toContain('<h1>Main Title</h1>');
    expect(hero).toContain('<p>Sub Title</p>');
    expect(hero).toContain('class="hero"');
  });

  it('should generate stat cards with colors', () => {
    const cards = [
      { value: 100, label: 'Score', color: 'green' },
      { value: 50, label: 'Issues' },
    ];
    const html = generateStatCards(cards);
    expect(html).toContain('color: green');
    expect(html).toContain('100');
    expect(html).toContain('Score');
    expect(html).toContain('50');
    expect(html).toContain('Issues');
  });

  it('should generate a table', () => {
    const config = {
      headers: ['Name', 'Age'],
      rows: [
        ['Alice', '30'],
        ['Bob', '25'],
      ],
    };
    const html = generateTable(config);
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Alice</td>');
    expect(html).toContain('<td>25</td>');
  });

  it('should generate issue summary with savings', () => {
    const html = generateIssueSummary(1, 2, 3, 1000);
    expect(html).toContain('Critical: 1');
    expect(html).toContain('Major: 2');
    expect(html).toContain('Minor: 3');
    expect(html).toContain('Potential Savings: 1,000 tokens');
  });

  it('should generate report footer with links', () => {
    const html = generateReportFooter(options);
    expect(html).toContain('@aiready/core');
    expect(html).toContain('v1.0.0');
    expect(html).toContain('https://github.com/aiready/aiready');
    expect(html).toContain('Report it here');
  });

  it('should wrap content in a card', () => {
    const html = wrapInCard('some content', 'Card Title');
    expect(html).toContain('<h2>Card Title</h2>');
    expect(html).toContain('some content');
    expect(html).toContain('class="card"');
  });

  it('should generate a complete report', () => {
    const html = generateCompleteReport(options, '<div>Body Content</div>');
    expect(html).toContain('<body><div>Body Content</div>');
    expect(html).toContain('footer');
  });

  it('should generate standard HTML report with score', () => {
    const stats = [{ value: 'High', label: 'Priority' }];
    const sections = [{ title: 'Section 1', content: 'Content 1' }];
    const score = { value: 85, label: 'AI Readiness Score' };

    const html = generateStandardHtmlReport(options, stats, sections, score);
    expect(html).toContain('85');
    expect(html).toContain('AI Readiness Score');
    expect(html).toContain('Section 1');
    expect(html).toContain('Content 1');
  });
});
