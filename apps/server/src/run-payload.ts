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

/**
 * `disclosed` holds the persona IDs whose post the extraction read as disclosed (F2). A disclosed voice is
 * still shown, but it does not count toward BLOCK (D5).
 */
export function buildRunPayload(scenario: ScenarioFile, pinnedToBlock: number, nowMs: number, disclosed: ReadonlySet<string> = new Set()): RunPayload {
  const postByPersona = new Map(scenario.input.posts.map((p) => [p.personaId, p]));
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
      disclosedByPostId: disclosed.has(voice.personaId) ? post.id : null,
    };
  });

  const latestPostBlock = Math.max(...voices.map((v) => v.postBlock));
  if (pinnedToBlock < latestPostBlock) throw new Error(`${scenario.id}: pinned block ${pinnedToBlock} is before the posts`);

  return {
    runId: scenario.input.runId,
    symbol: scenario.input.tokenSymbol,
    pinnedToBlock,
    extractionFailed: false,
    knownExchanges: [],
    voices,
  };
}
