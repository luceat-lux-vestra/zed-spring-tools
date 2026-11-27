import { isDeepStrictEqual } from "node:util";

// Canonical expected rules live in merge-gate-policy.json; the required check
// identities are derived from its classified contexts, not repeated by name.
export function validateLiveRuleset(policy, observed) {
  const errors = [];
  const wanted = policy.ruleset;
  const compare = (field, expected, actual) => {
    if (!isDeepStrictEqual(expected, actual)) errors.push("Ruleset " + field + " drift: expected " + JSON.stringify(expected) + "; observed " + JSON.stringify(actual));
  };
  if (!wanted || !Array.isArray(wanted.rules) || !Array.isArray(policy.contexts)) return ["Missing ruleset contract"];
  for (const field of ["name", "target", "source_type", "enforcement", "conditions", "bypass_actors"]) {
    if (!Object.hasOwn(wanted, field)) errors.push("Missing ruleset policy field " + field);
    else compare(field, wanted[field], observed?.[field]);
  }
  compare("source", policy.repository, observed?.source);
  const required = policy.contexts.filter(x => x.class === "required").map(x => ({context:x.context,integration_id:x.integration_id}));
  if (!required.length || required.some(x => !Number.isSafeInteger(x.integration_id) || x.integration_id <= 0)) errors.push("Required check producer identity missing or invalid");
  const checks = wanted.rules.filter(x => x.type === "required_status_checks");
  if (checks.length !== 1) errors.push("Exactly one required_status_checks policy rule is required");
  const expected = wanted.rules.map(x => x.type === "required_status_checks" ? {...x,parameters:{...x.parameters,required_status_checks:required}} : x);
  const sortRules = rules => [...rules].sort((a,b) => a.type.localeCompare(b.type));
  if (!Array.isArray(observed?.rules) || observed.rules.some(x => !x || typeof x.type !== "string")) errors.push("Missing or malformed live rules array");
  else compare("rules", sortRules(expected), sortRules(observed.rules));
  return errors;
}

export function validateEventPolicies(policy, observed) {
  // #142 established zero repository-level event exceptions. A renamed or
  // re-created exception is no more legitimate than the retired ID.
  if (!Array.isArray(policy.actions_event_policies) || policy.actions_event_policies.length !== 0) return ["Expected zero repository Actions event exceptions"];
  if (observed?.total_count !== 0 || !isDeepStrictEqual(observed?.policies, policy.actions_event_policies)) return ["Unexpected or incomplete repository Actions event-policy readback"];
  return [];
}
