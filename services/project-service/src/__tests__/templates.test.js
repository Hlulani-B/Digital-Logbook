import express from 'express';
import { request } from 'node:http';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import router from '../Routes/templates.js';
import {
  BUILT_IN_TEMPLATES,
  TemplateError,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../functions/templates.js';
import { normalizeFields } from '../domain/fieldSchema.js';

jest.mock('../db.js', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('../middleware/auth.js', () => ({ requireAuth: jest.fn() }));

const email = 'owner@example.test';
const otherEmail = 'other@example.test';
const id = '00000000-0000-4000-8000-000000000001';
const parentId = '00000000-0000-4000-8000-000000000002';
const fields = [{ field_name: 'Notes', data_type: 'text' }];
const input = { name: 'My template', description: 'Description', fields };
const row = (extra = {}) => ({
  id,
  user_email: email,
  scope: 'personal',
  name: input.name,
  description: input.description,
  fields,
  version: 1,
  is_fork: false,
  forked_from: null,
  deleted: false,
  created_at: '2026-09-21T00:00:00.000Z',
  updated_at: '2026-09-21T00:00:00.000Z',
  ...extra,
});
const sqlText = (sql) => sql.replace(/\s+/g, ' ').trim();
const lastQuery = () => {
  const [sql, parameters] = pool.query.mock.calls.at(-1);
  return [sqlText(sql), parameters];
};
const expectMutationPredicate = (sql) => {
  expect(sql).toContain(
    "WHERE id = $1 AND deleted = false AND ((scope = 'personal' AND user_email = $2) OR (scope = 'global' AND $3::boolean = true))"
  );
};
const expectReadPredicate = (sql, emailParameter) => {
  expect(sql).toContain("deleted = false AND scope IN ('personal', 'global')");
  expect(sql).toContain(`AND (user_email = ${emailParameter} OR scope = 'global')`);
};

beforeEach(() => {
  pool.query.mockReset();
  requireAuth.mockReset();
  requireAuth.mockImplementation((req, res, next) => {
    req.user = { email };
    next();
  });
});

describe('built-in independence and immutability', () => {
  test('lists and reads known built-ins without any database query', async () => {
    pool.query.mockRejectedValue(new Error('database offline'));
    const templates = await listTemplates(email, { scope: 'built_in' });
    expect(templates.map((template) => template.id)).toEqual(
      BUILT_IN_TEMPLATES.map((template) => template.id)
    );
    for (const template of templates) {
      expect(await getTemplate(email, template.id)).toMatchObject({
        id: template.id,
        scope: 'built_in',
        is_fork: false,
        version: 1,
      });
      expect(template).toMatchObject({ scope: 'built_in', is_fork: false, version: 1 });
      for (const field of template.fields) {
        expect(typeof field.default_value).not.toBe('function');
      }
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('returned nested fields cannot alter the built-in catalog', async () => {
    const template = await getTemplate(email, 'tpl-lab-notebook');
    template.fields[0].rules.minLength = 999;
    template.fields[0].options.push({ id: 'injected' });
    const fresh = await getTemplate(email, template.id);
    expect(fresh.fields[0].rules).toEqual({});
    expect(fresh.fields[0].options).toEqual([]);
  });

  test.each(BUILT_IN_TEMPLATES.map((template) => template.id))(
    '%s cannot be updated or deleted even by an admin',
    async (templateId) => {
      await expect(
        updateTemplate(email, templateId, input, { isAdmin: true })
      ).rejects.toMatchObject({ status: 403 });
      await expect(deleteTemplate(email, templateId, { isAdmin: true })).rejects.toMatchObject({
        status: 403,
      });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test('a missing pool does not break built-ins but fails every saved operation', async () => {
    const dbModule = require('../db.js');
    const originalPool = pool;
    dbModule.default = null;
    try {
      await expect(listTemplates(email, { scope: 'built_in' })).resolves.toHaveLength(4);
      await expect(getTemplate(email, 'tpl-lab-notebook')).resolves.toMatchObject({
        scope: 'built_in',
      });
      for (const operation of [
        () => listTemplates(email),
        () => getTemplate(email, id),
        () => createTemplate(email, input),
        () => updateTemplate(email, id, input),
        () => deleteTemplate(email, id),
      ]) {
        await expect(operation()).rejects.toMatchObject({ status: 503 });
      }
      expect(originalPool.query).not.toHaveBeenCalled();
    } finally {
      dbModule.default = originalPool;
    }
  });
});

describe('saved template scopes', () => {
  const fixtures = [
    row(),
    row({ user_email: otherEmail }),
    row({ scope: 'global' }),
    row({ scope: 'global', user_email: otherEmail }),
    row({ scope: 'built_in' }),
    row({ scope: 'built_in', user_email: null }),
    row({ scope: 'unexpected' }),
    row({ deleted: true }),
    row({ scope: 'global', deleted: true }),
  ];

  test.each(['all', 'personal', 'global'])('%s lists only allowed saved scopes', async (scope) => {
    const expected = fixtures.filter(
      (template) =>
        !template.deleted &&
        ['personal', 'global'].includes(template.scope) &&
        (template.user_email === email || template.scope === 'global') &&
        (scope === 'all' || template.scope === scope)
    );
    pool.query.mockImplementation(async (sql, parameters) => {
      expectReadPredicate(sqlText(sql), '$1');
      expect(sqlText(sql)).toContain("AND ($2 = 'all' OR scope = $2) ORDER BY created_at DESC");
      expect(parameters).toEqual([email, scope]);
      return { rows: expected };
    });
    const templates = await listTemplates(email, { scope });
    expect(templates.filter((template) => template.scope !== 'built_in')).toEqual(
      expected.map(({ user_email, deleted, ...template }) => ({
        ...template,
        fields: normalizeFields(template.fields),
      }))
    );
    expect(templates.filter((template) => template.scope === 'built_in')).toHaveLength(
      scope === 'all' ? BUILT_IN_TEMPLATES.length : 0
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test.each(fixtures.map((template) => [template.scope, template.user_email, template.deleted]))(
    'read scope=%s owner=%s deleted=%s is filtered by SQL',
    async (scope, owner, deleted) => {
      const readable =
        !deleted && (scope === 'global' || (scope === 'personal' && owner === email));
      pool.query.mockResolvedValue({ rows: readable ? [row({ scope, user_email: owner })] : [] });
      const template = await getTemplate(email, id);
      expect(Boolean(template)).toBe(readable);
      const [sql, parameters] = lastQuery();
      expect(sql).toContain('WHERE id = $1');
      expectReadPredicate(sql, '$2');
      expect(parameters).toEqual([id, email]);
      expect(pool.query).toHaveBeenCalledTimes(1);
    }
  );

  test('default list scope is all and a valid empty result is not a failure', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(listTemplates(email)).resolves.toHaveLength(BUILT_IN_TEMPLATES.length);
    expect(lastQuery()[1]).toEqual([email, 'all']);
    await expect(listTemplates(email, { scope: 'personal' })).resolves.toEqual([]);
    await expect(listTemplates(email, { scope: 'global' })).resolves.toEqual([]);
    await expect(getTemplate(email, id)).resolves.toBeNull();
  });

  test('owner emails are query parameters, never SQL interpolation', async () => {
    const untrusted = "x' OR true --@example.test";
    pool.query.mockResolvedValue({ rows: [] });
    await listTemplates(untrusted, { scope: 'personal' });
    expect(lastQuery()[0]).not.toContain(untrusted);
    expect(lastQuery()[1]).toEqual([untrusted, 'personal']);
    await getTemplate(untrusted, id);
    expect(lastQuery()[0]).not.toContain(untrusted);
    expect(lastQuery()[1]).toEqual([id, untrusted]);
  });
});

describe('creation and forks', () => {
  test.each(['personal', 'global'])(
    '%s creation retains creator and normalizes fields',
    async (scope) => {
      pool.query.mockResolvedValue({ rows: [row({ scope })] });
      const template = await createTemplate(email, { ...input, scope }, { isAdmin: true });
      const [sql, parameters] = lastQuery();
      expect(sql).toContain('INSERT INTO schema_templates');
      expect(sql).toContain(
        '(user_email, scope, name, description, fields, version, is_fork, forked_from)'
      );
      expect(sql).toContain('SELECT $1::text, $2, $3, $4, $5::jsonb, 1, $6, $7::text');
      expect(sql).toContain('RETURNING *');
      expect(sql).not.toContain('FROM schema_templates AS source');
      expect(parameters).toEqual([
        email,
        scope,
        input.name,
        input.description,
        JSON.stringify(normalizeFields(fields)),
        false,
        null,
      ]);
      expect(template).toMatchObject({ scope, fields: normalizeFields(fields), version: 1 });
      expect(pool.query).toHaveBeenCalledTimes(1);
    }
  );

  test.each([undefined, false, 'true', 1, null])(
    'untrusted/nonboolean admin %j cannot create global',
    async (isAdmin) => {
      await expect(
        createTemplate(
          email,
          {
            ...input,
            scope: 'global',
            isAdmin: true,
            is_admin: true,
            app_metadata: { is_admin: true },
          },
          isAdmin === undefined ? undefined : { isAdmin }
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test('personal creation defaults scope and parameterizes all user data', async () => {
    const name = "Robert'); DROP TABLE schema_templates; --";
    pool.query.mockResolvedValue({ rows: [row({ name })] });
    await createTemplate(email, {
      name: `  ${name}  `,
      fields,
      description: "  don't interpolate  ",
    });
    const [sql, parameters] = lastQuery();
    expect(sql).not.toContain(name);
    expect(sql).not.toContain("don't interpolate");
    expect(parameters.slice(0, 4)).toEqual([email, 'personal', name, "don't interpolate"]);
  });

  test.each(BUILT_IN_TEMPLATES.map((template) => template.id))(
    'known parent %s can be forked',
    async (parent) => {
      pool.query.mockResolvedValue({ rows: [row({ is_fork: true, forked_from: parent })] });
      await expect(createTemplate(email, { ...input, forked_from: parent })).resolves.toMatchObject(
        {
          is_fork: true,
          forked_from: parent,
        }
      );
      const [sql, parameters] = lastQuery();
      expect(sql).not.toContain('FROM schema_templates AS source');
      expect(parameters.slice(5)).toEqual([true, parent]);
      expect(pool.query).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    ['personal', email, false, true],
    ['personal', otherEmail, false, false],
    ['global', otherEmail, false, true],
    ['personal', email, true, false],
    ['global', email, true, false],
    ['built_in', email, false, false],
    ['unexpected', email, false, false],
    ['missing', null, false, false],
  ])('fork scope=%s owner=%s deleted=%s readable=%s', async (scope, owner, deleted, readable) => {
    pool.query.mockImplementation(async (sql, parameters) => {
      const text = sqlText(sql);
      expect(text).toContain('INSERT INTO schema_templates');
      expect(text).toContain(
        'FROM schema_templates AS source WHERE source.id = $7::uuid AND source.deleted = false'
      );
      expect(text).toContain("AND source.scope IN ('personal', 'global')");
      expect(text).toContain("AND (source.user_email = $1 OR source.scope = 'global')");
      expect(parameters[0]).toBe(email);
      expect(parameters.slice(5)).toEqual([true, parentId]);
      return { rows: readable ? [row({ is_fork: true, forked_from: parentId })] : [] };
    });
    const result = createTemplate(email, { ...input, forked_from: parentId }, { isAdmin: true });
    if (readable) await expect(result).resolves.toMatchObject({ forked_from: parentId });
    else await expect(result).rejects.toMatchObject({ status: 404 });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('an insert without a returned row cannot report successful creation', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(createTemplate(email, input)).rejects.toMatchObject({ status: 503 });
  });
});

describe('atomic mutations', () => {
  const cases = [
    ['personal', email, false, false, true],
    ['personal', otherEmail, false, false, false],
    ['personal', otherEmail, false, true, false],
    ['global', email, false, false, false],
    ['global', otherEmail, false, true, true],
    ['global', email, false, 'true', false],
    ['built_in', email, false, true, false],
    ['built_in', null, false, true, false],
    ['unexpected', email, false, true, false],
    ['personal', email, true, true, false],
    ['global', email, true, true, false],
    ['missing', email, false, true, false],
  ];
  describe.each(['update', 'delete'])('%s', (operation) => {
    test.each(cases)(
      'scope=%s owner=%s deleted=%s admin=%s allowed=%s',
      async (scope, owner, deleted, isAdmin, allowed) => {
        pool.query.mockResolvedValue({ rows: allowed ? [row({ scope, user_email: owner })] : [] });
        const result =
          operation === 'update'
            ? await updateTemplate(email, id, input, { isAdmin })
            : await deleteTemplate(email, id, { isAdmin });
        expect(Boolean(result)).toBe(allowed);
        const [sql, parameters] = lastQuery();
        expect(sql).toMatch(/^UPDATE schema_templates SET /);
        expectMutationPredicate(sql);
        expect(parameters.slice(0, 3)).toEqual([id, email, isAdmin === true]);
        expect(pool.query).toHaveBeenCalledTimes(1);
        if (operation === 'delete') {
          expect(sql).toContain('deleted = true, deleted_at = now(), updated_at = now()');
          expect(sql).toContain('RETURNING id');
          expect(sql).not.toMatch(/DELETE FROM|version\s*=/);
        }
      }
    );
  });

  test('field updates increment the database version, not a fetched version', async () => {
    pool.query.mockResolvedValueOnce({ rows: [row({ version: 8 })] });
    pool.query.mockResolvedValueOnce({ rows: [row({ version: 9 })] });
    const results = await Promise.all([
      updateTemplate(email, id, { fields }),
      updateTemplate(email, id, { fields }),
    ]);
    expect(results.map((template) => template.version)).toEqual([8, 9]);
    expect(pool.query).toHaveBeenCalledTimes(2);
    for (const [sql, parameters] of pool.query.mock.calls) {
      expect(sqlText(sql)).toContain('fields = $4::jsonb, version = version + 1');
      expectMutationPredicate(sqlText(sql));
      expect(parameters).toEqual([id, email, false, JSON.stringify(normalizeFields(fields))]);
      expect(sql).not.toContain('SELECT');
    }
  });

  test('metadata changes do not increment version or change protected columns', async () => {
    pool.query.mockResolvedValue({ rows: [row()] });
    await updateTemplate(email, id, {
      name: "  It's safe  ",
      description: null,
      scope: 'global',
      user_email: otherEmail,
      version: 999,
      deleted: true,
      forked_from: parentId,
      isAdmin: true,
    });
    const [sql, parameters] = lastQuery();
    const setClause = sql.split(' WHERE ')[0];
    expect(setClause).toBe(
      'UPDATE schema_templates SET updated_at = now(), name = $4, description = $5'
    );
    expect(parameters).toEqual([id, email, false, "It's safe", null]);
    expect(sql).not.toContain("It's safe");
    expectMutationPredicate(sql);
  });

  test('deletion defaults to non-admin and reports no match, not success', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await expect(deleteTemplate(email, id)).resolves.toBe(false);
    expect(lastQuery()[1]).toEqual([id, email, false]);
  });
});

describe('validation before SQL', () => {
  test.each(['', 'unknown', null, ['personal'], { scope: 'all' }])(
    'rejects list scope %j',
    async (scope) => {
      await expect(listTemplates(email, { scope })).rejects.toMatchObject({ status: 400 });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test.each(['built_in', 'all', '', null, 1])('rejects creation scope %j', async (scope) => {
    await expect(
      createTemplate(email, { ...input, scope }, { isAdmin: true })
    ).rejects.toMatchObject({ status: 400 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    '',
    'tpl-unknown',
    "' OR true --",
    null,
    12,
    {},
    '00000000-0000-4000-8000-00000000000Z',
  ])('rejects ID %j for every saved operation', async (invalidId) => {
    for (const operation of [
      () => getTemplate(email, invalidId),
      () => updateTemplate(email, invalidId, input),
      () => deleteTemplate(email, invalidId),
    ])
      await expect(operation()).rejects.toMatchObject({ status: 400 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each(['', 'tpl-unknown', "' OR true --", false, {}, [], 1])(
    'rejects fork source %j before insertion',
    async (parent) => {
      await expect(createTemplate(email, { ...input, forked_from: parent })).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test.each([null, undefined, '', '   ', 12, {}, 'x'.repeat(256), 'bad\0name'])(
    'rejects invalid name %#',
    async (name) => {
      await expect(createTemplate(email, { ...input, name })).rejects.toMatchObject({
        status: 400,
      });
      if (name !== undefined) {
        await expect(updateTemplate(email, id, { name })).rejects.toMatchObject({ status: 400 });
      }
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test.each([12, false, {}, [], 'x'.repeat(2001), 'bad\0description'])(
    'rejects invalid description %#',
    async (description) => {
      await expect(createTemplate(email, { ...input, description })).rejects.toMatchObject({
        status: 400,
      });
      await expect(updateTemplate(email, id, { description })).rejects.toMatchObject({
        status: 400,
      });
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test.each([
    undefined,
    null,
    {},
    'fields',
    [null],
    [{ field_name: 'Name', data_type: 'invalid' }],
    [fields[0], fields[0]],
    [{ field_name: '' }],
    [{ field_name: 'Name', data_type: 'select', options: [null] }],
    [{ field_name: 'Name', rules: { minLength: -1 } }],
    Array.from({ length: 201 }, (_, index) => ({ field_name: `field${index}` })),
  ])('rejects invalid field schema %#', async (invalidFields) => {
    await expect(createTemplate(email, { ...input, fields: invalidFields })).rejects.toMatchObject({
      status: 400,
    });
    if (invalidFields !== undefined) {
      await expect(updateTemplate(email, id, { fields: invalidFields })).rejects.toMatchObject({
        status: 400,
      });
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([undefined, null, [], 'body', false])('rejects nonobject payload %j', async (body) => {
    await expect(createTemplate(email, body)).rejects.toMatchObject({ status: 400 });
    await expect(updateTemplate(email, id, body)).rejects.toMatchObject({ status: 400 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each(['a', 'a'.repeat(255), '\u{1D11E}'.repeat(255)])(
    'accepts boundary name %# and 2000-character description',
    async (name) => {
      pool.query.mockResolvedValue({ rows: [row()] });
      await createTemplate(email, { name, description: 'd'.repeat(2000), fields: [] });
      expect(lastQuery()[1].slice(2, 5)).toEqual([name, 'd'.repeat(2000), '[]']);
      await updateTemplate(email, id, { name, description: 'd'.repeat(2000), fields: [] });
      expect(lastQuery()[1].slice(3)).toEqual([name, 'd'.repeat(2000), '[]']);
    }
  );
});

describe('database failures remain failures', () => {
  test.each([
    ['all list', () => listTemplates(email)],
    ['personal list', () => listTemplates(email, { scope: 'personal' })],
    ['global list', () => listTemplates(email, { scope: 'global' })],
    ['read', () => getTemplate(email, id)],
    ['create', () => createTemplate(email, input)],
    ['saved fork', () => createTemplate(email, { ...input, forked_from: parentId })],
    ['update', () => updateTemplate(email, id, input)],
    ['delete', () => deleteTemplate(email, id)],
  ])('%s rejects and retains the internal cause', async (label, operation) => {
    const cause = Object.assign(new Error('raw SQL detail: password required'), {
      code: '23514',
      details: 'private',
    });
    pool.query.mockRejectedValue(cause);
    await expect(operation()).rejects.toMatchObject({
      status: 503,
      message: 'Template storage is unavailable.',
      cause,
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('template router JSON and trusted admin boundary', () => {
  let server;
  beforeAll(async () => {
    const app = express();
    app.use(express.json({ strict: false }));
    app.use('/templates', router);
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
  });
  afterAll(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  });

  const send = (method, path = '', body) =>
    new Promise((resolve, reject) => {
      const data = body === undefined ? '' : JSON.stringify(body);
      const req = request(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          method,
          path: `/templates${path}`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            Connection: 'close',
          },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            text += chunk;
          });
          res.on('error', reject);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                type: res.headers['content-type'],
                body: JSON.parse(text),
              });
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on('error', reject);
      req.end(data);
    });
  const authenticate = (claims) =>
    requireAuth.mockImplementation((req, res, next) => {
      req.user = { email, ...claims };
      next();
    });
  const forged = {
    isAdmin: true,
    is_admin: true,
    app_metadata: { is_admin: true },
    user_metadata: { is_admin: true },
    options: { isAdmin: true },
  };

  test.each([undefined, {}, { is_admin: false }, { is_admin: 'true' }, { is_admin: 1 }])(
    'global create trusts only boolean app metadata: %j',
    async (app_metadata) => {
      authenticate({
        app_metadata,
        user_metadata: { is_admin: true },
        is_admin: true,
        isAdmin: true,
      });
      const response = await send('POST', '', { ...input, scope: 'global', ...forged });
      expect(response.status).toBe(403);
      expect(response.type).toContain('application/json');
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test('verified app metadata allows global create and keeps creator email', async () => {
    authenticate({ app_metadata: { is_admin: true }, user_metadata: { is_admin: false } });
    pool.query.mockResolvedValue({ rows: [row({ scope: 'global' })] });
    const response = await send('POST', '', { ...input, scope: 'global', isAdmin: false });
    expect(response.status).toBe(201);
    expect(response.body.template.scope).toBe('global');
    expect(lastQuery()[1].slice(0, 2)).toEqual([email, 'global']);
  });

  test.each(['PUT', 'DELETE'])(
    '%s cannot elevate through body or user metadata',
    async (method) => {
      authenticate({ app_metadata: { is_admin: 'true' }, user_metadata: { is_admin: true } });
      pool.query.mockResolvedValue({ rows: [] });
      const response = await send(method, `/${id}`, { ...input, ...forged });
      expect(response.status).toBe(404);
      expect(lastQuery()[1].slice(0, 3)).toEqual([id, email, false]);
      expectMutationPredicate(lastQuery()[0]);
    }
  );

  test.each(['PUT', 'DELETE'])('%s passes verified admin separately from body', async (method) => {
    authenticate({ app_metadata: { is_admin: true } });
    pool.query.mockResolvedValue({ rows: [row({ scope: 'global' })] });
    const response = await send(method, `/${id}`, { ...input, isAdmin: false });
    expect(response.status).toBe(200);
    expect(lastQuery()[1].slice(0, 3)).toEqual([id, email, true]);
    expectMutationPredicate(lastQuery()[0]);
    if (method === 'DELETE') expect(response.body).toEqual({ success: true });
  });

  test.each([
    ['GET', '?scope=invalid', undefined],
    ['GET', '/invalid', undefined],
    ['POST', '', { ...input, name: '' }],
    ['POST', '', { ...input, description: 42 }],
    ['POST', '', { ...input, fields: {} }],
    ['POST', '', { ...input, forked_from: 'tpl-unknown' }],
    ['POST', '', null],
    ['POST', '', []],
    ['POST', '', undefined],
    ['PUT', `/${id}`, { fields: null }],
    ['PUT', `/${id}`, { name: '' }],
    ['PUT', `/${id}`, { description: 'd'.repeat(2001) }],
    ['PUT', `/${id}`, null],
    ['DELETE', '/invalid', undefined],
  ])('%s %s invalid input yields safe 400 JSON', async (method, path, body) => {
    const response = await send(method, path, body);
    expect(response.status).toBe(400);
    expect(response.type).toContain('application/json');
    expect(typeof response.body.error).toBe('string');
    expect(response.body).not.toHaveProperty('stack');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('field validation returns structured details through error middleware', async () => {
    const response = await send('POST', '', {
      ...input,
      fields: [{ field_name: 'N', data_type: 'bad' }],
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invalid template fields.',
      details: expect.any(Array),
    });
  });

  test.each(['PUT', 'DELETE'])('%s built-in mutation returns 403 JSON', async (method) => {
    authenticate({ app_metadata: { is_admin: true } });
    expect((await send(method, '/tpl-lab-notebook', input)).status).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each(['GET', 'PUT', 'DELETE'])(
    '%s missing or inaccessible saved template returns 404',
    async (method) => {
      pool.query.mockResolvedValue({ rows: [] });
      const response = await send(method, `/${id}`, method === 'PUT' ? input : undefined);
      expect(response.status).toBe(404);
      expect(response.type).toContain('application/json');
      expect(response.body).not.toHaveProperty('success');
    }
  );

  test('unreadable fork source returns 404 without a follow-up insert', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const response = await send('POST', '', { ...input, forked_from: parentId });
    expect(response.status).toBe(404);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['GET', '', undefined],
    ['GET', '?scope=personal', undefined],
    ['GET', '?scope=global', undefined],
    ['GET', `/${id}`, undefined],
    ['POST', '', input],
    ['POST', '', { ...input, forked_from: parentId }],
    ['PUT', `/${id}`, input],
    ['DELETE', `/${id}`, undefined],
  ])('%s %s database failure returns 503 without raw SQL details', async (method, path, body) => {
    pool.query.mockRejectedValue(
      Object.assign(new Error('SQL schema_templates: password required'), {
        status: 400,
        details: [{ secret: 'private' }],
        code: '23514',
      })
    );
    const response = await send(method, path, body);
    expect(response.status).toBe(503);
    expect(response.type).toContain('application/json');
    expect(response.body).toEqual({ error: 'Template storage is unavailable.' });
  });

  test.each(['?scope=built_in', '/tpl-field-log'])(
    'built-in route %s works during database failure',
    async (path) => {
      pool.query.mockRejectedValue(new Error('offline'));
      const response = await send('GET', path);
      expect(response.status).toBe(200);
      expect(response.type).toContain('application/json');
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  test('unknown errors are sanitized instead of trusting their status or details', async () => {
    requireAuth.mockImplementation((req, res, next) =>
      next(
        Object.assign(new Error('private SQL'), {
          status: 400,
          details: ['private'],
        })
      )
    );
    const response = await send('GET');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Template storage is unavailable.' });
  });

  test('error middleware delegates when headers have already been sent', () => {
    const middleware = router.stack.at(-1).handle;
    const next = jest.fn();
    const error = new TemplateError(400, 'Invalid template ID.');
    const res = { headersSent: true, status: jest.fn() };
    middleware(error, {}, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
