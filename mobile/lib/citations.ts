import type { QueryResult, ToolUsage } from '../hooks/useQuery';

/** Build a short trust line shown under AI answers (sources, model, DB). */
export function buildCitationLabel(data: QueryResult, locationLabel?: string): string | undefined {
  const tools = data.tools_used ?? [];
  const fineHit = tools.find(
    (t) => t.tool === 'lookup_fine' && t.result?.found && t.result.amount_inr != null
  );
  if (fineHit?.result) {
    const r = fineHit.result;
    const section = r.section_ref || 'MV Act';
    const when = r.data_as_of
      ? new Date(r.data_as_of).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'local DB';
    const url = r.source_url ? ' · official link in app' : '';
    return `Source: ${section} · ₹${r.amount_inr} from DriveLegal DB (${when})${url}`;
  }

  const ruleHit = tools.find((t) => t.tool === 'lookup_rule' && t.result?.found);
  if (ruleHit?.result?.section) {
    return `Source: ${ruleHit.result.section} · rules database`;
  }

  if (data.model) {
    const modelShort = data.model.replace('ollama/', 'Local AI: ');
    return `${modelShort} · Informational only · verify on morth.nic.in`;
  }

  if (locationLabel) {
    return `${locationLabel} · Motor Vehicles Act · verify official sources`;
  }

  return 'Informational only · not legal advice · verify on echallan.parivahan.gov.in';
}
