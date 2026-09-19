import { getSupabase } from '@/lib/supabase';

const API_BASE =
  import.meta.env.VITE_PROJECT_SERVICE_URL || 'https://project-service-96ml.onrender.com';

export interface Template {
  id: string;
  name: string;
  description?: string;
  fields: any[];
  scope: 'built_in' | 'personal' | 'global';
  version: number;
  is_fork: boolean;
  forked_from?: string;
  created_at?: string;
  updated_at?: string;
}

export async function listTemplates(
  scope: 'all' | 'built_in' | 'personal' | 'global' = 'all'
): Promise<Template[]> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates?scope=${scope}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('Failed to list templates');
  const data = await response.json();
  return data.templates;
}

export async function getTemplate(templateId: string): Promise<Template> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates/${templateId}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('Template not found');
  const data = await response.json();
  return data.template;
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  fields: any[];
  scope?: 'personal' | 'global';
  forked_from?: string;
}): Promise<Template> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  const data = await response.json();
  return data.template;
}

export async function updateTemplate(
  templateId: string,
  input: {
    name?: string;
    description?: string;
    fields?: any[];
  }
): Promise<Template> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates/${templateId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }
  const data = await response.json();
  return data.template;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/service/templates/${templateId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error('Failed to delete template');
}
