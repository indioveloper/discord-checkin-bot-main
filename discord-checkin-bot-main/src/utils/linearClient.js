'use strict';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.warn('[linear] LINEAR_API_KEY no definida — sugerencias de Linear desactivadas');
}

const QUERY = `
  query {
    issues(filter: {
      priority: { in: [1, 2] }
      state: { type: { nin: ["completed", "cancelled"] } }
    }) {
      nodes { title }
    }
  }
`;

/**
 * Devuelve nombres de proyectos únicos de issues de Linear con prioridad
 * Urgente (1) o Alta (2) que no estén completados ni cancelados.
 * Retorna [] si LINEAR_API_KEY no está definida o si ocurre cualquier error.
 *
 * @returns {Promise<string[]>}
 */
async function getLinearProjects() {
  if (!LINEAR_API_KEY) return [];
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[linear] API respondió con HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    if (json.errors) {
      console.warn('[linear] GraphQL errors:', json.errors.map(e => e.message).join('; '));
      return [];
    }
    const nodes = json?.data?.issues?.nodes ?? [];
    return [...new Set(
      nodes.map(n => n?.title).filter(Boolean).map(n => n.trim()),
    )];
  } catch (err) {
    console.warn('[linear] Error al obtener proyectos:', err.message);
    return [];
  }
}

module.exports = { getLinearProjects };
