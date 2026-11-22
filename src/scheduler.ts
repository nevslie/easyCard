// Berechnet nach einer Bewertung den neuen Lernstand (vereinfachtes SM-2, wie Anki).
// In Version 1 werden die Werte nur gespeichert. Die Lernrunde fragt trotzdem alle Karten ab.
// Später kann eine Runde nach `due` filtern, ohne dass sich das Dateiformat ändert.

import { Progress, Rating } from "./deck";

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Neue Intervalle in Tagen für neue bzw. neu zu lernende Karten. 0 = gleich nochmal. */
const LEARNING_INTERVALS: Record<Rating, number> = { 1: 0, 2: 1, 3: 2, 4: 4 };

function startOfDay(d: Date): Date {
	const s = new Date(d);
	s.setHours(0, 0, 0, 0);
	return s;
}

export function nextInterval(p: Progress, rating: Rating): number {
	if (p.state !== "review") return LEARNING_INTERVALS[rating];
	const prev = Math.max(1, p.interval);
	switch (rating) {
		case 1:
			return 0;
		case 2:
			return Math.max(prev + 1, Math.round(prev * 1.2));
		case 3:
			return Math.max(prev + 1, Math.round(prev * p.ease));
		case 4:
			return Math.max(prev + 2, Math.round(prev * p.ease * 1.3));
	}
}

export function schedule(p: Progress, rating: Rating, now = new Date()): Progress {
	const next: Progress = { ...p };
	const interval = nextInterval(p, rating);

	if (p.state === "review") {
		if (rating === 1) {
			next.lapses += 1;
			next.ease = Math.max(MIN_EASE, p.ease - 0.2);
		} else if (rating === 2) next.ease = Math.max(MIN_EASE, p.ease - 0.15);
		else if (rating === 4) next.ease = p.ease + 0.15;
	}
	next.ease = Math.round(next.ease * 100) / 100;

	next.interval = interval;
	next.state = interval === 0 ? "learning" : "review";
	next.due =
		interval === 0
			? now.toISOString()
			: new Date(startOfDay(now).getTime() + interval * DAY_MS).toISOString();
	next.lastReview = now.toISOString();
	next.reps += 1;
	next.lastRating = rating;
	return next;
}

export function formatInterval(days: number): string {
	if (days === 0) return "gleich";
	if (days < 30) return `${days} T`;
	if (days < 365) return `${Math.round((days / 30) * 10) / 10} Mo`.replace(".", ",");
	return `${Math.round((days / 365) * 10) / 10} J`.replace(".", ",");
}

export function isDue(p: Progress, now = new Date()): boolean {
	return p.due !== null && new Date(p.due).getTime() <= now.getTime();
}

/** Ganze Tage bis zur Fälligkeit (0 = heute oder überfällig). null = Karte ist neu. */
export function daysUntilDue(p: Progress, now = new Date()): number | null {
	if (p.state === "new" || !p.due) return null;
	const diff = startOfDay(new Date(p.due)).getTime() - startOfDay(now).getTime();
	return Math.max(0, Math.round(diff / DAY_MS));
}

/**
 * Fälligkeit manuell setzen (beim Bearbeiten einer Karte).
 * Bei gelernten Karten ändert sich nur `due`, Intervall und Ease bleiben gleich.
 * Eine neue Karte gilt danach als gelernt, mit den gesetzten Tagen als Intervall.
 */
export function setDueInDays(p: Progress, days: number, now = new Date()): Progress {
	const d = Math.max(0, Math.round(days));
	const next: Progress = { ...p };
	next.due = new Date(startOfDay(now).getTime() + d * DAY_MS).toISOString();
	if (p.state === "new") {
		next.state = "review";
		next.interval = Math.max(1, d);
	}
	return next;
}
