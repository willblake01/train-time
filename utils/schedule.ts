// Next arrival for a route that starts at `firstService` (HH:mm, 24-hour)
// and repeats every `frequency` minutes, in the viewer's local time.
export function calculateNextArrival(firstService: string, frequency: number, now = new Date()) {
    const [hours, minutes] = firstService.split(':').map(Number);
    if (!frequency || frequency <= 0 || Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    const first = new Date(now);
    first.setHours(hours, minutes, 0, 0);

    const elapsed = Math.floor((now.getTime() - first.getTime()) / 60_000);
    // Before today's first train, count down to it; after, to the next one in the cycle
    const minutesAway = elapsed < 0 ? -elapsed : frequency - (elapsed % frequency);

    const next = new Date(now.getTime() + minutesAway * 60_000);
    return {
        minutesAway,
        nextArrival: next.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
}