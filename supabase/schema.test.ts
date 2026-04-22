import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('supabase schema', () => {
  const sqlPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  it('creates core tables', () => {
    expect(sql).toContain('create table if not exists myth_nodes');
    expect(sql).toContain('create table if not exists myth_edges');
  });

  it('enables row-level security', () => {
    expect(sql).toContain('alter table myth_nodes enable row level security;');
    expect(sql).toContain('alter table myth_edges enable row level security;');
  });

  it('grants read and insert for anon/authenticated roles', () => {
    expect(sql).toContain('grant select, insert on table myth_nodes to anon, authenticated;');
    expect(sql).toContain('grant select, insert on table myth_edges to anon, authenticated;');
  });

  it('defines read policies for both tables', () => {
    expect(sql).toContain('create policy "Public read nodes"');
    expect(sql).toContain('create policy "Public read edges"');
  });

  it('defines insert policies for both tables', () => {
    expect(sql).toContain('create policy "Public insert nodes"');
    expect(sql).toContain('create policy "Public insert edges"');
  });

  it('contains seed inserts for nodes and edges', () => {
    expect(sql).toContain('insert into myth_nodes');
    expect(sql).toContain('insert into myth_edges');
  });
});
