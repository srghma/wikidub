export interface VttCue {
	start: number;
	end: number;
	text: string;
}

function parseTimestamp(timestamp: string): number {
	const clean = timestamp.trim().replace(',', '.');
	const parts = clean.split(':');
	if (parts.length === 3) {
		const hours = parseFloat(parts[0]);
		const minutes = parseFloat(parts[1]);
		const seconds = parseFloat(parts[2]);
		return (isNaN(hours) ? 0 : hours) * 3600 + (isNaN(minutes) ? 0 : minutes) * 60 + (isNaN(seconds) ? 0 : seconds);
	} else if (parts.length === 2) {
		const minutes = parseFloat(parts[0]);
		const seconds = parseFloat(parts[1]);
		return (isNaN(minutes) ? 0 : minutes) * 60 + (isNaN(seconds) ? 0 : seconds);
	}
	const direct = parseFloat(clean);
	return isNaN(direct) ? 0 : direct;
}

export function parseVttText(vtt: string): VttCue[] {
	const lines = vtt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const cues: VttCue[] = [];

	let currentStart = 0;
	let currentEnd = 0;
	let currentTextLines: string[] = [];
	let isReadingCue = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		if (line.includes('-->')) {
			// Save previous cue if any
			if (isReadingCue && currentTextLines.length > 0) {
				cues.push({
					start: currentStart,
					end: currentEnd,
					text: currentTextLines.join(' ').replace(/<[^>]*>/g, '').trim()
				});
				currentTextLines = [];
			}

			const [startPart, endPart] = line.split('-->');
			currentStart = parseTimestamp(startPart.trim());
			// End part may contain cue settings after space, e.g. "00:01:10.028 align:start"
			const endTimestampStr = endPart.trim().split(/\s+/)[0];
			currentEnd = parseTimestamp(endTimestampStr);
			isReadingCue = true;
		} else if (isReadingCue) {
			if (line.length === 0) {
				// End of current cue block
				if (currentTextLines.length > 0) {
					cues.push({
						start: currentStart,
						end: currentEnd,
						text: currentTextLines.join(' ').replace(/<[^>]*>/g, '').trim()
					});
					currentTextLines = [];
				}
				isReadingCue = false;
			} else if (!line.startsWith('NOTE') && !line.startsWith('WEBVTT') && !line.startsWith('STYLE')) {
				currentTextLines.push(line);
			}
		}
	}

	if (isReadingCue && currentTextLines.length > 0) {
		cues.push({
			start: currentStart,
			end: currentEnd,
			text: currentTextLines.join(' ').replace(/<[^>]*>/g, '').trim()
		});
	}

	return cues;
}
