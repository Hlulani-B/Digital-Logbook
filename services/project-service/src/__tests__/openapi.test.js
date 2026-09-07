import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { join } from 'path';

// __dirname is provided by Babel ESM→CJS transform
const SPEC_PATH = join(__dirname, '..', '..', 'docs', 'openapi.yaml');

describe('OpenAPI 3 specification', () => {
  let spec;

  beforeAll(() => {
    const raw = readFileSync(SPEC_PATH, 'utf8');
    spec = yaml.load(raw, { schema: yaml.DEFAULT_SCHEMA });
  });

  it('parses as valid YAML', () => {
    expect(spec).toBeDefined();
    expect(typeof spec).toBe('object');
  });

  it('uses OpenAPI 3.0.x', () => {
    expect(spec.openapi).toMatch(/^3\.0\./);
  });

  it('has required info fields', () => {
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
  });

  it('defines at least one server', () => {
    expect(Array.isArray(spec.servers)).toBe(true);
    expect(spec.servers.length).toBeGreaterThan(0);
    spec.servers.forEach((s) => {
      expect(s.url).toBeTruthy();
    });
  });

  it('defines BearerAuth security scheme', () => {
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
  });

  it('has reusable schemas', () => {
    const schemas = Object.keys(spec.components.schemas);
    expect(schemas).toContain('RpcRequest');
    expect(schemas).toContain('ErrorResponse');
    expect(schemas).toContain('DataResponse');
    expect(schemas).toContain('HealthResponse');
    expect(schemas).toContain('Project');
    expect(schemas).toContain('Entry');
    expect(schemas).toContain('UserProfile');
  });

  // ── Paths must match every implemented route ──────────────

  const EXPECTED_PATHS = [
    '/', // project-service health
    '/service/project', // project CRUD
    '/service/entry', // entry CRUD
    '/service/nl-stream', // SSE stream
    '/service/natural-language-entry', // NL parsing
    '/service/priority', // priority
    '/service/field', // custom fields
    '/service/archive', // archive/unarchive
    '/service/activity', // activity log
    '/service/ai', // AI prompt
    '/service/search', // dashboard search
    '/service/health-ping', // dashboard health
    '/service/login', // profile login
    '/service/profile', // profile CRUD
    '/health', // auth health
  ];

  it('defines all expected paths', () => {
    const definedPaths = Object.keys(spec.paths);
    EXPECTED_PATHS.forEach((p) => {
      expect(definedPaths).toContain(p);
    });
  });

  it('has no path that the code does not implement', () => {
    const definedPaths = Object.keys(spec.paths);
    definedPaths.forEach((p) => {
      expect(EXPECTED_PATHS).toContain(p);
    });
  });

  it('every path has at least one operation with a response', () => {
    Object.entries(spec.paths).forEach(([path, methods]) => {
      const httpMethods = Object.keys(methods).filter((k) =>
        ['get', 'post', 'put', 'delete', 'patch'].includes(k)
      );
      expect(httpMethods.length).toBeGreaterThan(0);
      httpMethods.forEach((method) => {
        const op = methods[method];
        expect(op.responses).toBeDefined();
        expect(Object.keys(op.responses).length).toBeGreaterThan(0);
      });
    });
  });

  it('every POST operation has a requestBody', () => {
    Object.entries(spec.paths).forEach(([path, methods]) => {
      if (methods.post) {
        expect(methods.post.requestBody).toBeDefined();
      }
    });
  });

  it('every operation has a summary', () => {
    Object.entries(spec.paths).forEach(([path, methods]) => {
      ['get', 'post', 'put', 'delete', 'patch'].forEach((method) => {
        if (methods[method]) {
          expect(methods[method].summary).toBeTruthy();
        }
      });
    });
  });

  it('documents 401 responses for JWT-protected routes', () => {
    const protectedPaths = [
      '/service/project',
      '/service/entry',
      '/service/nl-stream',
      '/service/natural-language-entry',
      '/service/priority',
      '/service/field',
      '/service/archive',
      '/service/activity',
      '/service/ai',
    ];
    protectedPaths.forEach((path) => {
      const op = spec.paths[path];
      const method = op.post || op.get;
      expect(method.responses['401']).toBeDefined();
    });
  });
});
