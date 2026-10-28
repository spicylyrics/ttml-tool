/** The legacy snapshot archive isn't a session anyone left off in. */
export const LEGACY_AUTOSAVE_PROJECT_ID = "legacy_autosave_archive";

/** Sessions older than this aren't offered on launch; History restore still has them. */
export const RESUME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface ResumeCandidate {
	id: string;
	name: string;
	lastModified: number;
	lineCount: number;
}

export const resumeKey = (
	candidate: Pick<ResumeCandidate, "id" | "lastModified">,
) => `${candidate.id}:${candidate.lastModified}`;

/**
 * The session to offer on launch, or null. Takes the autosave list newest
 * first. Only the newest session is offered, only if it has lyrics, is recent,
 * and wasn't already answered in that exact state.
 */
export function pickSessionToResume(
	projects: readonly ResumeCandidate[],
	{
		now,
		answeredKey,
		maxAgeMs = RESUME_MAX_AGE_MS,
	}: { now: number; answeredKey: string | null; maxAgeMs?: number },
): ResumeCandidate | null {
	const latest = projects.find(
		(project) => project.id !== LEGACY_AUTOSAVE_PROJECT_ID,
	);
	if (!latest || latest.lineCount === 0) return null;
	if (now - latest.lastModified > maxAgeMs) return null;
	if (answeredKey === resumeKey(latest)) return null;
	return latest;
}
