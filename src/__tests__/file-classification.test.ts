import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  adjustFragmentationForClassification,
  adjustCohesionForClassification,
  getClassificationRecommendations,
} from '../analyzer';
import type { DependencyNode, FileClassification } from '../types';

describe('file classification', () => {
  const createNode = (overrides: Partial<DependencyNode>): DependencyNode => ({
    file: 'test.ts',
    imports: [],
    exports: [],
    tokenCost: 100,
    linesOfCode: 50,
    ...overrides,
  });

  describe('classifyFile', () => {
    it('should classify barrel export files correctly', () => {
      const node = createNode({
        file: 'src/index.ts',
        imports: ['../module1', '../module2', '../module3'],
        exports: [
          { name: 'func1', type: 'function', inferredDomain: 'module1' },
          { name: 'func2', type: 'function', inferredDomain: 'module2' },
          { name: 'func3', type: 'function', inferredDomain: 'module3' },
        ],
        linesOfCode: 20, // Sparse code
      });

      const classification = classifyFile(node, 0.5, ['module1', 'module2', 'module3']);
      expect(classification).toBe('barrel-export');
    });

    it('should classify type definition files correctly', () => {
      const node = createNode({
        file: 'src/types.ts',
        exports: [
          { name: 'User', type: 'interface', inferredDomain: 'user' },
          { name: 'Order', type: 'interface', inferredDomain: 'order' },
          { name: 'Product', type: 'type', inferredDomain: 'product' },
          { name: 'Status', type: 'type', inferredDomain: 'unknown' },
        ],
        linesOfCode: 100,
      });

      const classification = classifyFile(node, 0.5, ['user', 'order', 'product']);
      expect(classification).toBe('type-definition');
    });

    it('should classify files in /types/ directory as type-definition', () => {
      const node = createNode({
        file: 'shared/src/types/audit/parser.ts',
        exports: [
          { name: 'AuditParserConfig', type: 'interface', inferredDomain: 'audit' },
          { name: 'ParseResult', type: 'type', inferredDomain: 'parse' },
        ],
        linesOfCode: 50,
      });

      const classification = classifyFile(node, 0.5, ['audit', 'parse']);
      expect(classification).toBe('type-definition');
    });

    it('should classify files in nested /types/ subdirectories as type-definition', () => {
      const node = createNode({
        file: 'shared/src/types/audit/status.ts',
        exports: [
          { name: 'AuditStatus', type: 'type', inferredDomain: 'audit' },
          { name: 'StatusMapping', type: 'interface', inferredDomain: 'status' },
        ],
        linesOfCode: 30,
      });

      const classification = classifyFile(node, 0.5, ['audit', 'status']);
      expect(classification).toBe('type-definition');
    });

    it('should classify pure type files (only type/interface exports) as type-definition', () => {
      const node = createNode({
        file: 'src/models/user-models.ts', // NOT in /types/ but only type exports
        exports: [
          { name: 'UserCreateInput', type: 'interface', inferredDomain: 'user' },
          { name: 'UserUpdateInput', type: 'interface', inferredDomain: 'user' },
          { name: 'UserFilter', type: 'type', inferredDomain: 'user' },
        ],
        linesOfCode: 80,
      });

      const classification = classifyFile(node, 0.5, ['user']);
      expect(classification).toBe('type-definition');
    });

    it('should classify cohesive module files correctly', () => {
      const node = createNode({
        file: 'src/calculator.ts',
        exports: [
          { name: 'calculate', type: 'function', inferredDomain: 'calc' },
          { name: 'format', type: 'function', inferredDomain: 'calc' },
          { name: 'validate', type: 'function', inferredDomain: 'calc' },
        ],
        imports: ['../utils'],
        linesOfCode: 300,
      });

      const classification = classifyFile(node, 0.8, ['calc']);
      expect(classification).toBe('cohesive-module');
    });

    it('should classify mixed concerns files correctly', () => {
      const node = createNode({
        file: 'src/audit.ts',
        exports: [
          { name: 'auditStatus', type: 'function', inferredDomain: 'audit' },
          { name: 'createJob', type: 'function', inferredDomain: 'job' },
          { name: 'LineItem', type: 'interface', inferredDomain: 'order' },
          { name: 'SupportingDoc', type: 'type', inferredDomain: 'doc' },
        ],
        imports: ['../auth', '../job', '../order'],
        linesOfCode: 384,
      });

      const classification = classifyFile(node, 0.3, ['audit', 'job', 'order', 'doc']);
      expect(classification).toBe('mixed-concerns');
    });

    it('should classify files with multiple domains and very low cohesion as mixed-concerns', () => {
      const node = createNode({
        file: 'src/modules/mixed-module.ts', // NOT a utility/config/service path
        exports: [
          { name: 'DateCalculator', type: 'class', inferredDomain: 'date' }, // Use class to avoid utility detection
          { name: 'ReportBuilder', type: 'class', inferredDomain: 'report' },
          { name: 'AuditLogger', type: 'class', inferredDomain: 'audit' },
        ],
        imports: [],
        linesOfCode: 150,
      });

      // Multiple domains + very low cohesion (< 0.4) = mixed concerns
      // Note: NOT in /utils/ or /helpers/ or /services/ path
      const classification = classifyFile(node, 0.3, ['date', 'report', 'audit']);
      expect(classification).toBe('mixed-concerns');
    });

    it('should classify single domain files as cohesive-module regardless of cohesion', () => {
      const node = createNode({
        file: 'src/component.ts',
        exports: [
          { name: 'Component', type: 'function', inferredDomain: 'ui' },
        ],
        imports: ['react'],
        linesOfCode: 100,
      });

      // Single domain = cohesive module (even with medium cohesion)
      const classification = classifyFile(node, 0.6, ['ui']);
      expect(classification).toBe('cohesive-module');
    });

    it('should classify utility files as cohesive-module by design', () => {
      const node = createNode({
        file: 'src/utils/helpers.ts',
        exports: [
          { name: 'formatDate', type: 'function', inferredDomain: 'date' },
          { name: 'stringifyJSON', type: 'function', inferredDomain: 'json' },
          { name: 'validateEmail', type: 'function', inferredDomain: 'email' },
        ],
        imports: [],
        linesOfCode: 150,
      });

      // Utility files are classified as cohesive by design
      const classification = classifyFile(node, 0.4, ['date', 'json', 'email']);
      expect(classification).toBe('utility-module');
    });

    it('should classify config/schema files as cohesive-module', () => {
      const node = createNode({
        file: 'src/db-schema.ts',
        exports: [
          { name: 'userTable', type: 'const', inferredDomain: 'db' },
          { name: 'userSchema', type: 'const', inferredDomain: 'schema' },
        ],
        imports: ['../db'],
        linesOfCode: 81,
      });

      // Config/schema files are classified as cohesive
      const classification = classifyFile(node, 0.4, ['db', 'schema']);
      expect(classification).toBe('cohesive-module');
    });
  });

  describe('adjustFragmentationForClassification', () => {
    it('should return 0 fragmentation for barrel exports', () => {
      const result = adjustFragmentationForClassification(0.8, 'barrel-export');
      expect(result).toBe(0);
    });

    it('should return 0 fragmentation for type definitions', () => {
      const result = adjustFragmentationForClassification(0.9, 'type-definition');
      expect(result).toBe(0);
    });

    it('should reduce fragmentation by 70% for cohesive modules', () => {
      const result = adjustFragmentationForClassification(0.6, 'cohesive-module');
      expect(result).toBeCloseTo(0.18, 2); // 0.6 * 0.3
    });

    it('should keep full fragmentation for mixed concerns', () => {
      const result = adjustFragmentationForClassification(0.7, 'mixed-concerns');
      expect(result).toBe(0.7);
    });

    it('should reduce fragmentation by 30% for unknown classification', () => {
      const result = adjustFragmentationForClassification(0.5, 'unknown');
      expect(result).toBeCloseTo(0.35, 2); // 0.5 * 0.7
    });
  });

  describe('getClassificationRecommendations', () => {
    it('should provide barrel export recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'barrel-export',
        'src/index.ts',
        ['High fragmentation']
      );
      expect(recommendations).toContain('Barrel export file detected - multiple domains are expected here');
    });

    it('should provide type definition recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'type-definition',
        'src/types.ts',
        ['High fragmentation']
      );
      expect(recommendations).toContain('Type definition file - centralized types improve consistency');
    });

    it('should provide cohesive module recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'cohesive-module',
        'src/calculator.ts',
        []
      );
      expect(recommendations).toContain('Module has good cohesion despite its size');
    });

    it('should provide mixed concerns recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'mixed-concerns',
        'src/audit.ts',
        ['Multiple domains detected']
      );
      expect(recommendations).toContain('Consider splitting this file by domain');
    });
  });

  describe('integration: barrel export detection edge cases', () => {
    it('should detect barrel export even for non-index files with re-export patterns', () => {
      const node = createNode({
        file: 'src/exports.ts',
        imports: ['../module1', '../module2', '../module3', '../module4', '../module5'],
        exports: [
          { name: 'a', type: 'function' },
          { name: 'b', type: 'function' },
          { name: 'c', type: 'function' },
          { name: 'd', type: 'function' },
          { name: 'e', type: 'function' },
        ],
        linesOfCode: 25, // Very sparse - mostly re-exports
      });

      const classification = classifyFile(node, 0.5, ['module1', 'module2']);
      expect(classification).toBe('barrel-export');
    });

    it('should not misclassify large component files as barrel exports', () => {
      const node = createNode({
        file: 'src/components/Calculator.tsx', // NOT an index file
        imports: ['react', '../hooks', '../utils'],
        exports: [
          { name: 'Calculator', type: 'function' },
        ],
        linesOfCode: 346, // Substantial code
      });

      // Single domain, high cohesion
      const classification = classifyFile(node, 0.9, ['calculator']);
      expect(classification).toBe('cohesive-module');
    });
  });

  describe('new classification patterns', () => {
    describe('lambda-handler detection', () => {
      it('should classify files in handlers directory as lambda-handler', () => {
        const node = createNode({
          file: 'src/handlers/tier1-immediate.ts',
          exports: [
            { name: 'handler', type: 'function', inferredDomain: 'match' },
          ],
          imports: ['../services/matcher', '../services/db'],
          linesOfCode: 150,
        });

        const classification = classifyFile(node, 0.21, ['match', 'db']);
        expect(classification).toBe('lambda-handler');
      });

      it('should classify files with handler export as lambda-handler', () => {
        const node = createNode({
          file: 'src/api/process.ts',
          exports: [
            { name: 'processHandler', type: 'function', inferredDomain: 'process' },
          ],
          imports: ['../services/queue'],
          linesOfCode: 80,
        });

        const classification = classifyFile(node, 0.3, ['process']);
        expect(classification).toBe('lambda-handler');
      });

      it('should classify files in lambdas directory as lambda-handler', () => {
        const node = createNode({
          file: 'src/lambdas/match-single-document.ts',
          exports: [
            { name: 'handler', type: 'function', inferredDomain: 'match' },
          ],
          imports: ['../services/matcher'],
          linesOfCode: 100,
        });

        const classification = classifyFile(node, 0.22, ['match']);
        expect(classification).toBe('lambda-handler');
      });

      it('should classify single export functions as lambda-handler', () => {
        const node = createNode({
          file: 'src/functions/process.ts',
          exports: [
            { name: 'default', type: 'default', inferredDomain: 'process' },
          ],
          imports: ['../services/processor'],
          linesOfCode: 60,
        });

        const classification = classifyFile(node, 0.4, ['process']);
        expect(classification).toBe('lambda-handler');
      });
    });

    describe('service-file detection', () => {
      it('should classify files with -service.ts pattern as service-file', () => {
        const node = createNode({
          file: 'src/services/email-service.ts',
          exports: [
            { name: 'EmailService', type: 'class', inferredDomain: 'email' },
          ],
          imports: ['../utils/smtp', '../templates'],
          linesOfCode: 200,
        });

        const classification = classifyFile(node, 0.07, ['email', 'smtp', 'templates']);
        expect(classification).toBe('service-file');
      });

      it('should classify files in services directory as service-file', () => {
        const node = createNode({
          file: 'src/services/notification.ts',
          exports: [
            { name: 'sendNotification', type: 'function', inferredDomain: 'notification' },
            { name: 'queueNotification', type: 'function', inferredDomain: 'notification' },
          ],
          imports: ['../db', '../email'],
          linesOfCode: 120,
        });

        const classification = classifyFile(node, 0.35, ['notification']);
        expect(classification).toBe('service-file');
      });

      it('should classify class exports in services directory as service-file', () => {
        const node = createNode({
          file: 'src/api/user-service.ts',
          exports: [
            { name: 'UserService', type: 'class', inferredDomain: 'user' },
          ],
          imports: ['../db', '../auth'],
          linesOfCode: 180,
        });

        const classification = classifyFile(node, 0.25, ['user']);
        expect(classification).toBe('service-file');
      });
    });

    describe('email-template detection', () => {
      it('should classify receipt-writer files as email-template', () => {
        const node = createNode({
          file: 'src/emails/receipt-writer.ts',
          exports: [
            { name: 'generateReceipt', type: 'function', inferredDomain: 'receipt' },
          ],
          imports: ['../templates/base', '../services/db'],
          linesOfCode: 150,
        });

        const classification = classifyFile(node, 0.08, ['receipt', 'templates', 'db']);
        expect(classification).toBe('email-template');
      });

      it('should classify files in emails directory as email-template', () => {
        const node = createNode({
          file: 'src/emails/welcome.ts',
          exports: [
            { name: 'renderWelcomeEmail', type: 'function', inferredDomain: 'email' },
          ],
          imports: ['../templates/layout'],
          linesOfCode: 80,
        });

        const classification = classifyFile(node, 0.15, ['email']);
        expect(classification).toBe('email-template');
      });

      it('should classify files with template patterns as email-template', () => {
        const node = createNode({
          file: 'src/templates/invoice-template.ts',
          exports: [
            { name: 'renderInvoice', type: 'function', inferredDomain: 'invoice' },
          ],
          imports: ['../services/pdf'],
          linesOfCode: 100,
        });

        const classification = classifyFile(node, 0.20, ['invoice']);
        expect(classification).toBe('email-template');
      });
    });

    describe('parser-file detection', () => {
      it('should classify parser files correctly', () => {
        const node = createNode({
          file: 'src/parsers/base-parser-deterministic.ts',
          exports: [
            { name: 'parseDeterministic', type: 'function', inferredDomain: 'parse' },
            { name: 'parseNonDeterministic', type: 'function', inferredDomain: 'parse' },
          ],
          imports: ['../utils/transform'],
          linesOfCode: 120,
        });

        const classification = classifyFile(node, 0.15, ['parse']);
        expect(classification).toBe('parser-file');
      });

      it('should classify files with parser in name as parser-file', () => {
        const node = createNode({
          file: 'src/parsers/data-parser.ts',
          exports: [
            { name: 'parseData', type: 'function', inferredDomain: 'data' },
            { name: 'transformData', type: 'function', inferredDomain: 'data' },
          ],
          imports: [],
          linesOfCode: 90,
        });

        const classification = classifyFile(node, 0.25, ['data']);
        expect(classification).toBe('parser-file');
      });

      it('should classify converter files as parser-file', () => {
        const node = createNode({
          file: 'src/converters/xml-converter.ts',
          exports: [
            { name: 'convertXmlToJson', type: 'function', inferredDomain: 'xml' },
            { name: 'convertJsonToXml', type: 'function', inferredDomain: 'xml' },
          ],
          imports: ['xml2js'],
          linesOfCode: 60,
        });

        const classification = classifyFile(node, 0.30, ['xml']);
        expect(classification).toBe('parser-file');
      });
    });

    describe('utility-module detection', () => {
      it('should classify dynamodb-utils.ts as utility-module', () => {
        const node = createNode({
          file: 'src/utils/dynamodb-utils.ts',
          exports: [
            { name: 'getItem', type: 'function', inferredDomain: 'db' },
            { name: 'putItem', type: 'function', inferredDomain: 'db' },
            { name: 'queryItems', type: 'function', inferredDomain: 'db' },
          ],
          imports: ['aws-sdk'],
          linesOfCode: 100,
        });

        const classification = classifyFile(node, 0.21, ['db']);
        expect(classification).toBe('utility-module');
      });

      it('should classify s3-utils.ts as utility-module', () => {
        const node = createNode({
          file: 'src/utils/s3-utils.ts',
          exports: [
            { name: 'uploadFile', type: 'function', inferredDomain: 's3' },
            { name: 'downloadFile', type: 'function', inferredDomain: 's3' },
            { name: 'deleteFile', type: 'function', inferredDomain: 's3' },
          ],
          imports: ['aws-sdk'],
          linesOfCode: 80,
        });

        const classification = classifyFile(node, 0.26, ['s3']);
        expect(classification).toBe('utility-module');
      });

      it('should classify files ending with -utils.ts as utility-module', () => {
        const node = createNode({
          file: 'src/helpers/date-utils.ts',
          exports: [
            { name: 'formatDate', type: 'function', inferredDomain: 'date' },
            { name: 'validateDate', type: 'function', inferredDomain: 'date' },
          ],
          imports: [],
          linesOfCode: 50,
        });

        const classification = classifyFile(node, 0.30, ['date']);
        expect(classification).toBe('utility-module');
      });
    });

    describe('session file detection', () => {
      it('should classify session.ts as cohesive-module', () => {
        const node = createNode({
          file: 'src/session.ts',
          exports: [
            { name: 'createSession', type: 'function', inferredDomain: 'session' },
            { name: 'getSession', type: 'function', inferredDomain: 'session' },
            { name: 'destroySession', type: 'function', inferredDomain: 'session' },
          ],
          imports: ['../db', '../auth'],
          linesOfCode: 100,
        });

        const classification = classifyFile(node, 0.26, ['session']);
        expect(classification).toBe('cohesive-module');
      });
    });
  });

  describe('adjustCohesionForClassification', () => {
    it('should return 1 for barrel exports', () => {
      const result = adjustCohesionForClassification(0.3, 'barrel-export');
      expect(result).toBe(1);
    });

    it('should return 1 for type definitions', () => {
      const result = adjustCohesionForClassification(0.2, 'type-definition');
      expect(result).toBe(1);
    });

    it('should boost cohesion for utility modules', () => {
      const result = adjustCohesionForClassification(0.21, 'utility-module');
      expect(result).toBeGreaterThan(0.21);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should boost cohesion for service files', () => {
      const result = adjustCohesionForClassification(0.07, 'service-file');
      expect(result).toBeGreaterThan(0.07);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should boost cohesion for lambda handlers', () => {
      const result = adjustCohesionForClassification(0.21, 'lambda-handler');
      expect(result).toBeGreaterThan(0.21);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should boost cohesion for email templates', () => {
      const result = adjustCohesionForClassification(0.08, 'email-template');
      expect(result).toBeGreaterThan(0.08);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should boost cohesion for parser files', () => {
      const result = adjustCohesionForClassification(0.15, 'parser-file');
      expect(result).toBeGreaterThan(0.15);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should keep original cohesion for mixed-concerns', () => {
      const result = adjustCohesionForClassification(0.3, 'mixed-concerns');
      expect(result).toBe(0.3);
    });

    it('should boost cohesion for utility module with related export names', () => {
      const node = createNode({
        file: 'src/utils/dynamodb-utils.ts',
        exports: [
          { name: 'getItem', type: 'function', inferredDomain: 'db' },
          { name: 'putItem', type: 'function', inferredDomain: 'db' },
          { name: 'deleteItem', type: 'function', inferredDomain: 'db' },
        ],
        imports: ['aws-sdk'],
        linesOfCode: 100,
      });

      // Related names (all Item operations) should get higher boost
      const result = adjustCohesionForClassification(0.21, 'utility-module', node);
      expect(result).toBeGreaterThan(0.5); // Significant boost for related names
    });

    it('should boost cohesion for lambda handler with single entry point', () => {
      const node = createNode({
        file: 'src/handlers/process.ts',
        exports: [
          { name: 'handler', type: 'function', inferredDomain: 'process' },
        ],
        imports: ['../services/queue'],
        linesOfCode: 80,
      });

      // Single entry point should get higher boost
      const result = adjustCohesionForClassification(0.22, 'lambda-handler', node);
      expect(result).toBeGreaterThan(0.5); // Significant boost for single entry
    });

    it('should boost cohesion for class-based service files', () => {
      const node = createNode({
        file: 'src/services/email-service.ts',
        exports: [
          { name: 'EmailService', type: 'class', inferredDomain: 'email' },
        ],
        imports: ['../utils/smtp'],
        linesOfCode: 200,
      });

      // Class-based service should get higher boost
      const result = adjustCohesionForClassification(0.15, 'service-file', node);
      expect(result).toBeGreaterThan(0.45); // Significant boost for class-based
    });
  });

  describe('new classification recommendations', () => {
    it('should provide utility-module recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'utility-module',
        'src/utils/helpers.ts',
        ['Low cohesion']
      );
      expect(recommendations).toContain('Utility module detected - multiple domains are acceptable here');
    });

    it('should provide service-file recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'service-file',
        'src/services/email.ts',
        ['Multiple domains']
      );
      expect(recommendations).toContain('Service file detected - orchestration of multiple dependencies is expected');
    });

    it('should provide lambda-handler recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'lambda-handler',
        'src/handlers/process.ts',
        ['Low cohesion']
      );
      expect(recommendations).toContain('Lambda handler detected - coordination of services is expected');
    });

    it('should provide email-template recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'email-template',
        'src/emails/receipt.ts',
        ['Multiple domains']
      );
      expect(recommendations).toContain('Email template detected - references multiple domains for rendering');
    });

    it('should provide parser-file recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'parser-file',
        'src/parsers/data.ts',
        ['Multiple domains']
      );
      expect(recommendations).toContain('Parser/transformer file detected - handles multiple data sources');
    });
  });

  describe('Next.js page detection', () => {
    it('should classify Next.js calculator pages as nextjs-page', () => {
      const node = createNode({
        file: 'app/cents-per-km-calculator/page.tsx',
        exports: [
          { name: 'metadata', type: 'const', inferredDomain: 'seo' },
          { name: 'faqJsonLd', type: 'const', inferredDomain: 'jsonld' },
          { name: 'default', type: 'default', inferredDomain: 'page' },
          { name: 'icon', type: 'const', inferredDomain: 'ui' },
        ],
        imports: ['../components/Calculator', '../lib/utils'],
        linesOfCode: 208,
      });

      const classification = classifyFile(node, 0.25, ['seo', 'jsonld', 'page', 'ui']);
      expect(classification).toBe('nextjs-page');
    });

    it('should classify investment property calculator page as nextjs-page', () => {
      const node = createNode({
        file: 'app/investment-property-tax-calculator/page.tsx',
        exports: [
          { name: 'metadata', type: 'const', inferredDomain: 'seo' },
          { name: 'faqJsonLd', type: 'const', inferredDomain: 'jsonld' },
          { name: 'default', type: 'default', inferredDomain: 'page' },
        ],
        imports: ['../components/Form'],
        linesOfCode: 204,
      });

      const classification = classifyFile(node, 0.30, ['seo', 'jsonld', 'page']);
      expect(classification).toBe('nextjs-page');
    });

    it('should not classify non-page.tsx files in /app/ as nextjs-page', () => {
      const node = createNode({
        file: 'app/components/Header.tsx',
        exports: [
          { name: 'Header', type: 'function', inferredDomain: 'ui' },
        ],
        imports: ['react'],
        linesOfCode: 50,
      });

      const classification = classifyFile(node, 0.8, ['ui']);
      expect(classification).toBe('cohesive-module');
    });

    it('should not classify page.tsx files outside /app/ as nextjs-page', () => {
      const node = createNode({
        file: 'src/pages/page.tsx', // Pages Router, not App Router
        exports: [
          { name: 'default', type: 'default', inferredDomain: 'page' },
        ],
        imports: ['react'],
        linesOfCode: 100,
      });

      const classification = classifyFile(node, 0.5, ['page']);
      expect(classification).not.toBe('nextjs-page');
    });

    it('should classify Next.js page with generateMetadata as nextjs-page', () => {
      const node = createNode({
        file: 'app/dynamic-page/page.tsx',
        exports: [
          { name: 'generateMetadata', type: 'function', inferredDomain: 'seo' },
          { name: 'default', type: 'default', inferredDomain: 'page' },
        ],
        imports: ['../lib/api'],
        linesOfCode: 150,
      });

      const classification = classifyFile(node, 0.4, ['seo', 'page']);
      expect(classification).toBe('nextjs-page');
    });
  });

  describe('nextjs-page cohesion adjustment', () => {
    it('should return 1 for nextjs-page', () => {
      const result = adjustCohesionForClassification(0.25, 'nextjs-page');
      expect(result).toBe(1);
    });
  });

  describe('nextjs-page fragmentation adjustment', () => {
    it('should reduce fragmentation by 80% for nextjs-page', () => {
      const result = adjustFragmentationForClassification(0.5, 'nextjs-page');
      expect(result).toBe(0.1); // 0.5 * 0.2
    });
  });

  describe('nextjs-page recommendations', () => {
    it('should provide nextjs-page recommendations', () => {
      const recommendations = getClassificationRecommendations(
        'nextjs-page',
        'app/calculator/page.tsx',
        ['Low cohesion']
      );
      expect(recommendations).toContain('Next.js App Router page detected - metadata/JSON-LD/component pattern is cohesive');
    });
  });
});
