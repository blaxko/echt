// Turns a scenario file into the HTTP payload the CRE verdict workflow expects (cre/echt-verdict run.ts).
// Refuses a scenario whose posts are not yet due, or whose post blocks are not filled (CLAUDE.md §8, D2).

export interface ScenarioVoice {
  personaId: string;
  wallet: string;
  attestation: { method: string };
}

export interface ScenarioPost {
  id: string;
  personaId: string;
  postedAt: string;
  postBlock: number | null;
}

export interface ScenarioFile {
  id: string;
  provenance: string;
  input: {
    runId: string;
    tokenSymbol: string;
    campaignSource: string;
    voices: ScenarioVoice[];
    posts: ScenarioPost[];
  };
}

export interface RunPayload {
  runId: string;
  symbol: string;
  pinnedToBlock: number;
  extractionFailed: boolean;
  knownExchanges: string[];
  voices: {
    personaId: string;
    wallet: string;
    verified: boolean;
    postBlock: number;
    postedAtMs: number;
    disclosedByPostId: string | null;
  }[];
}

/** What the extraction (F2) found, keyed by persona, because the extraction files and the scenario files use different post ids. */
export interface ExtractionFacts {
  /** Personas whose post (any of their posts) read as disclosed. */
  disclosedPersonas: ReadonlySet<string>;
  /** Personas whose post failed extraction after the retry. */
  failedPersonas: ReadonlySet<string>;
}

const NO_FACTS: ExtractionFacts = { disclosedPersonas: new Set(), failedPersonas: new Set() };

/**
 * One voice can post more than once. The voice's time is its earliest post, because convergence counts a
 * persona once at its earliest bullish post (packages/policy convergence.ts). Using the last post instead would
 * move the voice's time and its post block.
 */
export function earliestPostByPersona(posts: readonly ScenarioPost[]): Map<string, ScenarioPost> {
  const earliest = new Map<string, ScenarioPost>();
  for (const post of posts) {
    const current = earliest.get(post.personaId);
    if (!current || Date.parse(post.postedAt) < Date.parse(current.postedAt)) earliest.set(post.personaId, post);
  }
  return earliest;
}

export function buildRunPayload(scenario: ScenarioFile, pinnedToBlock: number, nowMs: number, facts: ExtractionFacts = NO_FACTS): RunPayload {
  const postByPersona = earliestPostByPersona(scenario.input.posts);
  const voices = scenario.input.voices.map((voice) => {
    const post = postByPersona.get(voice.personaId);
    if (!post) throw new Error(`${scenario.id}: ${voice.personaId} has no post`);
    if (post.postBlock === null) {
      throw new Error(`${scenario.id}: postBlock for ${voice.personaId} is not filled yet. Run scenarios:fill after its post time.`);
    }
    const postedAtMs = Date.parse(post.postedAt);
    if (postedAtMs > nowMs) {
      throw new Error(`${scenario.id}: ${voice.personaId} posts at ${post.postedAt}, which is still in the future. Refusing to run.`);
    }
    return {
      personaId: voice.personaId,
      wallet: voice.wallet.toLowerCase(),
      verified: voice.attestation.method === "signed_challenge",
      postBlock: post.postBlock,
      postedAtMs,
      // The payload cites the post that carries the disclosure (PRD §10.2).
      disclosedByPostId: facts.disclosedPersonas.has(voice.personaId) ? post.id : null,
    };
  });

  // A failed extraction on any converging voice makes the run REVIEW (PRD §10.2), never ELIGIBLE.
  const extractionFailed = scenario.input.voices.some((v) => facts.failedPersonas.has(v.personaId));

  const latestPostBlock = Math.max(...voices.map((v) => v.postBlock));
  if (pinnedToBlock < latestPostBlock) throw new Error(`${scenario.id}: pinned block ${pinnedToBlock} is before the posts`);

  return {
    runId: scenario.input.runId,
    symbol: scenario.input.tokenSymbol,
    pinnedToBlock,
    extractionFailed,
    knownExchanges: [],
    voices,
  };
}
